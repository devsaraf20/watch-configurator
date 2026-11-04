import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getCaseMaterial, resolveConfig } from '../config/options'
import {
  getLeatherNormal,
  getLinkMaps,
  getRubberNormal,
  getSunburstAnisotropy,
} from './textures'

/**
 * One material per watch part. The same material objects live for the whole
 * session; when the configuration changes we animate their colour, metalness
 * and roughness towards the new values, so switches feel smooth.
 *
 * Parts: case, dial, strap, hands, glass, buckle (follows case), markers (follows hands).
 *
 * @param {object} config            ids from the side panel (see options.js)
 * @param {object} opts
 * @param {boolean} opts.procedural  add the generated leather / bracelet / sunburst
 *                                   textures. These rely on the placeholder's UVs,
 *                                   so they are switched off for custom models.
 */
export function useWatchMaterials(config, { procedural = true } = {}) {
  const materials = useMemo(() => {
    const metal = () =>
      new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.1, envMapIntensity: 1 })
    return {
      case: metal(),
      buckle: metal(),
      hands: metal(),
      markers: metal(),
      dial: new THREE.MeshPhysicalMaterial({
        metalness: 0.35,
        roughness: 0.38,
        clearcoat: 0.7,
        clearcoatRoughness: 0.06,
      }),
      strap: new THREE.MeshPhysicalMaterial({ roughness: 0.6, sheenRoughness: 0.55 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        metalness: 0,
        roughness: 0,
        transmission: 1,
        thickness: 0.08,
        ior: 1.5,
        specularIntensity: 1,
        envMapIntensity: 1.6,
        // a whisper of blue, like an anti-reflective coating
        attenuationColor: new THREE.Color('#eef4ff'),
        attenuationDistance: 2,
      }),
    }
  }, [])

  const targets = useRef(null)

  // Apply the parts of the configuration that can't be animated (textures,
  // anisotropy…) immediately, and store colour/finish targets for animation.
  useEffect(() => {
    const { caseMaterial, dialColor, strapMaterial, strapColor } = resolveConfig(config)
    const handsSpec = caseMaterial.handsMaterial
      ? getCaseMaterial(caseMaterial.handsMaterial)
      : caseMaterial

    const metalTarget = (spec, roughnessOffset = 0) => ({
      color: new THREE.Color(spec.color),
      metalness: spec.metalness,
      roughness: Math.min(1, spec.roughness + roughnessOffset),
    })

    // ── Strap ────────────────────────────────────────────────
    const strap = materials.strap
    let strapTarget
    let normalMap = null
    let roughnessMap = null
    let normalScale = 1
    if (strapMaterial.matchesCase) {
      const isMatte = caseMaterial.roughness > 0.3
      strapTarget = {
        color: new THREE.Color(caseMaterial.color),
        metalness: caseMaterial.metalness,
        // brushed bracelet vs. polished case, so the two read as different finishes
        roughness: procedural ? (isMatte ? 0.6 : 0.34) : Math.min(1, caseMaterial.roughness + 0.2),
        sheen: 0,
      }
      if (procedural) {
        const maps = getLinkMaps()
        normalMap = maps.normalMap
        roughnessMap = maps.roughnessMap
        normalMap.repeat.set(1, 3.4)
        roughnessMap.repeat.set(1, 3.4)
        normalScale = 1
      }
    } else {
      strapTarget = {
        color: new THREE.Color(strapColor.color),
        metalness: strapMaterial.metalness,
        roughness: strapMaterial.roughness,
        sheen: strapMaterial.sheen,
      }
      if (procedural) {
        normalMap = strapMaterial.id === 'leather' ? getLeatherNormal() : getRubberNormal()
        normalScale = strapMaterial.id === 'leather' ? 0.9 : 0.5
      }
    }
    if (strap.normalMap !== normalMap || strap.roughnessMap !== roughnessMap) {
      strap.normalMap = normalMap
      strap.roughnessMap = roughnessMap
      strap.needsUpdate = true
    }
    strap.normalScale.set(normalScale, normalScale)

    // ── Dial ─────────────────────────────────────────────────
    const dial = materials.dial
    if (procedural && !dial.anisotropyMap) {
      dial.anisotropy = 0.85
      dial.anisotropyMap = getSunburstAnisotropy()
      dial.needsUpdate = true
    }
    const dialC = new THREE.Color(dialColor.color)
    const dialHsl = dialC.getHSL({})
    const dialTarget = {
      color: dialC,
      // light dials read better slightly less metallic
      metalness: dialHsl.l > 0.45 ? 0.05 : 0.35,
      roughness: 0.36,
    }

    targets.current = {
      case: metalTarget(caseMaterial),
      buckle: metalTarget(caseMaterial),
      hands: metalTarget(handsSpec, -0.03),
      markers: metalTarget(handsSpec, -0.03),
      dial: dialTarget,
      strap: strapTarget,
    }
  }, [config, materials, procedural])

  // Snap to the first configuration instead of animating from defaults.
  const first = useRef(true)
  useFrame((_, dt) => {
    const t = targets.current
    if (!t) return
    const k = first.current ? 1 : 1 - Math.exp(-9 * Math.min(dt, 0.1))
    first.current = false
    for (const key in t) {
      const m = materials[key]
      const target = t[key]
      m.color.lerp(target.color, k)
      m.metalness += (target.metalness - m.metalness) * k
      m.roughness += (target.roughness - m.roughness) * k
      if (target.sheen !== undefined) {
        m.sheen += (target.sheen - m.sheen) * k
        m.sheenColor.copy(m.color).offsetHSL(0, 0, 0.25)
      }
    }
  })

  useEffect(
    () => () => {
      Object.values(materials).forEach((m) => m.dispose())
    },
    [materials],
  )

  return materials
}
