import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import Scene from './components/Scene'
import ConfigPanel from './components/ConfigPanel'
import {
  CASE_MATERIALS,
  DEFAULT_CONFIG,
  DIAL_COLORS,
  STRAP_COLORS,
  STRAP_MATERIALS,
} from './config/options'

const LISTS = {
  caseMaterial: CASE_MATERIALS,
  dialColor: DIAL_COLORS,
  strapMaterial: STRAP_MATERIALS,
  strapColor: STRAP_COLORS,
}

/** Read a configuration from the URL (?case=gold&dial=onyx…) so builds can be shared. */
function configFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const keys = { caseMaterial: 'case', dialColor: 'dial', strapMaterial: 'strap', strapColor: 'color' }
  const config = { ...DEFAULT_CONFIG }
  for (const [key, param] of Object.entries(keys)) {
    const v = params.get(param)
    if (v && LISTS[key].some((o) => o.id === v)) config[key] = v
  }
  return config
}

function syncUrl(config) {
  const params = new URLSearchParams({
    case: config.caseMaterial,
    dial: config.dialColor,
    strap: config.strapMaterial,
    color: config.strapColor,
  })
  window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
}

export default function App() {
  const [config, setConfig] = useState(configFromUrl)
  const [downloading, setDownloading] = useState(false)
  const [interacted, setInteracted] = useState(false)
  const api = useRef(null)

  useEffect(() => syncUrl(config), [config])

  const handleDownload = async () => {
    if (!api.current) return
    setDownloading(true)
    try {
      await api.current.downloadImage()
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="app">
      <main className="viewer" onPointerDown={() => setInteracted(true)}>
        <Scene config={config} apiRef={api} />
        <Loader />
        <button
          type="button"
          className="icon-btn viewer-reset"
          onClick={() => api.current?.resetView()}
          aria-label="Reset view"
          title="Reset view"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <p className={`hint${interacted ? ' hint--hidden' : ''}`}>
          Drag to rotate · Pinch or scroll to zoom
        </p>
      </main>
      <ConfigPanel
        config={config}
        onChange={setConfig}
        onDownload={handleDownload}
        downloading={downloading}
      />
    </div>
  )
}

function Loader() {
  const { active, progress } = useProgress()
  if (!active) return null
  return (
    <div className="loader" role="status" aria-live="polite">
      <div className="loader-bar" style={{ transform: `scaleX(${progress / 100})` }} />
      <span className="loader-text">Loading model… {Math.round(progress)}%</span>
    </div>
  )
}
