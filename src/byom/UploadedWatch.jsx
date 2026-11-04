import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useWatchMaterials } from '../materials/useWatchMaterials'
import { ROLE_BY_ID } from './roles'

/** Uploaded models are scaled so the case is the same size as the demo watch. */
const TARGET_RADIUS = 1.05

const highlightMaterial = (opacity) =>
  new THREE.MeshBasicMaterial({
    color: '#2f6bff',
    transparent: true,
    opacity,
    depthTest: false, // visible even behind the glass or inside the case
    depthWrite: false,
    side: THREE.DoubleSide,
  })

/**
 * Renders a model the user uploaded: applies the configurator's materials
 * according to the part mapping, orients/centres/scales it, and handles
 * picking + highlighting for the "Check your parts" step.
 */
export default function UploadedWatch({ model, config, picking, selectedId, hoverId, onPick, onBounds }) {
  const { scene, analysis, roles, fix } = model
  const items = analysis.items
  const materials = useWatchMaterials(config, { procedural: false })

  // Original materials, so "Ignore" can put them back.
  const originals = useMemo(() => new Map(items.map((it) => [it.id, it.mesh.material])), [items])
  const meshToId = useMemo(() => new Map(items.map((it) => [it.mesh, it.id])), [items])
  const copies = useRef(new Map())
  const synced = useRef([])

  // Assign materials whenever the mapping changes — this is what makes edits live.
  useLayoutEffect(() => {
    const list = []
    for (const it of items) {
      const key = ROLE_BY_ID[roles[it.id]]?.material
      if (!key) {
        it.mesh.material = originals.get(it.id)
        continue
      }
      const master = materials[key]
      const orig = [originals.get(it.id)].flat()[0]
      // Keep normal/AO detail and double-sidedness from the file (single-sheet straps…)
      const needsCopy = key !== 'glass' && (orig?.normalMap || orig?.aoMap || orig?.side === THREE.DoubleSide)
      if (!needsCopy) {
        it.mesh.material = master
        continue
      }
      const cacheKey = `${it.id}|${key}`
      let m = copies.current.get(cacheKey)
      if (!m) {
        m = master.clone()
        m.normalMap = orig.normalMap ?? null
        if (orig.normalScale) m.normalScale.copy(orig.normalScale)
        m.aoMap = orig.aoMap ?? null
        m.side = orig.side
        copies.current.set(cacheKey, m)
      }
      list.push([m, master])
      it.mesh.material = m
    }
    synced.current = list
  }, [items, roles, materials, originals])

  useEffect(
    () => () => {
      copies.current.forEach((m) => m.dispose())
      copies.current.clear()
    },
    [scene],
  )

  useFrame(() => {
    for (const [copy, master] of synced.current) {
      copy.color.copy(master.color)
      copy.metalness = master.metalness
      copy.roughness = master.roughness
      copy.sheen = master.sheen
      copy.sheenColor.copy(master.sheenColor)
    }
  })

  // Orientation (automatic × the user's fix), centring on the watch head, scaling.
  const transform = useMemo(() => {
    const quaternion = new THREE.Quaternion().fromArray(fix).multiply(analysis.orientation)
    const head = analysis.head
    const scale = TARGET_RADIUS / (head?.radius || 1)
    const position = (head?.center ?? new THREE.Vector3()).clone().applyQuaternion(quaternion).multiplyScalar(-scale)
    return { quaternion, scale, position }
  }, [analysis, fix])

  const groupRef = useRef()
  useLayoutEffect(() => {
    const g = groupRef.current
    g.updateWorldMatrix(true, true)
    onBounds?.(new THREE.Box3().setFromObject(g))
  }, [transform, onBounds])

  // Click a mesh to select it; click again to reach what's behind it (e.g. the dial under the glass).
  const handleClick = (e) => {
    if (!picking || e.delta > 4) return
    e.stopPropagation()
    const hits = []
    for (const hit of e.intersections) {
      const id = meshToId.get(hit.object)
      if (id && !hits.includes(id)) hits.push(id)
    }
    if (!hits.length) return
    const i = hits.indexOf(selectedId)
    onPick(i >= 0 ? hits[(i + 1) % hits.length] : hits[0])
  }

  const selected = items.find((it) => it.id === selectedId)?.mesh
  const hovered = hoverId !== selectedId ? items.find((it) => it.id === hoverId)?.mesh : null

  return (
    <group ref={groupRef} position={transform.position}>
      <group scale={transform.scale}>
        <group quaternion={transform.quaternion}>
          <primitive
            object={scene}
            onClick={handleClick}
            onPointerOver={() => picking && (document.body.style.cursor = 'pointer')}
            onPointerOut={() => (document.body.style.cursor = '')}
          />
        </group>
      </group>
      {selected && <Highlight mesh={selected} opacity={0.5} pulse />}
      {hovered && <Highlight mesh={hovered} opacity={0.25} />}
    </group>
  )
}

/** A translucent blue copy of a mesh drawn on top of everything. */
function Highlight({ mesh, opacity, pulse = false }) {
  const overlay = useMemo(() => {
    const o = new THREE.Mesh(mesh.geometry, highlightMaterial(opacity))
    o.renderOrder = 999
    o.raycast = () => {} // never steal clicks
    o.userData.noCapture = true // hidden in downloaded images
    return o
  }, [mesh, opacity])

  useLayoutEffect(() => {
    mesh.add(overlay)
    return () => {
      mesh.remove(overlay)
      overlay.material.dispose()
    }
  }, [mesh, overlay])

  useFrame(({ clock }) => {
    if (pulse) overlay.material.opacity = opacity * (0.75 + 0.25 * Math.sin(clock.elapsedTime * 4))
  })
  return null
}
