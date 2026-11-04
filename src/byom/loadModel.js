import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { analyzeModel } from './analyze'

/**
 * Everything that happens to an uploaded file, in the browser only:
 * read it → parse the glTF → analyse the parts. Nothing is sent to a server.
 * (This module is loaded on demand, so the demo doesn't pay for it.)
 */

let loader = null
function getLoader() {
  if (!loader) {
    // Draco is a common Blender export option. three.js bundles the decoder,
    // which is only downloaded when a Draco-compressed file is opened.
    const draco = new DRACOLoader()
    loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder)
  }
  return loader
}

function readFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('The file could not be read.'))
    reader.readAsArrayBuffer(file)
  })
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))

function friendlyError(err) {
  const msg = String(err?.message ?? err)
  if (/KTX2/i.test(msg)) return 'This model uses KTX2 compressed textures, which aren’t supported here. Re-export it with PNG or JPEG textures.'
  if (/Unexpected token|JSON|magic|Unsupported asset/i.test(msg)) return 'This doesn’t look like a valid glTF/GLB file. Export it from your 3D software as glTF Binary (.glb).'
  if (/Failed to load buffer|Failed to fetch|external/i.test(msg)) return 'This .gltf refers to separate files (.bin or textures) that weren’t uploaded. Export it as a single .glb file instead.'
  if (/draco/i.test(msg)) return 'This model is Draco-compressed and couldn’t be decoded. Try exporting it again without compression.'
  return `The model couldn’t be loaded: ${msg}`
}

/**
 * @param {File} file
 * @param {(stage: 'reading'|'parsing'|'analyzing', progress?: number) => void} onStage
 */
export async function loadModelFile(file, onStage) {
  onStage('reading', 0)
  const buffer = await readFile(file, (p) => onStage('reading', p))
  onStage('parsing')
  await nextFrame()
  let gltf
  try {
    gltf = await getLoader().parseAsync(buffer, '')
  } catch (err) {
    throw new Error(friendlyError(err))
  }
  const scene = gltf.scene || gltf.scenes?.[0]
  if (!scene) throw new Error('The file contains no scene.')

  // Untextured or minimal exports sometimes lack normals: compute them so lighting works.
  let meshCount = 0
  scene.traverse((o) => {
    if (!o.isMesh) return
    meshCount++
    if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals()
    o.castShadow = true
  })
  if (!meshCount) throw new Error('The file has no meshes — there’s nothing to show.')

  onStage('analyzing')
  await nextFrame()
  const analysis = analyzeModel(scene)
  return { scene, analysis }
}

/** Free GPU memory used by a model that is being replaced. */
export function disposeModel(scene) {
  scene?.traverse((o) => {
    if (!o.isMesh) return
    o.geometry?.dispose()
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    for (const m of mats) {
      if (!m) continue
      for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose()
      m.dispose()
    }
  })
}
