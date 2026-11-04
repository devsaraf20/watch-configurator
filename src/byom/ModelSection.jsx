import { useRef, useState } from 'react'
import { LARGE_FILE_BYTES, formatBytes } from './useCustomModel'

/**
 * "Model" section at the top of the options panel: a drop area / upload
 * button for the demo state, and a card for an uploaded model.
 */
export default function ModelSection({ custom, onCheckParts }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const browse = () => inputRef.current?.click()
  const onFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow choosing the same file again
    if (file) custom.load(file)
  }
  // The drop itself is handled by the page-wide drop target (App.jsx);
  // this only highlights the area while a file is dragged over it.
  const onDrop = () => setDragging(false)

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
      hidden
      onChange={onFile}
      data-testid="model-input"
    />
  )
  const large = custom.file && custom.file.size > LARGE_FILE_BYTES

  if (custom.status === 'ready') {
    const { analysis, roles, file } = custom
    const unsure = analysis.items.filter(
      (it) => !custom.manual.has(it.id) && analysis.guesses[it.id]?.level === 'low',
    ).length
    const merged = analysis.warnings.length
    return (
      <section className="section">
        <div className="section-head">
          <h2 className="section-label">Model</h2>
          <span className="section-value">Your upload</span>
        </div>
        {input}
        <div className="file-card">
          <div className="file-card-main">
            <ModelIcon />
            <div className="file-card-text">
              <strong title={file.name}>{file.name}</strong>
              <span>
                {formatBytes(file.size)} · {analysis.items.length} part{analysis.items.length === 1 ? '' : 's'}
                {!analysis.stats.textured && ' · untextured'}
              </span>
            </div>
          </div>
          {(unsure > 0 || merged > 0) && (
            <p className="file-card-status">
              {merged > 0 && `${merged} merged mesh${merged === 1 ? '' : 'es'} · `}
              {unsure > 0 ? `${unsure} part${unsure === 1 ? '' : 's'} to check` : 'parts need a look'}
            </p>
          )}
          {large && (
            <p className="alert alert--warn">
              Large file ({formatBytes(file.size)}). It may be slow on phones — consider compressing it
              (e.g. <code>npm run optimize-model</code> or Draco in Blender’s exporter).
            </p>
          )}
          <div className="file-card-actions">
            <button type="button" className="btn-secondary" onClick={onCheckParts}>
              Check parts
            </button>
            <button type="button" className="btn-ghost" onClick={browse}>
              Replace
            </button>
            <button type="button" className="btn-ghost" onClick={custom.reset}>
              Reset to demo
            </button>
          </div>
          <p className="fine-print">
            {Object.values(roles).filter((r) => r !== 'ignore').length} parts follow your options. Your
            choices are saved in this browser.
          </p>
        </div>
      </section>
    )
  }

  const loading = custom.status === 'loading'
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-label">Model</h2>
        <span className="section-value">Demo watch</span>
      </div>
      {input}
      <div
        className={`dropzone${dragging ? ' dropzone--over' : ''}${loading ? ' dropzone--busy' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <ModelIcon />
        {loading ? (
          <p className="dropzone-title">Loading {custom.file.name}…</p>
        ) : (
          <>
            <p className="dropzone-title">Bring your own watch</p>
            <p className="dropzone-text">
              Drop a <strong>.glb</strong> file here or
            </p>
            <button type="button" className="btn-secondary" onClick={browse}>
              Upload model
            </button>
            <p className="fine-print">Opens on your device — nothing is uploaded to a server.</p>
          </>
        )}
      </div>
      {custom.status === 'error' && (
        <div className="alert alert--error" role="alert">
          <p>{custom.error}</p>
          <button type="button" className="btn-link" onClick={custom.dismissError}>
            Dismiss
          </button>
        </div>
      )}
    </section>
  )
}

export function ModelIcon() {
  return (
    <svg className="model-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 3h6l.6 3.2M9 3l-.6 3.2M9 21h6l.6-3.2M9 21l-.6-3.2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 9v3l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
