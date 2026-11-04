/**
 * Render the current view at high resolution and download it as a PNG.
 * The 3D canvas is transparent, so we paint the same soft studio backdrop
 * the page uses behind it.
 *
 * @param {object} three  { gl, scene, camera } from React Three Fiber
 */
export async function downloadImage({ gl, scene, camera }, { filename = 'my-watch.png', scale = 2 } = {}) {
  // Hide helpers such as the part highlight while capturing.
  const hidden = []
  scene.traverse((o) => {
    if (o.userData.noCapture && o.visible) {
      o.visible = false
      hidden.push(o)
    }
  })
  const prevRatio = gl.getPixelRatio()
  // Render at (at least) 2× for a crisp image, capped to keep mobile GPUs happy.
  const ratio = Math.min(Math.max(prevRatio, scale), 3)
  gl.setPixelRatio(ratio)
  gl.render(scene, camera)

  const src = gl.domElement
  const out = document.createElement('canvas')
  out.width = src.width
  out.height = src.height
  const ctx = out.getContext('2d')
  const g = ctx.createRadialGradient(
    out.width / 2, out.height * 0.42, 0,
    out.width / 2, out.height * 0.42, Math.max(out.width, out.height) * 0.75,
  )
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.55, '#f1f0ed')
  g.addColorStop(1, '#dddbd6')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, out.width, out.height)
  // Must be read in the same task as the render (no preserveDrawingBuffer needed).
  ctx.drawImage(src, 0, 0)

  gl.setPixelRatio(prevRatio)
  hidden.forEach((o) => (o.visible = true))
  gl.render(scene, camera)

  const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/png'))
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
