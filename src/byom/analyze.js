import * as THREE from 'three'

/**
 * Looks at an uploaded watch model and works out:
 *  - how it is oriented (which way the dial faces, where 12 o'clock is)
 *  - where the watch head is and how big it is
 *  - which part each mesh probably is, with a confidence level
 *  - meshes that look like several parts merged together
 *
 * It only uses three.js maths, so it runs in the browser and in Node (tests).
 *
 * Coordinates: after orientation, the "canonical" space has the dial facing +Z,
 * 12 o'clock at +Y, the head centre at the origin and the case radius = 1.
 */

// ─── Name keywords ───────────────────────────────────────────────
// First matching role wins, so the more specific ones come first.
const KEYWORDS = [
  ['glass', ['glass', 'crystal', 'sapphire', 'lens']],
  ['markers', ['marker', 'markers', 'index', 'indices', 'indexes', 'numeral', 'numerals', 'applique', 'appliques']],
  ['hands', ['hand', 'hands', 'needle', 'pointer']],
  ['crown', ['crown', 'winder', 'pusher', 'knob']],
  ['buckle', ['buckle', 'clasp', 'deployant', 'prong', 'tang']],
  ['dial', ['dial', 'dials', 'subdial', 'face', 'chapter']],
  ['strap', ['strap', 'straps', 'band', 'bracelet', 'link', 'links', 'leather', 'rubber', 'nato', 'belt', 'keeper']],
  ['case', ['case', 'caseback', 'bezel', 'lug', 'lugs', 'housing', 'shell']],
]

// Words that start like a keyword but mean something else.
const NOT_KEYWORDS = new Set(['handle', 'handles', 'cases', 'faces', 'facet', 'facets', 'linked', 'bandage'])

/** "HourHand_01" → ['hour', 'hand'];  "pCylinder5.001" → ['p', 'cylinder'] */
export function tokenize(name) {
  return (name || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean)
}

/** Role suggested by a name, or null. */
export function keywordRole(name) {
  const toks = tokenize(name)
  for (const [role, words] of KEYWORDS) {
    for (const t of toks) {
      // exact word, or a longer word starting with it ("bracelets", "lugs1")
      const hit = words.find((k) => t === k || (k.length >= 4 && t.startsWith(k) && !NOT_KEYWORDS.has(t)))
      if (hit) return { role, word: hit }
    }
  }
  return null
}

// ─── Small helpers ───────────────────────────────────────────────
const materialsOf = (mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(Boolean)

function isTransparent(mesh) {
  return materialsOf(mesh).some(
    (m) => (m.transmission ?? 0) > 0.1 || (m.transparent && (m.opacity ?? 1) < 0.9),
  )
}

const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]

/** Sorted dimensions of a box and which axis is thinnest. */
function shapeOf(box) {
  const s = box.getSize(new THREE.Vector3()).toArray()
  const order = [0, 1, 2].sort((a, b) => s[a] - s[b])
  return { size: s, thinAxis: order[0], d: order.map((i) => s[i]) }
}

/** Two large similar dimensions and one small: a disc, plate or ring. */
function isDiscLike(box) {
  const { d } = shapeOf(box)
  return d[2] > 0 && d[1] / d[2] > 0.8 && d[0] / d[2] < 0.45
}

/** Iterate triangles of a geometry: cb(i0, i1, i2). Samples very large meshes. */
function forEachTriangle(geometry, cb, maxTris = 200000) {
  const index = geometry.index?.array
  const count = index ? index.length / 3 : geometry.attributes.position.count / 3
  const step = Math.max(1, Math.floor(count / maxTris))
  for (let t = 0; t < count; t += step) {
    const k = t * 3
    if (index) cb(index[k], index[k + 1], index[k + 2])
    else cb(k, k + 1, k + 2)
  }
}

const SAMPLES = [[1 / 3, 1 / 3, 1 / 3], [2 / 3, 1 / 6, 1 / 6], [1 / 6, 2 / 3, 1 / 6], [1 / 6, 1 / 6, 2 / 3]]

/**
 * How "solid" a disc is: the share of its surface area within half its radius
 * of the centre. A full disc (dial, glass, caseback) scores ~0.25; a ring
 * (bezel, strap loop) scores ~0.
 */
