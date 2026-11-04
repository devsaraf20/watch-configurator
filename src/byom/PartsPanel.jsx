import { useEffect, useMemo, useRef, useState } from 'react'
import { ROLES, roleLabel } from './roles'

const LEVEL_LABEL = { high: 'High', medium: 'Medium', low: 'Low' }

/**
 * "Check your parts": every mesh of the uploaded model with its detected
 * role and confidence. Click a row (or the mesh in 3D) to highlight it and
 * choose its role; the watch updates live.
 */
export default function PartsPanel({ custom, selectedId, onSelect, onHover, onDone }) {
  const { analysis, roles, manual, file, restored } = custom
  const [onlyUnsure, setOnlyUnsure] = useState(false)
  const listRef = useRef(null)

  // Keep the selected row in view when it was picked in the 3D view.
  useEffect(() => {
    if (!selectedId) return
    const row = listRef.current?.querySelector(`[data-id="${CSS.escape(selectedId)}"]`)
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId])

  const rows = useMemo(
    () =>
      analysis.items.map((it) => {
        const guess = analysis.guesses[it.id]
        const role = roles[it.id]
        const isManual = manual.has(it.id)
        // Confidence describes the automatic guess; once you choose, it's yours.
        const badge = isManual
          ? role === guess.role
            ? { level: guess.level, text: LEVEL_LABEL[guess.level] }
            : { level: 'user', text: 'Set by you' }
          : { level: guess.level, text: LEVEL_LABEL[guess.level] }
        const merged = analysis.warnings.find((w) => w.type === 'merged' && w.ids.includes(it.id))
        return { it, guess, role, badge, merged, unsure: !isManual && guess.level === 'low' }
      }),
    [analysis, roles, manual],
  )
  const unsureCount = rows.filter((r) => r.unsure).length
  const shown = onlyUnsure ? rows.filter((r) => r.unsure || r.it.id === selectedId) : rows

  return (
    <aside className="panel panel--parts" aria-label="Check your parts">
      <header className="panel-header parts-header">
        <button type="button" className="btn-link back-link" onClick={onDone}>
          ← Back to options
        </button>
        <h1 className="title">Check your parts</h1>
        <p className="subtitle subtitle--desktop">
          Click a part in the 3D view or in the list to highlight it, then choose what it is. Colours update
          as you go. Click again in 3D to select what’s behind (e.g. the dial under the glass).
        </p>
        <p className="subtitle subtitle--mobile">Tap a part in 3D or in the list, then choose what it is.</p>
      </header>

      <div className="panel-body">
        <section className="section">
          <div className="section-head">
            <h2 className="section-label">Orientation</h2>
            <span className="section-value">Dial facing you, 12 at the top</span>
          </div>
          <div className="orient-buttons">
            <button type="button" className="btn-secondary" onClick={() => custom.rotate('z', -Math.PI / 2)} title="Spin the dial 90° clockwise">
              ↻ Rotate 90°
            </button>
            <button type="button" className="btn-secondary" onClick={() => custom.rotate('x', Math.PI / 2)} title="Tip the watch forward 90°">
              ⤓ Tilt 90°
            </button>
            <button type="button" className="btn-secondary" onClick={() => custom.rotate('y', Math.PI)} title="Turn the watch around">
              ⇄ Flip
            </button>
            <button type="button" className="btn-ghost" onClick={custom.resetOrientation}>
              Auto
            </button>
          </div>
        </section>

        {analysis.warnings.map((w) => (
          <MergedWarning key={w.type + w.ids[0]} warning={w} onSelect={() => onSelect(w.ids[0])} />
        ))}

        {restored && (
          <p className="alert alert--info">
            Restored your saved choices for <strong>{file.name}</strong>.{' '}
            <button type="button" className="btn-link" onClick={custom.redetect}>
              Start over
            </button>
          </p>
        )}

        <section className="section">
          <div className="section-head">
            <h2 className="section-label">Parts ({rows.length})</h2>
            <label className="toggle">
              <input type="checkbox" checked={onlyUnsure} onChange={(e) => setOnlyUnsure(e.target.checked)} />
              Only uncertain ({unsureCount})
            </label>
          </div>
          <ul className="parts-list" ref={listRef}>
            {shown.map(({ it, guess, role, badge, merged }) => (
              <li
                key={it.id}
                data-id={it.id}
                className={`part-row${it.id === selectedId ? ' part-row--selected' : ''}`}
                onMouseEnter={() => onHover(it.id)}
                onMouseLeave={() => onHover(null)}
              >
                <button type="button" className="part-pick" onClick={() => onSelect(it.id)} aria-pressed={it.id === selectedId}>
                  <span className={`conf conf--${badge.level}`} title={`Confidence: ${badge.text}`}>
                    {badge.text}
                  </span>
                  <span className="part-name" title={it.name}>
                    {merged && <span className="merged-flag" title="Several parts in one mesh">⚠ </span>}
                    {it.name}
                  </span>
                  <span className="part-reason">
                    {guess.reason}
                    {it.materialName ? ` · material “${it.materialName}”` : ''}
                  </span>
                </button>
                <select
                  className="part-role"
                  value={role}
                  aria-label={`Role of ${it.name}`}
                  onChange={(e) => {
                    custom.setRole(it.id, e.target.value)
                    onSelect(it.id)
                  }}
                >
                  {ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="panel-footer">
        <p className="summary">Saved automatically in this browser for “{file.name}”.</p>
        <button type="button" className="btn-primary" onClick={onDone}>
          Done
        </button>
      </footer>
    </aside>
  )
}

function MergedWarning({ warning, onSelect }) {
  if (warning.type === 'single') {
    return (
      <div className="alert alert--warn" role="alert">
        <p>
          <strong>The whole watch is one mesh</strong>, so it can only have one material and the options
          can’t colour the case, dial and strap separately.
        </p>
        <p>
          Split it into parts in your 3D software and re-export. In Blender: select it, press <kbd>Tab</kbd>,
          hover over each part and press <kbd>L</kbd> to select it, then <kbd>P</kbd> → <em>Selection</em>.
        </p>
      </div>
    )
  }
  const parts = warning.roles.map(roleLabel).map((s) => s.toLowerCase())
  return (
    <div className="alert alert--warn" role="alert">
      <p>
        <button type="button" className="btn-link" onClick={onSelect}>
          “{warning.name}”
        </button>{' '}
        looks like <strong>{parts.join(' + ')}</strong> merged into one mesh. They can only share one
        material.
      </p>
      <p>
        To fix it, split it in your 3D software and re-export. In Blender: select it, press <kbd>Tab</kbd>,
        hover over the {parts[1] ?? 'second part'} and press <kbd>L</kbd> (repeat for each piece), then{' '}
        <kbd>P</kbd> → <em>Selection</em>.
      </p>
    </div>
  )
}
