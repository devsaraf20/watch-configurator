import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { MODEL_URL } from '../config/model'
import { useWatchMaterials } from '../materials/useWatchMaterials'
import ErrorBoundary from './ErrorBoundary'
import GLBWatch from './GLBWatch'
import UploadedWatch from '../byom/UploadedWatch'
import PlaceholderWatch from './PlaceholderWatch'

/**
 * Shows, in order of preference:
 *  1. a model the visitor uploaded ("bring your own model"),
 *  2. the demo GLB when MODEL_URL is set (src/config/model.js),
 *  3. the built-in placeholder.
 * If a model fails to render, the placeholder is shown instead and the reason
 * is logged to the browser console.
 */
export default function Watch({ config, onBounds, custom, picking, selectedId, hoverId, onPick }) {
  const placeholder = <Placeholder config={config} onBounds={onBounds} />
  if (custom?.status === 'ready') {
    return (
      <ErrorBoundary key={custom.scene.uuid} name={`Uploaded model "${custom.file.name}"`} fallback={placeholder}>
        <UploadedWatch
          model={custom}
          config={config}
          picking={picking}
          selectedId={selectedId}
          hoverId={hoverId}
          onPick={onPick}
          onBounds={onBounds}
        />
      </ErrorBoundary>
    )
  }
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