function discFill(mesh, center, axis, radius) {
  const pos = mesh.geometry.attributes.position
  const m = mesh.matrixWorld
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const [u, v] = [0, 1, 2].filter((i) => i !== axis)
  let inner = 0
  let total = 0
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  forEachTriangle(mesh.geometry, (i0, i1, i2) => {
    a.fromBufferAttribute(pos, i0).applyMatrix4(m)
    b.fromBufferAttribute(pos, i1).applyMatrix4(m)
    c.fromBufferAttribute(pos, i2).applyMatrix4(m)
    // area projected onto the disc plane
    ab.subVectors(b, a)
    ac.subVectors(c, a)
    const area = Math.abs(ab.getComponent(u) * ac.getComponent(v) - ab.getComponent(v) * ac.getComponent(u)) / 2
    total += area
    // Sample 4 points per triangle (centroid + one near each corner), so fan
    // triangulated discs — whose centroids all lie far out — still count as solid.
    for (const [wa, wb, wc] of SAMPLES) {
      const pu = wa * a.getComponent(u) + wb * b.getComponent(u) + wc * c.getComponent(u) - center.getComponent(u)
      const pv = wa * a.getComponent(v) + wb * b.getComponent(v) + wc * c.getComponent(v) - center.getComponent(v)
      if (Math.hypot(pu, pv) < radius * 0.5) inner += area / SAMPLES.length
    }
  })
  return total > 0 ? inner / total : 0
}

/**
 * Connected pieces ("islands") of a mesh, after welding vertices that share a
 * position. Returns [{ box (local space), tris }] or null if the mesh is huge.
 */
