/**
 * Checks the automatic part detection used by "bring your own model".
 *
 *   npm run test:detection
 *
 * Loads public/models/watch.glb (whose objects have meaningless names, so only
 * geometry can identify them), rotates it into several orientations, and checks
 * that the orientation and every part's role are detected correctly.
 */
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { analyzeModel } from '../src/byom/analyze.js'

const FILE = 'public/models/watch.glb'
const expected = {
  pCylinder1001: 'case', pCylinder4001: 'case', pCylinder5001: 'crown',
  polySurface11001: 'case', polySurface12001: 'case', polySurface13001: 'case', polySurface14001: 'case',
  polySurface5001: 'case', polySurface6001: 'case',
  pCylinder2001: 'dial', pCylinder3001: 'dial',
  pSphere1: 'hands', pSphere2: 'hands',
  pCube8001: 'strap', pPlane2001: 'strap', pCube12001: 'buckle', pCube13001: 'buckle',
}
for (let i = 15; i <= 26; i++) expected[`polySurface${i}001`] = 'markers'

const orientations = [
  ['as exported', [0, 0, 0]],
  ['lying flat, dial up', [-Math.PI / 2, 0, 0]],
  ['facing away', [0, Math.PI, 0]],
  ['rolled 90°', [0, 0, Math.PI / 2]],
]

const buf = readFileSync(FILE)
const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
let failures = 0

for (const [label, rotation] of orientations) {
  const { scene } = await loader.parseAsync(data.slice(0), '')
  const wrapper = new THREE.Group()
  wrapper.rotation.set(...rotation)
  wrapper.add(scene)
  const a = analyzeModel(wrapper)

  // After the detected orientation, the dial must face +Z and 12 o'clock +Y.
  const total = a.orientation.clone().multiply(wrapper.quaternion)
  const face = new THREE.Vector3(0, 0, 1).applyQuaternion(total)
  const twelve = new THREE.Vector3(0, 1, 0).applyQuaternion(total)
  const orientOk = face.z > 0.99 && twelve.y > 0.99
  const wrong = a.items.filter((it) => expected[it.name] && a.guesses[it.id].role !== expected[it.name])
  failures += wrong.length + (orientOk ? 0 : 1)
  console.log(`${orientOk && !wrong.length ? '✓' : '✗'} ${label}: orientation ${orientOk ? 'ok' : 'WRONG'}, ${a.items.length - wrong.length}/${a.items.length} parts`)
  for (const it of wrong) console.log(`    ${it.name}: got ${a.guesses[it.id].role}, expected ${expected[it.name]}`)
}

process.exit(failures ? 1 : 0)
