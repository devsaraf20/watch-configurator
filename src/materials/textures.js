import * as THREE from 'three'

/**
 * Small procedural textures for the placeholder watch, generated once in
 * the browser — no image files to download.
 *
 * Every map is built from a height field and converted into a normal map,
 * which behaves consistently across devices.
 */

const cache = new Map()
const memo = (key, make) => {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key)
}

/** Deterministic pseudo-random numbers so textures look the same every load. */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dataTexture(data, width, height, { srgb = false } = {}) {
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 8
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}

/** Convert a tileable height field (0..1) into a tangent-space normal map. */
function heightToNormal(height, w, h, strength = 2) {
  const data = new Uint8Array(w * h * 4)
  const at = (x, y) => height[((y + h) % h) * w + ((x + w) % w)]
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const len = Math.hypot(dx, dy, 1)
      const i = (y * w + x) * 4
      data[i] = ((-dx / len) * 0.5 + 0.5) * 255
      data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255
      data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255
      data[i + 3] = 255
    }
  }
  return dataTexture(data, w, h)
}

/** Tileable cellular (Voronoi) noise — gives a pebbled leather grain. */
function cellular(w, h, cells, seed) {
  const rand = rng(seed)
  const pts = []
  for (let j = 0; j < cells; j++)
    for (let i = 0; i < cells; i++) pts.push([(i + rand()) / cells, (j + rand()) / cells])
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w
      const v = y / h
      const ci = Math.floor(u * cells)
      const cj = Math.floor(v * cells)
      let d1 = 9
      let d2 = 9
      for (let oj = -1; oj <= 1; oj++) {
        for (let oi = -1; oi <= 1; oi++) {
          const ii = (ci + oi + cells) % cells
          const jj = (cj + oj + cells) % cells
          const p = pts[jj * cells + ii]
          // shift wrapped neighbours so the texture tiles seamlessly
          const wx = p[0] + (ci + oi - ii) / cells
          const wy = p[1] + (cj + oj - jj) / cells
          const d = Math.hypot(u - wx, v - wy)
          if (d < d1) {
            d2 = d1
            d1 = d
          } else if (d < d2) d2 = d
        }
      }
      // Distance to the cell border: high in the middle of a pebble, 0 at the creases.
      out[y * w + x] = Math.min(1, (d2 - d1) * cells * 1.6)
    }
  }
  return out
}

/** Leather: pebbled grain + a row of stitches along both edges. */
export function getLeatherNormal() {
  return memo('leather', () => {
    const w = 512
    const h = 512
    const height = cellular(w, h, 44, 7)
    for (let i = 0; i < height.length; i++) height[i] = Math.sqrt(height[i]) * 0.6
    // Stitches: 16 per tile, near u = 0.075 and u = 0.925.
    const stitches = 16
    for (let y = 0; y < h; y++) {
      const t = ((y / h) * stitches) % 1
      const inStitch = t > 0.18 && t < 0.82
      for (const cu of [0.075, 0.925]) {
        const cx = cu * w
        for (let x = Math.floor(cx - 9); x <= Math.ceil(cx + 9); x++) {
          const d = Math.abs(x - cx)
          const i = y * w + x
          if (inStitch && d < 4.5) {
            // raised, rounded thread
            const s = Math.sin(Math.PI * (t - 0.18) / 0.64)
            height[i] = 0.75 + 0.35 * Math.sqrt(Math.max(0, 1 - (d / 4.5) ** 2)) * s
          } else if (d < 9) {
            // slight groove the thread sits in
            height[i] = Math.min(height[i], 0.32 + d * 0.03)
          }
        }
      }
    }
    return heightToNormal(height, w, h, 3)
  })
}

/** Rubber: very fine, soft texture. */
export function getRubberNormal() {
  return memo('rubber', () => {
    const w = 256
    const h = 256
    const height = cellular(w, h, 64, 3)
    for (let i = 0; i < height.length; i++) height[i] *= 0.15
    return heightToNormal(height, w, h, 2)
  })
}