export function findIslands(geometry, maxVertices = 400000) {
  const pos = geometry.attributes.position
  const n = pos.count
  if (n > maxVertices) return null
  geometry.computeBoundingBox()
  const diag = geometry.boundingBox.getSize(new THREE.Vector3()).length() || 1
  const q = 1e5 / diag
  const keyToVertex = new Map()
  const rep = new Int32Array(n)
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(pos.getX(i) * q)},${Math.round(pos.getY(i) * q)},${Math.round(pos.getZ(i) * q)}`
    let r = keyToVertex.get(key)
    if (r === undefined) keyToVertex.set(key, (r = i))
    rep[i] = r
  }
  const parent = new Int32Array(n)
  for (let i = 0; i < n; i++) parent[i] = i
  const find = (x) => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]]
    return x
  }
  const union = (x, y) => {
    const rx = find(x)
    const ry = find(y)
    if (rx !== ry) parent[rx] = ry
  }
  forEachTriangle(geometry, (a, b, c) => {
    union(rep[a], rep[b])
    union(rep[b], rep[c])
  }, Infinity)
  const islands = new Map()
  const p = new THREE.Vector3()
  forEachTriangle(geometry, (a, b, c) => {
    const root = find(rep[a])
    let isl = islands.get(root)
    if (!isl) islands.set(root, (isl = { box: new THREE.Box3(), tris: 0 }))
    isl.tris++
    isl.box.expandByPoint(p.fromBufferAttribute(pos, a))
    isl.box.expandByPoint(p.fromBufferAttribute(pos, b))
    isl.box.expandByPoint(p.fromBufferAttribute(pos, c))
  }, Infinity)
  return [...islands.values()]
}

/** Exact box of a world-space box after an axis-aligned rotation + scale. */
function transformBox(box, matrix) {
  return box.clone().applyMatrix4(matrix)
}

// ─── Orientation ─────────────────────────────────────────────────
/**
 * Elements are { box (world), mesh?, transparent, keyword } — usually one per
 * mesh, or one per island when the whole model is only one or two meshes.
 */
function findOrientation(elements) {
  const discs = []
  for (const el of elements) {
    if (!isDiscLike(el.box)) continue
    const { thinAxis, d } = shapeOf(el.box)
    const center = el.box.getCenter(new THREE.Vector3())
    const radius = d[2] / 2
    const fill = el.mesh ? discFill(el.mesh, center, thinAxis, radius) : 0.25
    discs.push({ el, axis: thinAxis, center, radius, fill })
  }

  const concentricWith = (ref) =>
    discs.filter((d) => {
      if (d.axis !== ref.axis) return false
      const [u, v] = [0, 1, 2].filter((i) => i !== ref.axis)
      const off = Math.hypot(
        d.center.getComponent(u) - ref.center.getComponent(u),
        d.center.getComponent(v) - ref.center.getComponent(v),
      )
      const depth = Math.abs(d.center.getComponent(ref.axis) - ref.center.getComponent(ref.axis))
      return off < 0.2 * Math.max(d.radius, ref.radius) && depth < 1.5 * Math.max(d.radius, ref.radius)
    })

  // The head is the solid disc with the most concentric companions
  // (dial, glass, caseback and bezel all share one axis).
  let ref = null
  let best = -1
  for (const d of discs) {
    if (d.fill < 0.1) continue
    const score = d.radius * (1 + concentricWith(d).length)
    if (score > best) [best, ref] = [score, d]
  }
  if (!ref && discs.length) ref = discs.reduce((a, b) => (b.radius > a.radius ? b : a))

  let axis, headCenter, R, stack
  if (ref) {
    axis = ref.axis
    stack = concentricWith(ref)
    const union = new THREE.Box3()
    stack.forEach((d) => union.union(d.el.box))
    headCenter = union.getCenter(new THREE.Vector3())
    R = Math.max(...stack.map((d) => d.radius))
  } else {
    // No disc at all: fall back to the whole model's box.
    const all = new THREE.Box3()
    elements.forEach((e) => all.union(e.box))
    const { thinAxis, d } = shapeOf(all)
    axis = thinAxis
    headCenter = all.getCenter(new THREE.Vector3())
    R = d[1] / 2 || 1
    stack = []
  }

  // Which side is the front? Vote with several cues.
  let votes = 0
  const offsetOf = (el) => el.box.getCenter(new THREE.Vector3()).getComponent(axis) - headCenter.getComponent(axis)
  const planarDist = (el) => {
    const c = el.box.getCenter(new THREE.Vector3())
    const [u, v] = [0, 1, 2].filter((i) => i !== axis)
    return Math.hypot(c.getComponent(u) - headCenter.getComponent(u), c.getComponent(v) - headCenter.getComponent(v))
  }
  for (const el of elements) {
    const off = offsetOf(el)
    if (Math.abs(off) < 0.02 * R) continue
    const s = Math.sign(off)
    const size = el.box.getSize(new THREE.Vector3())
    const planarSize = Math.max(...size.toArray().filter((_, i) => i !== axis)) / 2
    const dist = planarDist(el)
    if (el.transparent && dist < R) votes += 3 * s
    if (['dial', 'glass', 'hands', 'markers'].includes(el.keyword)) votes += 2 * s
    else if (dist < 0.9 * R && planarSize < 0.4 * R && Math.abs(off) < R) votes += 1 * s // hands, markers…
    if ((dist > 1.3 * R || Math.abs(off) > 1.3 * R) && Math.abs(off) > 0.5 * R) votes -= 2 * s // strap loops behind
  }
  const defaultSign = 1
  const faceSign = votes > 0 ? 1 : votes < 0 ? -1 : defaultSign
  const F = AXES[axis].clone().multiplyScalar(faceSign)

  // Where is 12 o'clock? The strap runs along the 12–6 line; the crown sits at 3.
  const others = [0, 1, 2].filter((i) => i !== axis)
  const far = new THREE.Box3()
  let crown = null
  for (const el of elements) {
    const dist = planarDist(el)
    const size = el.box.getSize(new THREE.Vector3())
    const maxSize = Math.max(size.x, size.y, size.z)
    if (dist > 1.3 * R || Math.abs(offsetOf(el)) > 1.3 * R) far.union(el.box)
    else if (maxSize < 0.45 * R && dist > 0.85 * R && dist < 1.6 * R && !crown) {
      const c = el.box.getCenter(new THREE.Vector3()).sub(headCenter)
      const [a, b] = others.map((i) => Math.abs(c.getComponent(i)))
      // must clearly sit on one side, not diagonal
      if (Math.max(a, b) > 2 * Math.min(a, b)) crown = { axis: a > b ? others[0] : others[1], sign: Math.sign(c.getComponent(a > b ? others[0] : others[1])) }
    }
  }
  // How far the model reaches from the head centre along each in-plane axis.
  // The strap makes the 12–6 axis clearly the longest.
  const ext = others.map((i) => {
    let e = 0
    for (const el of elements) {
      e = Math.max(e, Math.abs(el.box.min.getComponent(i) - headCenter.getComponent(i)), Math.abs(el.box.max.getComponent(i) - headCenter.getComponent(i)))
    }
    return e
  })
  let twelveAxis
  let crownUsed = false
  const decisive = Math.max(...ext) > 1.3 * Math.min(...ext)
  if (decisive) twelveAxis = ext[0] >= ext[1] ? others[0] : others[1]
  if (crown && (twelveAxis === undefined || crown.axis !== twelveAxis)) {
    twelveAxis = others.find((i) => i !== crown.axis)
    crownUsed = true
  }
  if (twelveAxis === undefined) twelveAxis = others.includes(1) ? 1 : others[0]

  let T
  if (crownUsed) {
    const C = AXES[crown.axis].clone().multiplyScalar(crown.sign)
    T = new THREE.Vector3().crossVectors(F, C) // 12 o'clock = face × 3 o'clock
  } else {
    // Blender "lying flat" models face +Y in glTF with 12 o'clock at -Z.
    const sign = axis === 1 && twelveAxis === 2 ? -1 : 1
    T = AXES[twelveAxis].clone().multiplyScalar(sign)
  }
  const X = new THREE.Vector3().crossVectors(T, F)
  const basis = new THREE.Matrix4().makeBasis(X, T, F) // canonical → model
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis).invert() // model → canonical

  return {
    quaternion,
    headCenter,
    radius: R,
    concentric: new Set(stack.map((d) => d.el)),
    filled: new Map(discs.map((d) => [d.el, d.fill])),
    cues: { faceVotes: votes, usedCrown: crownUsed, usedStrap: decisive, foundHead: !!ref },
  }
}

// ─── Part classification (canonical space) ───────────────────────
/** Feature summary of a canonical-space box. */
function featuresOf(box) {
  const c = box.getCenter(new THREE.Vector3())
  const s = box.getSize(new THREE.Vector3())
  const maxXY = Math.max(s.x, s.y)
  return {
    box,
    c,
    s,
    planar: maxXY / 2,
    r: Math.hypot(c.x, c.y),
    round: maxXY > 0 ? Math.min(s.x, s.y) / maxXY : 0,
    thin: maxXY > 0 ? s.z / maxXY : 1,
    maxDim: Math.max(s.x, s.y, s.z),
  }
}

const near = (a, b, tol) => Math.abs(a - b) <= tol

/** Islands of a mesh have no fill measurement; disc-shaped ones count as solid. */
const isFilled = (fills, el) => (fills.get(el) ?? (el.mesh ? 0 : 0.25)) > 0.1

/**
 * All plausible roles for one element, each with a score (0–1) and a short reason.
 * `ctx` holds model-wide facts (marker clusters, the hands/markers level…).
 */
function classify(f, el, ctx) {
  const out = []
  const add = (role, score, reason) => out.push({ role, score, reason })
  const concentric = f.r < 0.12 && f.round > 0.85
  const filled = isFilled(ctx.filled, el)
  const inHead = f.r < 1.0 && Math.abs(f.c.z) < 1.0 && f.planar <= 1.25
  const outside = f.r > 1.25 || f.c.z < -1.0 || f.planar > 1.6

  // Glass
  if (el.transparent && inHead) add('glass', 0.9, 'see-through material on the watch face')
  if (concentric && filled && f.planar > 0.55 && f.planar < 1.1 && f.thin < 0.3) {
    if (ctx.ornamentTop !== null && f.box.min.z >= ctx.ornamentTop - 0.01)
      add('glass', 0.6, 'round, flat and in front of the hands')
  }

  // Dial
  if (concentric && f.planar >= 0.4 && f.planar <= 0.98 && f.thin < 0.3) {
    const underOrnaments = ctx.ornamentBottom === null || f.box.max.z <= ctx.ornamentBottom + 0.06
    if (filled && underOrnaments) {
      add('dial', el === ctx.dialCandidate ? 0.68 : 0.4, 'flat disc under the hands and markers')
    } else if (!filled && f.c.z > ctx.headMidZ) {
      add('dial', 0.45, 'ring on the dial (chapter ring)')
    }
  }
  if (concentric && filled && f.planar >= 0.12 && f.planar < 0.4 && f.c.z > ctx.headMidZ) {
    add('dial', 0.42, 'small disc on the dial (centre or sub-dial)')
  }

  // Case
  if (concentric && f.planar > 0.98) add('case', 0.62, 'the largest round part')
  else if (concentric && f.planar >= 0.85) add('case', 0.5, 'large round part (bezel or case back)')
  if (!concentric && f.maxDim < 0.8 && near(Math.abs(f.c.y), 1.15, 0.45) && Math.abs(f.c.x) > 0.2 && Math.abs(f.c.x) < 1.0 && Math.abs(f.c.z) < 0.8)
    add('case', 0.52, 'in the lug position')
  if (Math.abs(f.c.y) > 0.8 && Math.abs(f.c.y) < 1.6 && Math.abs(f.c.x) < 0.25 && f.s.x > 0.5 && f.s.x < 1.4 && f.s.y < 0.25 && f.s.z < 0.3)
    add('case', 0.46, 'bar between the lugs')
  if (inHead && f.c.z < ctx.headMidZ && !concentric && f.planar < 0.3) add('case', 0.3, 'small part on the case back')

  // Crown
  if (!concentric && f.maxDim < 0.45 && f.r > 0.85 && f.r < 1.6 && Math.abs(f.c.z) < 0.8) {
    if (Math.abs(f.c.x) > 0.7 * f.r && Math.abs(f.c.y) < 0.5) add('crown', 0.66, 'small part on the side of the case')
    else if (Math.abs(f.c.x) > 0.45 * f.r && Math.abs(f.c.y) < 0.8) add('crown', 0.45, 'small part on the side (pusher?)')
  }

  // Hour markers
  if (!concentric && f.planar < 0.22 && f.r > 0.38 && f.r < 1.0 && f.s.z < 0.25) {
    const n = ctx.ringCount(f)
    if (n >= 4) add('markers', 0.62, `one of ${n} similar parts around the dial`)
    else add('markers', 0.28, 'small part near the edge of the dial')
  }

  // Hands
  const aspect = Math.max(f.s.x, f.s.y) / Math.max(Math.min(f.s.x, f.s.y), 1e-6)
  const toCentre = Math.hypot(Math.max(0, f.box.min.x, -f.box.max.x), Math.max(0, f.box.min.y, -f.box.max.y))
  if (!concentric && f.planar > 0.12 && f.planar < 0.95 && f.s.z < 0.15 && toCentre < 0.1 && f.c.z > ctx.headMidZ)
    add('hands', aspect > 3 ? 0.68 : 0.62, 'flat part reaching out from the centre')
  if (concentric && f.planar < 0.12 && f.c.z > ctx.headMidZ) add('hands', 0.5, 'small part in the centre (hand cap)')
  if (!concentric && inHead && f.planar < 0.25 && f.r < 0.95 && f.c.z > ctx.headMidZ && ctx.ringCount(f) < 4)
    add('hands', 0.38, 'small single part on the dial')

  // Strap / bracelet
  if (outside) {
    const elongated = Math.max(f.s.y, f.s.z) > 1.0
    const reps = ctx.similarOutside(f)
    if (elongated && f.s.x > 0.25 && f.s.x < 1.6) add('strap', 0.66, 'long part extending from the case')
    else if (reps >= 6) add('strap', 0.56, `one of ${reps} repeated links`)
    else if (f.maxDim < 1.0 && Math.hypot(f.c.y, f.c.z) > 1.8) add('buckle', 0.5, 'small part at the end of the strap')
    else add('strap', 0.35, 'outside the watch head')
  }

  return out.sort((a, b) => b.score - a.score)
}

export const LEVELS = { high: 0.75, medium: 0.5 }
export const levelOf = (score) => (score >= LEVELS.high ? 'high' : score >= LEVELS.medium ? 'medium' : 'low')

// Roles whose materials differ: a mesh spanning two of these groups can't be coloured correctly.
const MATERIAL_GROUP = { case: 'case', crown: 'case', buckle: 'case', hands: 'hands', markers: 'hands', dial: 'dial', glass: 'glass', strap: 'strap' }

// ─── Main entry ──────────────────────────────────────────────────
/**
 * @param {THREE.Object3D} root  the loaded scene
 * @returns analysis — see the bottom of this function
 */
export function analyzeModel(root) {
  root.updateMatrixWorld(true)
  const items = []
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return
    const index = items.length
    const mats = materialsOf(o)
    const box = new THREE.Box3().setFromObject(o, true)
    if (box.isEmpty()) return
    const ownKw = keywordRole(o.name)
    const matKw = mats.map((m) => keywordRole(m.name)).find(Boolean)
    let parentKw = null
    for (let p = o.parent; p && p !== root && !parentKw; p = p.parent) parentKw = keywordRole(p.name)
    items.push({
      id: `${index}:${o.name}`,
      index,
      mesh: o,
      name: o.name || `Mesh ${index + 1}`,
      materialName: mats[0]?.name || '',
      vertexCount: o.geometry.attributes.position.count,
      triangleCount: (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3,
      box,
      transparent: isTransparent(o),
      keyword: (ownKw ?? matKw ?? parentKw)?.role ?? null,
      keywordInfo: ownKw ? { ...ownKw, from: 'name' } : matKw ? { ...matKw, from: 'material' } : parentKw ? { ...parentKw, from: 'parent' } : null,
      islands: null,
    })
  })

  // Islands (connected pieces) — used for merge warnings and for one-mesh models.
  for (const it of items) {
    const local = findIslands(it.mesh.geometry)
    it.islands = local
      ?.filter((isl) => isl.tris >= 2)
      .map((isl) => ({ ...isl, box: isl.box.clone().applyMatrix4(it.mesh.matrixWorld), parent: it, mesh: null, transparent: it.transparent, keyword: null }))
  }

  // With only one or two meshes, orient using their islands instead.
  const useIslands = items.length < 3 && items.some((it) => (it.islands?.length ?? 0) > 2)
  const elements = useIslands ? items.flatMap((it) => it.islands ?? [it]) : items
  const orient = items.length ? findOrientation(elements) : null
  if (!orient) return { items, guesses: {}, warnings: [], orientation: new THREE.Quaternion(), head: null }

  // Canonical transform: model space → (centred, oriented, case radius 1)
  const toCanonical = new THREE.Matrix4()
    .makeRotationFromQuaternion(orient.quaternion)
    .multiply(new THREE.Matrix4().makeTranslation(-orient.headCenter.x, -orient.headCenter.y, -orient.headCenter.z))
    .premultiply(new THREE.Matrix4().makeScale(1 / orient.radius, 1 / orient.radius, 1 / orient.radius))

  const feats = new Map()
  const featOf = (el) => {
    if (!feats.has(el)) feats.set(el, featuresOf(transformBox(el.box, toCanonical)))
    return feats.get(el)
  }
  const allEls = [...items, ...items.flatMap((it) => it.islands ?? [])]
  allEls.forEach(featOf)

  // Model-wide context
  const concentricZ = [...orient.concentric].map((el) => featOf(el).box)
  const headMidZ = concentricZ.length
    ? (Math.min(...concentricZ.map((b) => b.min.z)) + Math.max(...concentricZ.map((b) => b.max.z))) / 2
    : 0
  const ringCountOf = (pool) => (f) =>
    pool.filter((el) => {
      const g = featOf(el)
      return g.r > 0.38 && near(g.r, f.r, 0.1) && near(g.maxDim, f.maxDim, 0.35 * f.maxDim + 0.01) && g.r < 1.0
    }).length
  const ornamentsOf = (pool) =>
    pool.filter((el) => {
      const g = featOf(el)
      return !(g.r < 0.12 && g.round > 0.85) && g.planar < 0.3 && g.r < 0.95 && g.c.z > headMidZ && Math.abs(g.c.z) < 1
    })
  const makeCtx = (pool) => {
    const orn = ornamentsOf(pool)
    const ctx = {
      filled: orient.filled,
      headMidZ,
      ornamentTop: orn.length ? Math.max(...orn.map((e) => featOf(e).box.max.z)) : null,
      ornamentBottom: orn.length ? Math.min(...orn.map((e) => featOf(e).box.min.z)) : null,
      ringCount: ringCountOf(pool),
      similarOutside: (f) =>
        pool.filter((el) => {
          const g = featOf(el)
          return (g.r > 1.25 || g.c.z < -1) && near(g.maxDim, f.maxDim, 0.25 * f.maxDim)
        }).length,
      dialCandidate: null,
    }
    // The dial: the highest solid concentric disc sitting under the hands/markers.
    const dials = pool.filter((el) => {
      const g = featOf(el)
      return g.r < 0.12 && g.round > 0.85 && g.planar >= 0.4 && g.planar <= 0.98 && isFilled(orient.filled, el) &&
        (ctx.ornamentBottom === null || g.box.max.z <= ctx.ornamentBottom + 0.06)
    })
    ctx.dialCandidate = dials.sort((a, b) => featOf(b).box.max.z - featOf(a).box.max.z)[0] ?? null
    return ctx
  }
  const ctx = makeCtx(items)

  // Guess a role for every mesh.
  const guesses = {}
  for (const it of items) {
    const f = featOf(it)
    const geo = classify(f, it, ctx)
    const top = geo[0]
    let guess
    if (it.keywordInfo) {
      const { role, word, from } = it.keywordInfo
      const base = from === 'name' ? 0.92 : from === 'material' ? 0.74 : 0.7
      const agrees = geo.find((g) => g.role === role && g.score >= 0.4)
      const contradicted = from === 'parent' && top && top.role !== role && top.score >= 0.6
      if (contradicted) {
        guess = { role: top.role, score: top.score, reason: `shape: ${top.reason}`, source: 'shape' }
      } else {
        const where = from === 'name' ? 'name' : from === 'material' ? 'material name' : 'parent name'
        guess = {
          role,
          score: Math.min(0.98, base + (agrees ? 0.05 : 0)),
          reason: `${where} contains “${word}”${agrees ? ' and the shape fits' : ''}`,
          source: 'name',
        }
      }
    } else if (top && top.score >= 0.25) {
      const runnerUp = geo.find((g) => g.role !== top.role)
      // A close second choice lowers our confidence.
      const score = runnerUp && top.score - runnerUp.score < 0.1 ? top.score - 0.1 : top.score
      guess = { role: top.role, score, reason: top.reason, source: 'shape' }
    } else {
      guess = { role: 'ignore', score: 0.1, reason: 'couldn’t tell what this is — please assign it', source: 'none' }
    }
    guess.level = levelOf(guess.score)
    guess.alternatives = geo.filter((g) => g.role !== guess.role).slice(0, 2)
    guesses[it.id] = guess
  }

  // Merged meshes: one mesh whose separate pieces look like different parts.
  const warnings = []
  const islandCtx = makeCtx(allEls)
  for (const it of items) {
    const pieces = it.islands ?? []
    if (pieces.length < 2) continue
    const groups = new Map()
    let biggest = null
    for (const isl of pieces) {
      const top = classify(featOf(isl), isl, islandCtx)[0]
      if (!top || top.score < 0.45) continue
      const size = featOf(isl).s.length()
      if (!biggest || size > biggest.size) biggest = { size, role: top.role }
      const group = MATERIAL_GROUP[top.role]
      if (!groups.has(group)) groups.set(group, new Set())
      groups.get(group).add(top.role)
    }
    if (groups.size >= 2 && items.length > 1) {
      const roles = [...groups.values()].flatMap((s) => [...s])
      warnings.push({ type: 'merged', ids: [it.id], name: it.name, roles })
      // Its best single role is that of its biggest piece — but confidence is low.
      const g = guesses[it.id]
      if (g.source !== 'name' && biggest) {
        guesses[it.id] = {
          ...g,
          role: biggest.role,
          score: 0.35,
          level: 'low',
          reason: `contains several parts (${roles.join(' + ')}); mostly ${biggest.role}`,
          source: 'shape',
        }
      }
    }
  }
  if (items.length === 1) {
    warnings.push({ type: 'single', ids: [items[0].id], name: items[0].name, roles: [] })
  }

  const all = new THREE.Box3()
  items.forEach((it) => all.union(it.box))
  return {
    items,
    guesses,
    warnings,
    orientation: orient.quaternion,
    head: { center: orient.headCenter, radius: orient.radius },
    bounds: all,
    cues: orient.cues,
    stats: {
      meshes: items.length,
      vertices: items.reduce((n, it) => n + it.vertexCount, 0),
      triangles: items.reduce((n, it) => n + it.triangleCount, 0),
      textured: items.some((it) => materialsOf(it.mesh).some((m) => m.map || m.normalMap)),
    },
  }
}
