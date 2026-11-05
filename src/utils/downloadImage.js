import { beginExport, canvasToBlob, downloadBlob, renderToCanvas } from '../export/capture'

/**
 * Render the current view at high resolution and download it as a PNG,
 * with the page's studio backdrop behind the watch.
 *
 * @param {object} three  { gl, scene, camera, controls } from React Three Fiber
 */
export async function downloadImage(three, { filename = 'my-watch.png', scale = 2 } = {}) {
  const { gl } = three
  const css = { w: gl.domElement.clientWidth || 1, h: gl.domElement.clientHeight || 1 }
  // At least 2× for a crisp image, capped to keep mobile GPUs happy.
  const ratio = Math.min(Math.max(gl.getPixelRatio(), scale), 3)
  const restore = beginExport(three, { width: Math.round(css.w * ratio), height: Math.round(css.h * ratio), view: 'current' })
  let canvas
  try {
    canvas = renderToCanvas(three, { backdrop: 'studio' })
  } finally {
    restore()
  }
  downloadBlob(await canvasToBlob(canvas), filename)
}
