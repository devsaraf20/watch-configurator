import { useCallback, useEffect, useRef, useState } from 'react'
import { zipSync } from 'fflate'
import PanelTabs from './PanelTabs'
import { BANNER_FORMATS, drawBanner, ensureBannerFonts } from '../export/banners'
import { canvasToBlob, downloadBlob, slug } from '../export/capture'

const STORAGE_KEY = 'watch-configurator:banner:v1'
const MAX_STORED_LOGO = 1_500_000 // characters of data URL

function loadSaved() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) ?? null
  } catch {
    return null
  }
}
function save(fields, logoUrl) {
  try {
    const logo = logoUrl && logoUrl.length < MAX_STORED_LOGO ? logoUrl : null
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...fields, logo }))
  } catch {
    /* storage full or blocked: not remembered, nothing else breaks */
  }
}

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That image couldn’t be opened.'))
    img.src = src
  })

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(new Error('The file could not be read.'))
    r.readAsDataURL(file)
  })

/**
 * The "Banners" tab: enter product name, tagline, price and a logo, and get
 * 1:1, 4:5, 9:16 and 16:9 banners with the current watch render.
 */
export default function BannerPanel({ tab, onTab, captureWatch, defaultName }) {
  const saved = useRef(loadSaved()).current
  const [fields, setFields] = useState({
    name: saved?.name ?? defaultName,
    tagline: saved?.tagline ?? 'Automatic movement. Sapphire crystal. Made to be worn every day.',
    price: saved?.price ?? '€1,250',
    theme: saved?.theme ?? 'light',
  })
  const [logo, setLogo] = useState(null) // { img, url, name }
  const [logoError, setLogoError] = useState(null)
  const [watch, setWatch] = useState(null)
  const [fontsReady, setFontsReady] = useState(false)
  const [zipping, setZipping] = useState(false)
  const canvases = useRef({})
  const fileRef = useRef(null)

  const set = (key) => (e) => setFields((f) => ({ ...f, [key]: e.target.value }))

  const refreshWatch = useCallback(() => {
    try {
      setWatch(captureWatch())
    } catch (err) {
      console.error('[watch] Could not render the watch for banners:', err)
    }
  }, [captureWatch])

  // Render the watch from the current 3D view when the tab opens.
  useEffect(() => {
    refreshWatch()
    ensureBannerFonts().then(() => setFontsReady(true))
    if (saved?.logo) loadImage(saved.logo).then((img) => setLogo({ img, url: saved.logo, name: 'Saved logo' })).catch(() => {})
  }, [refreshWatch, saved])

  // Redraw the previews (debounced while typing) and remember the inputs.
  useEffect(() => {
    const id = setTimeout(() => {
      for (const f of BANNER_FORMATS) {
        const c = canvases.current[f.id]
        if (c) drawBanner(c, f, { ...fields, logo: logo?.img ?? null, watch })
      }
      save(fields, logo?.url)
    }, 120)
    return () => clearTimeout(id)
  }, [fields, logo, watch, fontsReady])

  const onLogo = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setLogoError(null)
    try {
      if (!/^image\//.test(file.type)) throw new Error('Please choose an image file (PNG, SVG, JPG or WebP).')
      const url = await readAsDataUrl(file)
      const img = await loadImage(url)
      setLogo({ img, url, name: file.name })
    } catch (err) {
      setLogoError(err.message)
    }
  }

  const fileBase = slug(fields.name || 'watch') || 'watch'
  const downloadOne = async (f) => downloadBlob(await canvasToBlob(canvases.current[f.id]), `${fileBase}-banner-${f.id}.png`)
  const downloadAll = async () => {
    setZipping(true)
    try {
      const files = {}
      for (const f of BANNER_FORMATS) {
        const blob = await canvasToBlob(canvases.current[f.id])
        files[`${fileBase}-banner-${f.id}-${f.width}x${f.height}.png`] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }]
      }
      downloadBlob(new Blob([zipSync(files)], { type: 'application/zip' }), `${fileBase}-banners.zip`)
    } finally {
      setZipping(false)
    }
  }

  return (
    <aside className="panel" aria-label="Banner generator">
      <header className="panel-header">
        <PanelTabs tab={tab} onChange={onTab} />
        <h1 className="title">Banners</h1>
        <p className="subtitle">Social and web banners in four sizes, using the watch as you’ve configured it.</p>
      </header>

      <div className="panel-body">
        <section className="section">
          <div className="banner-fields">
            <label className="field">
              <span>Product name</span>
              <input value={fields.name} onChange={set('name')} maxLength={60} placeholder="Signature 40" />
            </label>
            <label className="field">
              <span>Tagline</span>
              <textarea value={fields.tagline} onChange={set('tagline')} maxLength={140} rows={2} placeholder="A short line about the watch" />
            </label>
            <label className="field">
              <span>Price</span>
              <input value={fields.price} onChange={set('price')} maxLength={24} placeholder="€1,250" />
            </label>
            <div className="field">
              <span>Logo</span>
              <div className="logo-row">
                {logo ? (
                  <>
                    <img className="logo-thumb" src={logo.url} alt="" />
                    <span className="logo-name" title={logo.name}>{logo.name}</span>
                    <button type="button" className="btn-link" onClick={() => setLogo(null)}>
                      Remove
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
                    Upload logo
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" hidden onChange={onLogo} data-testid="logo-input" />
              </div>
              {logoError && <p className="alert alert--error">{logoError}</p>}
              <p className="fine-print">A transparent PNG or SVG works best.</p>
            </div>
            <div className="field">
              <span>Style</span>
              <div className="segmented segmented--small" role="radiogroup" aria-label="Banner style">
                {['light', 'dark'].map((t) => (
                  <button key={t} type="button" role="radio" aria-checked={fields.theme === t} className="segment" onClick={() => setFields((f) => ({ ...f, theme: t }))}>
                    {t === 'light' ? 'Light' : 'Dark'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h2 className="section-label">Watch image</h2>
            <button type="button" className="btn-link" onClick={refreshWatch}>
              Update from 3D view
            </button>
          </div>
          <p className="fine-print">Rotate the watch in the 3D view to choose the angle, then update. Change the options in the Configure tab.</p>
        </section>

        <section className="section">
          <div className="section-head">
            <h2 className="section-label">Preview</h2>
          </div>
          <div className="banner-grid">
            {BANNER_FORMATS.map((f) => (
              <figure key={f.id} className={`banner-card banner-card--${f.id}`}>
                <canvas
                  ref={(el) => (canvases.current[f.id] = el)}
                  className="banner-canvas"
                  width={f.width}
                  height={f.height}
                  style={{ aspectRatio: `${f.width} / ${f.height}` }}
                  aria-label={`${f.label} ${f.ratio} banner preview`}
                />
                <figcaption>
                  <span>
                    <strong>{f.ratio}</strong> {f.label}
                  </span>
                  <button type="button" className="btn-link" onClick={() => downloadOne(f)}>
                    PNG
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      </div>

      <footer className="panel-footer">
        <p className="summary">4 banners · 1080×1080, 1080×1350, 1080×1920, 1920×1080</p>
        <button type="button" className="btn-primary" onClick={downloadAll} disabled={zipping}>
          {zipping ? 'Preparing ZIP…' : 'Download banners (ZIP)'}
        </button>
      </footer>
    </aside>
  )
}
