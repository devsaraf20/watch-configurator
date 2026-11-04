import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { MODEL_URL } from '../config/model'
import { useWatchMaterials } from '../materials/useWatchMaterials'
import ErrorBoundary from './ErrorBoundary'
import GLBWatch from './GLBWatch'
import PlaceholderWatch from './PlaceholderWatch'

/**
 * Shows your GLB model when MODEL_URL is set (src/config/model.js),
 * otherwise the built-in placeholder. If the model fails to load (missing
 * file, corrupt export…) the placeholder is shown instead and the reason is
 * logged to the browser console.
 */
export default function Watch({ config, onBounds }) {
  const placeholder = <Placeholder config={config} onBounds={onBounds} />
  if (!MODEL_URL) return placeholder
  return (
    <ErrorBoundary name={`Model "${MODEL_URL}"`} fallback={placeholder}>
      <GLBWatch url={MODEL_URL} config={config} onBounds={onBounds} />
    </ErrorBoundary>
  )
}

function Placeholder({ config, onBounds }) {
  const materials = useWatchMaterials(config, { procedural: true })
  const ref = useRef()
  useLayoutEffect(() => {
    ref.current.updateWorldMatrix(true, true)
    onBounds?.(new THREE.Box3().setFromObject(ref.current))
  }, [onBounds])
  return (
    <group ref={ref}>
      <PlaceholderWatch config={config} materials={materials} />
    </group>
  )
}
