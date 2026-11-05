import * as THREE from 'three'

/**
 * Shared building blocks for every export (image, 360° video, variants, banners).
 * `three` is { gl, scene, camera, controls } from React Three Fiber.
 */

/** The point the camera orbits around, and the default 3/4 product angle. */
export const TARGET = new THREE.Vector3(0, -0.1, -0.7)
export const VIEW_DIR = new THREE.Vector3(0.42, 0.16, 1).normalize()

/** Camera distance that fits the whole watch for a given image shape. */
export const defaultDistance = (aspect) => (aspect < 1 ? 10 / Math.max(0.5, aspect) ** 0.8 : 10.5)

/** The soft studio backdrop used by the page, painted onto a 2D canvas. */
export function paintStudioBackdrop(ctx, width, height) {
  const g = ctx.createRadialGradient(
    width / 2, height * 0.42, 0,
    width / 2, height * 0.42, Math.max(width, height) * 0.75,
  )
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.55, '#f1f0ed')
  g.addColorStop(1, '#dddbd6')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, width, height)
}

/** The same backdrop as a three.js texture (needed for video, where nothing is composited later). */
function studioTexture(width, height) {
  const c = document.createElement('canvas')
  c.width = Math.round(width / 4)
  c.height = Math.round(height / 4)
  paintStudioBackdrop(c.getContext('2d'), c.width, c.height)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * Temporarily switch the renderer to an export size and camera framing.
 * Returns a function that restores everything exactly as it was.
 *
 * view:
 *   'current'        – the camera exactly as the user left it
 *   'current-angle'  – the user's viewing angle, but zoomed to fit the whole watch
 *   'default'        – the standard 3/4 product angle
 * backdrop: 'none' (transparent) | 'texture' (drawn by WebGL, for video)
 * zoom:     < 1 moves the camera closer than the default framing
 */
export function beginExport(three, { width, height, view = 'current', backdrop = 'none', zoom = 1 }) {
  const { gl, scene, camera, controls } = three
  const saved = {
    size: gl.getSize(new THREE.Vector2()),
    ratio: gl.getPixelRatio(),
    aspect: camera.aspect,
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone(),
    target: controls?.target.clone(),
    enabled: controls?.enabled,
    damping: controls?.enableDamping,
    background: scene.background,
    hidden: [],
  }

  // Hide helpers such as the part highlight.
  scene.traverse((o) => {
    if (o.userData.noCapture && o.visible) {
      o.visible = false
      saved.hidden.push(o)
    }
  })

  if (controls) {
    controls.enabled = false
    controls.enableDamping = false
  }
  gl.setPixelRatio(1)
  gl.setSize(width, height, false) // keep the on-page CSS size
  camera.aspect = width / height
  camera.updateProjectionMatrix()

  if (view !== 'current') {
    const target = controls?.target ?? TARGET
    const dir = view === 'default' ? VIEW_DIR.clone() : camera.position.clone().sub(target).normalize()
    camera.position.copy(TARGET).addScaledVector(dir, defaultDistance(camera.aspect) * zoom)
    camera.lookAt(TARGET)
  }

  let texture = null
  if (backdrop === 'texture') {
    texture = studioTexture(width, height)
    scene.background = texture
  }

  return function restore() {
    scene.background = saved.background
    texture?.dispose()
    saved.hidden.forEach((o) => (o.visible = true))
    gl.setPixelRatio(saved.ratio)
    gl.setSize(saved.size.x, saved.size.y, false)
    camera.aspect = saved.aspect
    camera.position.copy(saved.position)
    camera.quaternion.copy(saved.quaternion)
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.copy(saved.target)
      controls.enabled = saved.enabled
      controls.enableDamping = saved.damping
      controls.update()
    }
  }
}

/**
 * Render one frame and copy it to a new 2D canvas.
 * backdrop: 'studio' paints the page's backdrop behind the (transparent) render.
 * Must run in one go: the WebGL buffer is only readable right after rendering.
 */
export function renderToCanvas({ gl, scene, camera }, { backdrop = 'studio' } = {}) {
  gl.render(scene, camera)
  const src = gl.domElement
  const out = document.createElement('canvas')
  out.width = src.width
  out.height = src.height
  const ctx = out.getContext('2d')
  if (backdrop === 'studio') paintStudioBackdrop(ctx, out.width, out.height)
  ctx.drawImage(src, 0, 0)
  return out
}

/** Trim a transparent render to its visible content (plus a little padding). */
export function cropToContent(canvas, { threshold = 24, padding = 0.02 } = {}) {
  const { width, height } = canvas
  const data = canvas.getContext('2d').getImageData(0, 0, width, height).data
  let x0 = width
  let y0 = height
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > threshold) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return canvas
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * padding)
  x0 = Math.max(0, x0 - pad)
  y0 = Math.max(0, y0 - pad)
  x1 = Math.min(width - 1, x1 + pad)
  y1 = Math.min(height - 1, y1 + pad)
  const out = document.createElement('canvas')
  out.width = x1 - x0 + 1
  out.height = y1 - y0 + 1
  out.getContext('2d').drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height)
  return out
}

export const canvasToBlob = (canvas, type = 'image/png', quality) =>
  new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image.'))), type, quality),
  )

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** "Polished Steel" → "polished-steel" */
export const slug = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Wait for the browser to paint (lets progress bars update between heavy steps). */
export const yieldToBrowser = () => new Promise((r) => setTimeout(r, 0))

export class ExportCancelled extends Error {
  constructor() {
    super('Export cancelled')
    this.name = 'ExportCancelled'
  }
}
