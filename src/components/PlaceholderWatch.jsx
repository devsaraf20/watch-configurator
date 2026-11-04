import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { resolveConfig } from '../config/options'
import { getDialPrint } from '../materials/textures'
import {
  createCaseGeometry,
  createGlassGeometry,
  createHandGeometry,
  createSecondHandGeometry,
  createStrapGeometry,
} from '../utils/geometry'
import { handAngles } from '../utils/time'

/**
 * A simple watch built from basic shapes, so the configurator works before
 * you have a real model. Each part is its own named mesh — exactly the names
 * your Blender objects should use (see README).
 */
export default function PlaceholderWatch({ config, materials }) {
  const geo = useMemo(() => {
    const lug = new RoundedBoxGeometry(0.17, 0.46, 0.2, 4, 0.06)
    const marker = new RoundedBoxGeometry(0.045, 0.15, 0.03, 2, 0.012)
    const crown = new THREE.CylinderGeometry(0.125, 0.125, 0.15, 40)
    crown.rotateZ(Math.PI / 2)
    const crownTube = new THREE.CylinderGeometry(0.06, 0.06, 0.12, 24)
    crownTube.rotateZ(Math.PI / 2)
    return {
      case: createCaseGeometry(),
      glass: createGlassGeometry(),
      strap: createStrapGeometry().geometry,
      dial: new THREE.CircleGeometry(0.848, 128),
      lug,
      marker,
      crown,
      crownTube,
      buckle: new RoundedBoxGeometry(0.9, 0.42, 0.06, 4, 0.025),
      hour: createHandGeometry({ length: 0.44, width: 0.07, tail: 0.09, tip: 0.07 }),
      minute: createHandGeometry({ length: 0.68, width: 0.052, tail: 0.11, tip: 0.07 }),
      hourLume: createHandGeometry({ length: 0.36, width: 0.034, tail: -0.12, tip: 0.04, depth: 0.004 }),
      minuteLume: createHandGeometry({ length: 0.6, width: 0.024, tail: -0.16, tip: 0.04, depth: 0.004 }),
      second: createSecondHandGeometry(),
      cap: new THREE.CylinderGeometry(0.036, 0.036, 0.02, 32).rotateX(Math.PI / 2),
    }
  }, [])

  const printMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: getDialPrint(),
        // alphaTest (not transparency) so the print is visible through the glass:
        // transmissive materials only refract opaque objects.
        alphaTest: 0.35,
        roughness: 0.5,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    [],
  )
  const lumeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f3efe2',
        roughness: 0.55,
        emissive: '#cfe8d4',
        emissiveIntensity: 0.06,
      }),
    [],
  )

  // Dark print on light dials, light print on dark dials.
  const { dialColor } = resolveConfig(config)
  const dialIsLight = new THREE.Color(dialColor.color).getHSL({}).l > 0.5
  printMaterial.color.set(dialIsLight ? '#26262a' : '#f2f2f2')

  const hourRef = useRef()
  const minuteRef = useRef()
  const secondRef = useRef()
  useFrame(() => {
    const a = handAngles()
    hourRef.current.rotation.z = -a.hour
    minuteRef.current.rotation.z = -a.minute
    secondRef.current.rotation.z = -a.second
  })

  const markers = useMemo(() => {
    const list = []
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const r = 0.66
      const offsets = i === 0 ? [-0.038, 0.038] : [0]
      for (const o of offsets) {
        list.push({
          key: `${i}-${o}`,
          position: [Math.sin(a) * r + Math.cos(a) * o, Math.cos(a) * r - Math.sin(a) * o, 0.062],
          rotation: [0, 0, -a],
        })
      }
    }
    return list
  }, [])

  return (
    <group name="watch">
      {/* ── case ─────────────────────────────── */}
      <group name="case">
        <mesh name="case_body" geometry={geo.case} material={materials.case} castShadow />
        {[
          [0.585, 0.96, -0.22],
          [-0.585, 0.96, -0.22],
          [0.585, -0.96, 0.22],
          [-0.585, -0.96, 0.22],
        ].map(([x, y, rx]) => (
          <mesh
            key={`${x}${y}`}
            name="case_lug"
            geometry={geo.lug}
            material={materials.case}
            position={[x, y, -0.1]}
            rotation={[rx, 0, 0]}
          />
        ))}
        <mesh name="case_crown_tube" geometry={geo.crownTube} material={materials.case} position={[1.07, 0, -0.04]} />
        <mesh name="case_crown" geometry={geo.crown} material={materials.case} position={[1.17, 0, -0.04]} />
      </group>

      {/* ── dial ─────────────────────────────── */}
      <group name="dial">
        <mesh name="dial_face" geometry={geo.dial} material={materials.dial} position={[0, 0, 0.05]} />
        <mesh name="dial_print" geometry={geo.dial} material={printMaterial} position={[0, 0, 0.0505]} />
        {markers.map((m) => (
          <mesh
            key={m.key}
            name="marker"
            geometry={geo.marker}
            material={materials.markers}
            position={m.position}
            rotation={m.rotation}
          />
        ))}
      </group>

      {/* ── hands ────────────────────────────── */}
      <group name="hands">
        <group ref={hourRef} name="hand_hour" position={[0, 0, 0.08]}>
          <mesh geometry={geo.hour} material={materials.hands} />
          <mesh geometry={geo.hourLume} material={lumeMaterial} position={[0, 0, 0.014]} />
        </group>
        <group ref={minuteRef} name="hand_minute" position={[0, 0, 0.1]}>
          <mesh geometry={geo.minute} material={materials.hands} />
          <mesh geometry={geo.minuteLume} material={lumeMaterial} position={[0, 0, 0.014]} />
        </group>
        <group ref={secondRef} name="hand_second" position={[0, 0, 0.122]}>
          <mesh geometry={geo.second} material={materials.hands} />
        </group>
        <mesh name="hands_cap" geometry={geo.cap} material={materials.hands} position={[0, 0, 0.135]} />
      </group>

      {/* ── strap ────────────────────────────── */}
      <mesh name="strap" geometry={geo.strap} material={materials.strap} castShadow />
      <mesh name="buckle" geometry={geo.buckle} material={materials.buckle} position={[0, 0, -2.44]} />

      {/* ── glass ────────────────────────────── */}
      <mesh name="glass" geometry={geo.glass} material={materials.glass} position={[0, 0, 0.225]} />
    </group>
  )
}
