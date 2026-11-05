import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useProgress } from '@react-three/drei'
import Scene from './components/Scene'
import ConfigPanel, { PRODUCT_NAME } from './components/ConfigPanel'
import ErrorBoundary from './components/ErrorBoundary'
import BannerPanel from './components/BannerPanel'
import ExportSection from './components/ExportSection'
import JobOverlay from './components/JobOverlay'
import { ExportCancelled, downloadBlob, slug } from './export/capture'
import { setMaterialSnap } from './materials/useWatchMaterials'
import ModelSection from './byom/ModelSection'
import PartsPanel from './byom/PartsPanel'
import { LARGE_FILE_BYTES, formatBytes, useCustomModel } from './byom/useCustomModel'
import {
  CASE_MATERIALS,
  DEFAULT_CONFIG,
  DIAL_COLORS,
  STRAP_COLORS,
  STRAP_MATERIALS,
  resolveConfig,
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
  try {
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
  } catch {
    // Some browsers throttle very frequent URL updates; the URL is a convenience only.
  }
}

const formatEta = (ms) => {
  const s = Math.max(1, Math.round(ms / 1000))
  return s < 60 ? `${s} s left` : `${Math.floor(s / 60)} min ${s % 60} s left`
}

export default function App() {
  const [config, setConfig] = useState(configFromUrl)
  const [downloading, setDownloading] = useState(false)
  const [interacted, setInteracted] = useState(false)
  const api = useRef(null)
  const custom = useCustomModel()
  const [view, setView] = useState('options') // 'options' | 'parts'
  const [selectedId, setSelectedId] = useState(null)
  const [hoverId, setHoverId] = useState(null)
  const [tab, setTab] = useState('configure') // 'configure' | 'banners'
  const [job, setJob] = useState(null) // running export: { title, progress, detail, cancel }
  const [notice, setNotice] = useState(null)
  const jobRunning = useRef(false)

  // Keep the URL in sync — but not while the batch export flips through hundreds of variants.
  useEffect(() => {
    if (!jobRunning.current) syncUrl(config)
  }, [config])

  // A freshly uploaded model opens the "Check your parts" step; leaving
  // the upload (reset / error) goes back to the options.
  const scene = custom.status === 'ready' ? custom.scene : null
  useEffect(() => {
    setSelectedId(null)
    setHoverId(null)
    setView(scene ? 'parts' : 'options')
    api.current?.resetView()
  }, [scene])
  const partsOpen = view === 'parts' && custom.status === 'ready'

  /** Run a long export with the progress overlay; handles cancel and errors. */
  const runJob = async (title, work) => {
    const controller = new AbortController()
    jobRunning.current = true
    setNotice(null)
    setJob({
      title,
      progress: 0,
      detail: 'Starting…',
      cancel: () => {
        controller.abort()
        setJob((j) => j && { ...j, cancelling: true })
      },
    })
    try {
      await work(controller.signal, (patch) => setJob((j) => j && { ...j, ...patch }))
    } catch (err) {
      if (!(err instanceof ExportCancelled)) {
        console.error(`[watch] ${title} failed:`, err)
        setNotice({ type: 'error', text: err?.message ?? String(err) })
      }
    } finally {
      jobRunning.current = false
      setJob(null)
    }
  }

  const describe = (c) => {
    const r = resolveConfig(c)
    return `${slug(r.caseMaterial.label)}_${slug(r.dialColor.label)}-dial_${
      r.strapMaterial.matchesCase ? 'bracelet' : `${slug(r.strapColor.label)}-${slug(r.strapMaterial.label)}`
    }`
  }

  const recordVideo = () =>
    runJob('Recording 360° video', async (signal, update) => {
      update({ detail: 'Preparing…' })
      let last = 0
      const result = await api.current.recordTurntable({
        seconds: 6,
        signal,
        onProgress: (t) => {
          const now = performance.now()
          if (now - last < 100 && t < 1) return // ~10 updates a second is plenty
          last = now
          update({ progress: t, detail: `Rendering the turn… ${Math.round(t * 100)}%` })
        },
      })
      update({ progress: 1, detail: 'Saving video…' })
      downloadBlob(result.blob, `watch-360_${describe(config)}_${result.height}p.${result.ext}`)
      setNotice({ type: 'info', text: `Saved a ${result.width}×${result.height} ${result.ext.toUpperCase()} video.` })
    })

  const exportAll = (size) =>
    runJob('Exporting all variants', async (signal, update) => {
      const original = config
      setMaterialSnap(true)
      try {
        const zip = await api.current.exportVariants((c) => flushSync(() => setConfig(c)), {
          size,
          signal,
          onProgress: ({ done, total, etaMs }) =>
            update({ progress: done / total, detail: `${done} of ${total} images · ${formatEta(etaMs)}` }),
        })
        update({ progress: 1, detail: 'Saving ZIP…' })
        downloadBlob(zip, `watch-variants_${size}px.zip`)
      } finally {
        setMaterialSnap(false)
        flushSync(() => setConfig(original))
      }
    })

  const captureWatch = useCallback(() => api.current?.captureWatch() ?? null, [])

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
      <FileDropTarget onFile={custom.load} />
      <main className="viewer" onPointerDown={() => setInteracted(true)}>
        <ErrorBoundary name="3D view" fallback={(error) => <ViewerError error={error} />}>
          <Scene
            config={config}
            apiRef={api}
            custom={custom}
            picking={partsOpen}
            selectedId={partsOpen ? selectedId : null}
            hoverId={partsOpen ? hoverId : null}
            onPick={setSelectedId}
          />
          <Loader />
        </ErrorBoundary>
        {custom.status === 'loading' && <UploadProgress custom={custom} />}
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
        {notice && (
          <div className={`toast toast--${notice.type}`} role="status">
            <span>{notice.text}</span>
            <button type="button" className="btn-link" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </div>
        )}
      </main>
      <JobOverlay job={job} />
      {partsOpen ? (
        <PartsPanel
          custom={custom}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onHover={setHoverId}
          onDone={() => setView('options')}
        />
      ) : tab === 'banners' ? (
        <BannerPanel tab={tab} onTab={setTab} captureWatch={captureWatch} defaultName={PRODUCT_NAME} />
      ) : (
        <ConfigPanel
          config={config}
          onChange={setConfig}
          onDownload={handleDownload}
          downloading={downloading}
          tab={tab}
          onTab={setTab}
          modelSection={<ModelSection custom={custom} onCheckParts={() => setView('parts')} />}
          exportSection={<ExportSection onRecordVideo={recordVideo} onExportVariants={exportAll} busy={!!job} />}
        />
      )}
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

/** Shown in place of the 3D view when it can't start, so the page never goes blank. */
function ViewerError({ error }) {
  const message = String(error?.message ?? error)
  const noWebGL = /webgl/i.test(message)
  return (
    <div className="viewer-error" role="alert">
      <h2>3D preview unavailable</h2>
      {noWebGL ? (
        <>
          <p>
            Your browser couldn&apos;t start WebGL, which the 3D view needs. This usually means
            graphics acceleration is turned off.
          </p>
          <p>
            In Chrome or Edge, open <strong>Settings → System</strong>, turn on{' '}
            <strong>Use graphics acceleration when available</strong>, then relaunch the browser.
            The options panel still works.
          </p>
        </>
      ) : (
        <p>Something went wrong while loading the 3D view. Try reloading the page.</p>
      )}
      <code>{message}</code>
    </div>
  )
}

const STAGES = { reading: 'Reading file', parsing: 'Building the 3D model', analyzing: 'Detecting parts' }

/** Progress card shown over the 3D view while an uploaded file is processed. */
function UploadProgress({ custom }) {
  const { file, stage, progress } = custom
  const pct = stage === 'reading' ? Math.round((progress ?? 0) * 100) : null
  return (
    <div className="upload-progress" role="status" aria-live="polite">
      <p className="upload-progress-title">{STAGES[stage] ?? 'Loading'}…</p>
      <div className="upload-progress-bar">
        <div
          className={pct === null ? 'upload-progress-fill upload-progress-fill--busy' : 'upload-progress-fill'}
          style={pct === null ? undefined : { transform: `scaleX(${pct / 100})` }}
        />
      </div>
      <p className="upload-progress-file">
        {file.name} · {formatBytes(file.size)}
        {pct !== null && ` · ${pct}%`}
      </p>
      {file.size > LARGE_FILE_BYTES && (
        <p className="alert alert--warn">
          This is a large file ({formatBytes(file.size)}), so it may take a while — especially on phones.
        </p>
      )}
    </div>
  )
}

/** Lets you drop a model file anywhere on the page. */
function FileDropTarget({ onFile }) {
  const [active, setActive] = useState(false)
  useEffect(() => {
    let depth = 0
    const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files')
    const enter = (e) => {
      if (!hasFiles(e)) return
      depth++
      setActive(true)
    }
    const over = (e) => hasFiles(e) && e.preventDefault()
    const leave = (e) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (!depth) setActive(false)
    }
    const drop = (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setActive(false)
      const file = e.dataTransfer.files?.[0]
      if (file) onFile(file)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [onFile])
  if (!active) return null
  return (
    <div className="drop-overlay" aria-hidden="true">
      <div className="drop-overlay-card">
        <p className="drop-overlay-title">Drop your watch model</p>
        <p>.glb or self-contained .gltf · opens on your device</p>
      </div>
    </div>
  )
}
