import {
  CASE_MATERIALS,
  DIAL_COLORS,
  STRAP_COLORS,
  STRAP_MATERIALS,
  resolveConfig,
} from '../config/options'

// Shown at the top of the panel — rename to your own product.
const PRODUCT_NAME = 'Signature 40'
const PRODUCT_SUBTITLE = '40 mm automatic · sapphire crystal'

/** The side panel (bottom sheet on mobile) with every option. */
export default function ConfigPanel({ config, onChange, onDownload, downloading }) {
  const r = resolveConfig(config)
  const set = (key) => (value) => onChange({ ...config, [key]: value })
  const strapIsMetal = r.strapMaterial.matchesCase

  return (
    <aside className="panel" aria-label="Watch options">
      <header className="panel-header">
        <p className="eyebrow">Configurator</p>
        <h1 className="title">{PRODUCT_NAME}</h1>
        <p className="subtitle">{PRODUCT_SUBTITLE}</p>
      </header>

      <div className="panel-body">
        <Section label="Case" value={r.caseMaterial.label}>
          <div className="tiles" role="radiogroup" aria-label="Case material">
            {CASE_MATERIALS.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={config.caseMaterial === m.id}
                className="tile"
                onClick={() => set('caseMaterial')(m.id)}
              >
                <span className="tile-swatch" style={{ background: m.swatch }} />
                <span className="tile-label">{m.label}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section label="Dial" value={r.dialColor.label}>
          <Swatches
            label="Dial colour"
            options={DIAL_COLORS}
            value={config.dialColor}
            onChange={set('dialColor')}
            sunburst
          />
        </Section>

        <Section label="Strap" value={r.strapMaterial.label}>
          <div className="segmented" role="radiogroup" aria-label="Strap material">
            {STRAP_MATERIALS.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={config.strapMaterial === m.id}
                className="segment"
                onClick={() => set('strapMaterial')(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </Section>

        <Section
          label="Strap colour"
          value={strapIsMetal ? r.caseMaterial.label : r.strapColor.label}
        >
          {strapIsMetal ? (
            <p className="note">The bracelet is finished to match the case.</p>
          ) : (
            <Swatches
              label="Strap colour"
              options={STRAP_COLORS}
              value={config.strapColor}
              onChange={set('strapColor')}
            />
          )}
        </Section>
      </div>

      <footer className="panel-footer">
        <p className="summary">
          {r.caseMaterial.label} · {r.dialColor.label} dial ·{' '}
          {strapIsMetal ? 'Bracelet' : `${r.strapColor.label} ${r.strapMaterial.label.toLowerCase()}`}
        </p>
        <button type="button" className="btn-primary" onClick={onDownload} disabled={downloading}>
          <DownloadIcon />
          {downloading ? 'Preparing image…' : 'Download image'}
        </button>
      </footer>
    </aside>
  )
}

function Section({ label, value, children }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-label">{label}</h2>
        <span className="section-value">{value}</span>
      </div>
      {children}
    </section>
  )
}

function Swatches({ label, options, value, onChange, sunburst = false }) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          aria-label={o.label}
          title={o.label}
          className={`swatch${sunburst ? ' swatch--sunburst' : ''}`}
          style={{ '--swatch': o.color }}
          onClick={() => onChange(o.id)}
        />
      ))}
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
