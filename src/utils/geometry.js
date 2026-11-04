import * as THREE from 'three'

/**
 * Geometry helpers for the placeholder watch.
 * Units: 1 unit ≈ 20 mm (the case is 2 units / 40 mm across).
 * The watch stands upright: dial faces +Z, 12 o'clock points to +Y.
 */

/** Case body: a lathe (turned) profile — caseback, mid-case and bezel in one piece. */
export function createCaseGeometry() {
  // [radius, height along the watch axis]  (from the caseback, around the side, up to the bezel)
  const profile = [
    [0.0, -0.37],
    [0.62, -0.37],
    [0.7, -0.355],
    [0.74, -0.33],
    [0.86, -0.325],
    [0.94, -0.3],
    [0.995, -0.25],
    [1.03, -0.17],
    [1.045, -0.06],
    [1.045, 0.03],
    [1.03, 0.09],
    [1.0, 0.115],
    // bezel
    [0.985, 0.13],
    [0.97, 0.165],
    [0.94, 0.19],
    [0.9, 0.2],
    [0.875, 0.195],
    [0.862, 0.18],
    // inner wall down to the dial
    [0.85, 0.12],
    [0.845, 0.04],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  const geo = new THREE.LatheGeometry(profile, 160)
  geo.rotateX(Math.PI / 2) // lathe axis Y → Z
  return geo
}

/** Domed sapphire crystal. */
export function createGlassGeometry(radius = 0.872, dome = 0.045) {
  const R = (radius * radius + dome * dome) / (2 * dome)
  const theta = Math.asin(radius / R)
  const geo = new THREE.SphereGeometry(R, 96, 12, 0, Math.PI * 2, 0, theta)
  geo.rotateX(Math.PI / 2)
  geo.translate(0, 0, -R)
  return geo
}

/** Watch hand outline pointing to +Y, pivot at the origin. */
export function createHandGeometry({ length, width, tail = 0.1, tip = 0.08, depth = 0.012 }) {
  const s = new THREE.Shape()
  const hw = width / 2
  s.moveTo(-hw * 0.7, -tail)
  s.lineTo(-hw, length - tip)
  s.lineTo(0, length)
  s.lineTo(hw, length - tip)
  s.lineTo(hw * 0.7, -tail)
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 4,
  })
  return geo
}

export function createSecondHandGeometry() {
  const s = new THREE.Shape()
  const hw = 0.0065
  s.moveTo(-hw, -0.2)
  s.lineTo(-hw * 0.6, 0.74)
  s.lineTo(hw * 0.6, 0.74)
  s.lineTo(hw, -0.2)
  s.closePath()
  const counterweight = new THREE.Shape()
  counterweight.absarc(0, -0.17, 0.028, 0, Math.PI * 2, false)
  const opts = { depth: 0.006, bevelEnabled: false, curveSegments: 24 }
  const a = new THREE.ExtrudeGeometry(s, opts)
  const b = new THREE.ExtrudeGeometry(counterweight, opts)
  return mergeSimple([a, b])
}

/** Merge non-indexed-compatible geometries (position/normal/uv only). */
function mergeSimple(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g))
  const merged = new THREE.BufferGeometry()
  for (const name of ['position', 'normal', 'uv']) {
    const arrays = parts.map((g) => g.attributes[name].array)
    const len = arrays.reduce((n, a) => n + a.length, 0)
    const out = new Float32Array(len)
    let o = 0
    for (const a of arrays) {
      out.set(a, o)
      o += a.length
    }
    merged.setAttribute(name, new THREE.BufferAttribute(out, parts[0].attributes[name].itemSize))
  }
  return merged
}

/**
 * The strap: a rounded-rectangle profile swept along a loop that starts in
 * the top lugs, wraps round an imaginary wrist and comes back into the bottom
 * lugs. UVs: u runs across the strap (0..1), v along it in strap-widths, so
 * the generated textures keep a constant scale.
 */
export function createStrapGeometry({
  width = 0.98,
  thickness = 0.1,
  taper = 0.16,
  lengthSegments = 220,
  profileSegments = 28,
} = {}) {
  // Half the loop (top lug → back), mirrored for the other half.
  const half = [
    [0.9, -0.13],
    [1.25, -0.16],
    [1.58, -0.36],
    [1.8, -0.78],
    [1.86, -1.3],
    [1.68, -1.82],
    [1.12, -2.2],
    [0.0, -2.36],
  ]
  const pts = [
    ...half.map(([y, z]) => new THREE.Vector3(0, y, z)),
    ...half
      .slice(0, -1)
      .reverse()
      .map(([y, z]) => new THREE.Vector3(0, -y, z)),
  ]
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
  const length = curve.getLength()

  // Rounded-rectangle (superellipse) cross-section: [x, n] pairs, unit size.
  const profile = []
  for (let i = 0; i < profileSegments; i++) {
    const a = (i / profileSegments) * Math.PI * 2
    const c = Math.cos(a)
    const s = Math.sin(a)
    const p = 0.28 // smaller → boxier
    profile.push([Math.sign(c) * Math.abs(c) ** p, Math.sign(s) * Math.abs(s) ** p])
  }

  const positions = []
  const uvs = []
  const indices = []
  const P = new THREE.Vector3()
  const T = new THREE.Vector3()
  const N = new THREE.Vector3()
  for (let i = 0; i <= lengthSegments; i++) {
    const t = i / lengthSegments
    curve.getPointAt(t, P)
    curve.getTangentAt(t, T)
    // normal in the YZ plane, pointing away from the wrist
    N.set(0, T.z, -T.y).normalize()
    const w = width * (1 - taper * Math.sin(Math.PI * t))
    for (const [px, pn] of profile) {
      const x = (px * w) / 2
      const n = (pn * thickness) / 2
      positions.push(x, P.y + N.y * n, P.z + N.z * n)
      uvs.push(px * 0.5 + 0.5, (t * length) / width)
    }
  }
  const ring = profileSegments
  for (let i = 0; i < lengthSegments; i++) {
    for (let j = 0; j < ring; j++) {
      const a = i * ring + j
      const b = i * ring + ((j + 1) % ring)
      const c = (i + 1) * ring + j
      const d = (i + 1) * ring + ((j + 1) % ring)
      indices.push(a, c, b, b, c, d)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return { geometry: geo, curve }
}
