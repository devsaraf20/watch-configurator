import { useMemo, useState } from 'react'
import { allVariants } from '../export/batch'
import { videoSupported } from '../export/turntable'

const SIZES = [
  { px: 800, label: '800 px', mbPerImage: 0.45 },
  { px: 1200, label: '1200 px', mbPerImage: 1.0 },
  { px: 2000, label: '2000 px', mbPerImage: 2.6 },
]
const isSmallScreen = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 900px)').matches

/** "Export" section: 360° video and all-variants ZIP. */
export default function ExportSection({ onRecordVideo, onExportVariants, busy }) {
  const [setupOpen, setSetupOpen] = useState(false)
  const [size, setSize] = useState(() => (isSmallScreen() ? 800 : 1200))
  const count = useMemo(() => allVariants().length, [])
  const video = useMemo(() => videoSupported(), [])
  const est = Math.round(count * SIZES.find((s) => s.px === size).mbPerImage)

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-label">Export</h2>
      </div>
      <div className="export-actions">
        <button type="button" className="btn-secondary" onClick={onRecordVideo} disabled={busy || !video}>
          <span className="rec-dot" aria-hidden="true" /> Record 360° video
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setSetupOpen((o) => !o)}
          disabled={busy}
          aria-expanded={setupOpen}
        >
          Export all variants
        </button>
      </div>
      <p className="fine-print">
        {video
          ? `Video: a 6-second turn from your current angle, up to 1920×1080, as MP4 (or WebM where MP4 isn’t available).`
          : 'Video recording isn’t supported in this browser.'}
      </p>

      {setupOpen && (
        <div className="batch-setup">
          <p className="batch-count">
            <strong>{count} images</strong> — every case, dial and strap combination, as PNGs in one ZIP.
          </p>
          <div className="segmented segmented--small" role="radiogroup" aria-label="Image size">
            {SIZES.map((s) => (
              <button
                key={s.px}
                type="button"
                role="radio"
                aria-checked={size === s.px}
                className="segment"
                onClick={() => setSize(s.px)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="fine-print">
            Square images, standard product angle. Roughly {est >= 1000 ? `${(est / 1000).toFixed(1)} GB` : `${est} MB`}.
            Keep this tab open until it finishes.
          </p>
          <div className="export-actions">
            <button type="button" className="btn-primary btn-primary--small" onClick={() => onExportVariants(size)} disabled={busy}>
              Start export
            </button>
            <button type="button" className="btn-ghost" onClick={() => setSetupOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
