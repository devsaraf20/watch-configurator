import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import {
  HAND_AXIS,
  HAND_NAMES,
  MODEL_ROTATION,
  MODEL_SCALE,
  PART_RULES,
} from '../config/model'
import { useWatchMaterials } from '../materials/useWatchMaterials'
import { handAngles } from '../utils/time'

/** Size the placeholder case occupies (width incl. crown, height incl. lugs → smaller of the two). */
const TARGET_CASE_SIZE = 2.3

/** Which configurable part does this name belong to? (null = leave it alone) */
export function partForName(name) {
  const n = (name || '').toLowerCase()
  if (!n) return null
  for (const rule of PART_RULES) {
    if (rule.keywords.some((k) => n.startsWith(k))) return rule.part
  }
  return null
}

/** Check the object itself, then its parents, then its material name. */
function partForMesh(mesh, root) {
  for (let o = mesh; o && o !== root; o = o.parent) {
    const part = partForName(o.name)
    if (part) return part
  }
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  for (const m of mats) {
    const part = partForName(m?.name)
    if (part) return part
  }
  return null
}

/**
 * Loads your GLB, connects each object to a configurable part by name, and
 * scales/centres it to match the placeholder.
 */
export default function GLBWatch({ url, config, onBounds }) {
  const gltf = useGLTF(url)
  const materials = useWatchMaterials(config, { procedural: false })

  const { model, synced, hands, report } = useMemo(() => {
    const model = gltf.scene.clone(true)
    const synced = [] // per-mesh material copies that keep your normal / AO maps
    const report = {}

    model.traverse((obj) => {
      if (!obj.isMesh) return
      obj.castShadow = true
      const part = partForMesh(obj, model)
      ;(report[part ?? 'unmatched (kept its own material)'] ??= []).push(obj.name)
      if (!part) return
      const master = materials[part]
      const original = Array.isArray(obj.material) ? obj.material[0] : obj.material
      if (part !== 'glass' && (original?.normalMap || original?.aoMap)) {
        // Keep surface detail baked in Blender, but take colour & finish from the configurator.
        const m = master.clone()
        m.normalMap = original.normalMap ?? null
        if (original.normalScale) m.normalScale.copy(original.normalScale)
        m.aoMap = original.aoMap ?? null
        synced.push([m, master])
        obj.material = m
      } else {
        obj.material = master
      }
    })

    // Optional ticking hands
    const sign = HAND_AXIS.startsWith('-') ? -1 : 1
    const axisName = HAND_AXIS.replace('-', '')
    const axis = new THREE.Vector3(
      axisName === 'x' ? 1 : 0,
      axisName === 'y' ? 1 : 0,
      axisName === 'z' ? 1 : 0,
    ).multiplyScalar(sign)
    const hands = Object.entries(HAND_NAMES)
      .map(([key, name]) => {
        const obj = model.getObjectByName(name)
        return obj && { key, obj, initial: obj.quaternion.clone() }
      })
      .filter(Boolean)
    hands.axis = axis

    return { model, synced, hands, report }
  }, [gltf, materials])

  // Auto-fit: rotate so the dial faces the camera, scale & centre on the case.
  const transform = useMemo(() => {
    const probe = new THREE.Group()
    probe.rotation.set(...MODEL_ROTATION)
    probe.add(model)
    probe.updateMatrixWorld(true)
    const caseBox = new THREE.Box3()
    model.traverse((o) => {
      if (o.isMesh && partForMesh(o, model) === 'case') caseBox.expandByObject(o)
    })
    const box = caseBox.isEmpty() ? new THREE.Box3().setFromObject(model) : caseBox
    const size = box.getSize(new THREE.Vector3())
    const scale =
      MODEL_SCALE === 'auto' ? TARGET_CASE_SIZE / Math.max(1e-6, Math.min(size.x, size.y)) : MODEL_SCALE
    const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale)
    probe.remove(model)
    return { scale, position: [-center.x, -center.y, -center.z] }
  }, [model])

  const groupRef = useRef()
  useLayoutEffect(() => {
    const g = groupRef.current
    g.updateWorldMatrix(true, true)
    onBounds?.(new THREE.Box3().setFromObject(g))
  }, [transform, onBounds])

  useLayoutEffect(() => {
    if (import.meta.env.DEV) {
      console.groupCollapsed('[watch] How your model\'s objects were matched to parts')
      Object.entries(report).forEach(([part, names]) => console.log(part, '→', names))
      console.groupEnd()
    }
  }, [report])

  useFrame(() => {
    for (const [copy, master] of synced) {
      copy.color.copy(master.color)
      copy.metalness = master.metalness
      copy.roughness = master.roughness
      copy.sheen = master.sheen
      copy.sheenColor.copy(master.sheenColor)
    }
    if (hands.length) {
      const angles = handAngles()
      const q = new THREE.Quaternion()
      for (const h of hands) {
        q.setFromAxisAngle(hands.axis, -angles[h.key])
        h.obj.quaternion.copy(q).multiply(h.initial)
      }
    }
  })

  return (
    <group ref={groupRef} position={transform.position}>
      <group scale={transform.scale}>
        <group rotation={MODEL_ROTATION}>
          <primitive object={model} />
        </group>
      </group>
    </group>
  )
}
