import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { forgetMapping, loadMapping, saveMapping } from './storage'

export const LARGE_FILE_BYTES = 15 * 1024 * 1024
export const MAX_FILE_BYTES = 300 * 1024 * 1024
const IDENTITY = [0, 0, 0, 1]

export const formatBytes = (n) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`

/** Auto-detected roles: { meshId: role } */
const detectedRoles = (analysis) =>
  Object.fromEntries(analysis.items.map((it) => [it.id, analysis.guesses[it.id]?.role ?? 'ignore']))

/**
 * State for a user-uploaded model ("bring your own model").
 *
 * status: 'idle' (showing the demo) | 'loading' | 'ready' | 'error'
 * When ready: { file, scene, analysis, roles, manual (Set of ids set by hand),
 *               fix (quaternion array: the user's orientation correction), restored }
 */
export function useCustomModel() {
  const [state, setState] = useState({ status: 'idle' })
  const loadToken = useRef(0)
  const previousScene = useRef(null)

  const load = useCallback(async (file) => {
    if (!file) return
    const token = ++loadToken.current
    const info = { name: file.name, size: file.size }
    if (!/\.(glb|gltf)$/i.test(file.name)) {
      setState({ status: 'error', file: info, error: 'Please choose a .glb (or self-contained .gltf) file.' })
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setState({ status: 'error', file: info, error: `This file is ${formatBytes(file.size)} — too large to open in the browser. Please reduce it below ${formatBytes(MAX_FILE_BYTES)}.` })
      return
    }
    setState({ status: 'loading', file: info, stage: 'reading', progress: 0 })
    try {
      // Loaded on demand so the demo page stays small.
      const { loadModelFile, disposeModel } = await import('./loadModel')
      const { scene, analysis } = await loadModelFile(file, (stage, progress) => {
        if (token === loadToken.current)
          setState((s) => (s.status === 'loading' ? { ...s, stage, progress: progress ?? s.progress } : s))
      })
      if (token !== loadToken.current) return disposeModel(scene)

      const ids = analysis.items.map((it) => it.id)
      const saved = loadMapping(file.name, ids)
      const roles = detectedRoles(analysis)
      let manual = new Set()
      let fix = IDENTITY
      if (saved) {
        for (const id of ids) if (saved.roles[id]) roles[id] = saved.roles[id]
        manual = new Set((saved.manual ?? []).filter((id) => ids.includes(id)))
        if (Array.isArray(saved.fix) && saved.fix.length === 4) fix = saved.fix
      }
      disposeModel(previousScene.current)
      previousScene.current = scene
      // Only mention "restored" when the saved mapping actually differs from a fresh start.
      const restored = !!saved && (manual.size > 0 || fix.some((v, i) => v !== IDENTITY[i]))
      setState({ status: 'ready', file: info, scene, analysis, roles, manual, fix, restored })
    } catch (err) {
      if (token !== loadToken.current) return
      console.error('[watch] Upload failed:', err)
      setState({ status: 'error', file: info, error: err?.message ?? String(err) })
    }
  }, [])

  // Remember the mapping for next time.
  useEffect(() => {
    if (state.status === 'ready') saveMapping(state.file.name, state)
  }, [state])

  const setRole = useCallback((id, role) => {
    setState((s) => {
      if (s.status !== 'ready' || s.roles[id] === role) return s
      const manual = new Set(s.manual)
      manual.add(id)
      return { ...s, roles: { ...s.roles, [id]: role }, manual }
    })
  }, [])

  /** Rotate the model 90° (or 180°) around a screen axis: 'x' tilt, 'y' turn, 'z' spin. */
  const rotate = useCallback((axis, angle = Math.PI / 2) => {
    setState((s) => {
      if (s.status !== 'ready') return s
      const step = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0),
        angle,
      )
      const fix = step.multiply(new THREE.Quaternion().fromArray(s.fix)).normalize().toArray()
      return { ...s, fix: fix.map((v) => Math.round(v * 1e6) / 1e6) }
    })
  }, [])

  const resetOrientation = useCallback(() => {
    setState((s) => (s.status === 'ready' ? { ...s, fix: IDENTITY } : s))
  }, [])

  /** Throw away saved/manual choices and go back to the automatic detection. */
  const redetect = useCallback(() => {
    setState((s) => {
      if (s.status !== 'ready') return s
      forgetMapping(s.file.name)
      return { ...s, roles: detectedRoles(s.analysis), manual: new Set(), fix: IDENTITY, restored: false }
    })
  }, [])

  /** Back to the built-in demo watch. */
  const reset = useCallback(() => {
    loadToken.current++
    setState({ status: 'idle' })
    const scene = previousScene.current
    previousScene.current = null
    if (scene) import('./loadModel').then(({ disposeModel }) => disposeModel(scene))
  }, [])

  const dismissError = useCallback(() => setState({ status: 'idle' }), [])

  return { ...state, load, setRole, rotate, resetOrientation, redetect, reset, dismissError }
}
