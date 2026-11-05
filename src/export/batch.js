import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from 'fflate'
import { CASE_MATERIALS, DIAL_COLORS, STRAP_COLORS, STRAP_MATERIALS } from '../config/options'
import { ExportCancelled, beginExport, canvasToBlob, renderToCanvas, slug, yieldToBrowser } from './capture'

/**
 * "Export all variants": every case × dial × strap combination as a PNG,
 * streamed into a ZIP so hundreds of images don't all sit in memory at once.
 */

/** Every combination, with a descriptive file name. Metal bracelets have no colour of their own. */
export function allVariants() {
  const list = []
  for (const c of CASE_MATERIALS) {
    for (const d of DIAL_COLORS) {
      for (const s of STRAP_MATERIALS) {
        const colours = s.matchesCase ? [null] : STRAP_COLORS
        for (const col of colours) {
          const strap = col ? `${col.label} ${s.label}` : `${c.label} ${s.label === 'Metal' ? 'bracelet' : s.label}`
          list.push({
            config: { caseMaterial: c.id, dialColor: d.id, strapMaterial: s.id, strapColor: col?.id ?? STRAP_COLORS[0].id },
            caseLabel: c.label,
            dialLabel: d.label,
            strapLabel: strap,
          })
        }
      }
    }
  }
  const digits = String(list.length).length
  list.forEach((v, i) => {
    v.file = `${String(i + 1).padStart(digits, '0')}_${slug(v.caseLabel)}_${slug(v.dialLabel)}-dial_${slug(v.strapLabel)}${
      v.strapLabel.endsWith('bracelet') ? '' : '-strap'
    }.png`
  })
  return list
}

const csvCell = (s) => `"${String(s).replace(/"/g, '""')}"`

/**
 * @param three        { gl, scene, camera, controls, advance }
 * @param applyConfig  synchronously switches the watch to a configuration
 */
export async function exportVariants(three, applyConfig, { size = 1200, onProgress, signal } = {}) {
  const variants = allVariants()
  const parts = []
  let resolveZip
  let rejectZip
  const zipDone = new Promise((res, rej) => ((resolveZip = res), (rejectZip = rej)))
  const zip = new Zip((err, chunk, final) => {
    if (err) return rejectZip(err)
    parts.push(new Blob([chunk])) // let the browser keep finished parts out of JS memory
    if (final) resolveZip()
  })

  const restore = beginExport(three, { width: size, height: size, view: 'default', zoom: 0.92 })
  try {
    const started = performance.now()
    for (let i = 0; i < variants.length; i++) {
      if (signal?.aborted) throw new ExportCancelled()
      const v = variants[i]
      applyConfig(v.config)
      // Step two frames by hand: materials snap to the new options, even if the tab is in the background.
      three.advance(performance.now())
      three.advance(performance.now())
      const canvas = renderToCanvas(three, { backdrop: 'studio' })
      const png = new Uint8Array(await (await canvasToBlob(canvas)).arrayBuffer())
      const entry = new ZipPassThrough(v.file) // PNGs are already compressed
      zip.add(entry)
      entry.push(png, true)
      const elapsed = performance.now() - started
      onProgress?.({ done: i + 1, total: variants.length, etaMs: (elapsed / (i + 1)) * (variants.length - i - 1) })
      await yieldToBrowser()
    }
    const manifest = new ZipDeflate('variants.csv', { level: 6 })
    zip.add(manifest)
    manifest.push(
      strToU8(
        ['file,case,dial,strap', ...variants.map((v) => [v.file, v.caseLabel, v.dialLabel, v.strapLabel].map(csvCell).join(','))].join('\n'),
      ),
      true,
    )
    zip.end()
    await zipDone
    return new Blob(parts, { type: 'application/zip' })
  } catch (err) {
    zip.terminate()
    throw err
  } finally {
    restore()
  }
}
