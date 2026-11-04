import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { MODEL_URL } from '../config/model'
import { useWatchMaterials } from '../materials/useWatchMaterials'
import GLBWatch from './GLBWatch'
import PlaceholderWatch from './PlaceholderWatch'

/**
 * Shows your GLB model when MODEL_URL is set (src/config/model.js),
 * otherwise the built-in placeholder.
 */
export default function Watch({ config, onBounds }) {
  if (MODEL_URL) return <GLBWatch url={MODEL_URL} config={config} onBounds={onBounds} />
  return <Placeholder config={config} onBounds={onBounds} />
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
