import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import {
  HAND_AXIS,
  HAND_NAMES,
  MODEL_ROTATION,
  MODEL_SCALE,
  MODEL_URL,
  PART_OVERRIDES,
  PART_RULES,
  TWELVE_DIRECTION,
} from '../config/model'
import { useWatchMaterials } from '../materials/useWatchMaterials'
import { handAngles } from '../utils/time'

const tmp = new THREE.Matrix4()
const tmp2 = new THREE.Matrix4()

/** Size the placeholder case occupies (width incl. crown, height incl. lugs → smaller of the two). */
const TARGET_CASE_SIZE = 2.3

// Start downloading the model as soon as the app's code loads.
if (MODEL_URL) useGLTF.preload(MODEL_URL)

/** 'pCube8.001' → 'pcube8001': the glTF loader strips dots, so compare without punctuation. */
const normalize = (name) => (name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const OVERRIDES = new Map(Object.entries(PART_OVERRIDES).map(([k, v]) => [normalize(k), v]))

/** 'z' / '-y' … → unit vector */
function axisVector(spec) {
  const v = new THREE.Vector3()
  v[spec.replace('-', '')] = spec.startsWith('-') ? -1 : 1
  return v
}

/** Which configurable part does this name belong to? (null = leave it alone) */
export function partForName(name) {
  const override = OVERRIDES.get(normalize(name))
  if (override) return override
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
      const doubleSided = original?.side === THREE.DoubleSide
      if (part !== 'glass' && (original?.normalMap || original?.aoMap || doubleSided)) {
        // Keep surface detail baked in Blender (and double-sided surfaces such as
        // single-sheet straps), but take colour & finish from the configurator.
        const m = master.clone()
        m.normalMap = original.normalMap ?? null
        if (original.normalScale) m.normalScale.copy(original.normalScale)
        m.aoMap = original.aoMap ?? null
        m.side = original.side
        synced.push([m, master])
        obj.material = m
      } else {
        obj.material = master
      }
    })

    // Ticking hands. They turn around the centre of the dial — not around their
    // own origin — and their resting angle is measured from the geometry, so a
    // hand can be exported pointing anywhere and with its origin anywhere.
    const axis = axisVector(HAND_AXIS)
    const twelve = axisVector(TWELVE_DIRECTION)
    const three = twelve.clone().cross(axis) // clockwise from 12, seen from the front
    model.updateMatrixWorld(true)
    const pivotBox = new THREE.Box3()
    for (const part of ['dial', 'case']) {
      model.traverse((o) => {
        if (o.isMesh && partForMesh(o, model) === part) pivotBox.expandByObject(o)
      })
      if (!pivotBox.isEmpty()) break
    }
    const pivot = pivotBox.getCenter(new THREE.Vector3())
    const hands = Object.entries(HAND_NAMES)
      .map(([key, name]) => {
        let obj = null
        if (name) model.traverse((o) => { if (!obj && normalize(o.name) === normalize(name)) obj = o })
        if (!obj) return null
        const offset = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3()).sub(pivot)
        const rest = Math.atan2(offset.dot(three), offset.dot(twelve))
        // Express pivot and axis in the hand's parent space.
        const toParent = obj.parent.matrixWorld.clone().invert()
        obj.updateMatrix()
        obj.matrixAutoUpdate = false
        return {
          key,
          obj,
          rest,
          initial: obj.matrix.clone(),
          pivot: pivot.clone().applyMatrix4(toParent),
          axis: axis.clone().transformDirection(toParent),
        }
      })
      .filter(Boolean)

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
      console.groupCollapsed("[watch] How your model's objects were matched to parts")
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
      for (const h of hands) {
        // matrix = translate(pivot) · rotate(clockwise) · translate(-pivot) · rest pose
        const angle = -(angles[h.key] - h.rest)
        h.obj.matrix
          .makeTranslation(h.pivot.x, h.pivot.y, h.pivot.z)
          .multiply(tmp.makeRotationAxis(h.axis, angle))
          .multiply(tmp2.makeTranslation(-h.pivot.x, -h.pivot.y, -h.pivot.z))
          .multiply(h.initial)
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