/**
 * Metal bracelet: one row of a three-piece link (polished centre,
 * brushed outer links). Returns a normal map and a roughness map.
 */
export function getLinkMaps() {
  return memo('links', () => {
    const w = 256
    const h = 128
    const height = new Float32Array(w * h)
    const rough = new Uint8Array(w * h * 4)
    const cols = [0, 0.3, 0.7, 1]
    const rand = rng(11)
    for (let y = 0; y < h; y++) {
      const v = y / h
      for (let x = 0; x < w; x++) {
        const u = x / w
        const c = u < cols[1] ? 0 : u < cols[2] ? 1 : 2
        const u0 = cols[c]
        const u1 = cols[c + 1]
        // The centre link is offset half a row, like a real three-link bracelet.
        const vv = c === 1 ? (v + 0.5) % 1 : v
        const du = Math.min(u - u0, u1 - u) / 0.02
        const dv = Math.min(vv, 1 - vv) / 0.06
        const edge = Math.min(1, du, dv)
        const bevel = Math.sin(Math.min(1, edge) * Math.PI * 0.5)
        height[y * w + x] = bevel * (c === 1 ? 1 : 0.9)
        // roughness (green channel): centre polished, outer links brushed
        const brushed = c !== 1
        const r = brushed ? 0.95 + (rand() - 0.5) * 0.25 : 0.3
        const i = (y * w + x) * 4
        rough[i] = rough[i + 1] = rough[i + 2] = Math.max(0, Math.min(255, r * 255))
        rough[i + 3] = 255
      }
    }
    return {
      normalMap: heightToNormal(height, w, h, 6),
      roughnessMap: dataTexture(rough, w, h),
    }
  })
}

/**
 * Sunburst dial: anisotropy directions that radiate from the centre,
 * so the light streaks across the dial like on a real brushed dial.
 */
export function getSunburstAnisotropy() {
  return memo('sunburst', () => {
    const s = 512
    const data = new Uint8Array(s * s * 4)
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const dx = x / s - 0.5
        const dy = y / s - 0.5
        const r = Math.hypot(dx, dy) || 1e-6
        const i = (y * s + x) * 4
        // Brushing runs around the centre (tangential), which produces radial highlights.
        data[i] = (-dy / r) * 127.5 + 127.5
        data[i + 1] = (dx / r) * 127.5 + 127.5
        data[i + 2] = Math.min(1, r * 14) * 255 // fade out at the very centre
        data[i + 3] = 255
      }
    }
    const tex = dataTexture(data, s, s)
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    return tex
  })
}

/** White minute track printed on the dial (tinted by the material colour). */
export function getDialPrint() {
  return memo('dialPrint', () => {
    const s = 1024
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = s
    const ctx = canvas.getContext('2d')
    const c = s / 2
    ctx.translate(c, c)
    ctx.strokeStyle = '#fff'
    ctx.fillStyle = '#fff'
    // Outer rings of the minute track
    ctx.lineWidth = 2.2
    for (const r of [0.47, 0.435]) {
      ctx.beginPath()
      ctx.arc(0, 0, r * s, 0, Math.PI * 2)
      ctx.stroke()
    }
    // Minute ticks
    for (let i = 0; i < 60; i++) {
      if (i % 5 === 0) continue
      const a = (i / 60) * Math.PI * 2
      ctx.save()
      ctx.rotate(a)
      ctx.fillRect(-1.6, -0.47 * s, 3.2, 0.035 * s)
      ctx.restore()
    }
    // Small text above 6 o'clock
    ctx.font = `500 ${s * 0.024}px Inter, Helvetica, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${s * 0.006}px`
    ctx.fillText('AUTOMATIC', 0, s * 0.22)
    ctx.font = `400 ${s * 0.016}px Inter, Helvetica, Arial, sans-serif`
    ctx.fillText('100 M  ·  330 FT', 0, s * 0.255)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return tex
  })
}
