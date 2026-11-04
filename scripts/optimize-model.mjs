/**
 * Shrinks a GLB exported from Blender so it loads fast on phones.
 *
 *   npm run optimize-model -- path/to/export.glb            → public/models/watch.glb
 *   npm run optimize-model -- path/to/export.glb out.glb
 *
 * - meshopt compression + quantisation (decoder is built into the app, no CDN)
 * - removes duplicate data and unused objects
 * - drops UV sets when the model has no textures (the configurator sets colours itself)
 * Object names are kept, so the part mapping in src/config/model.js keeps working.
 */
import { statSync } from 'node:fs'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune, weld } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'

const [input, output = 'public/models/watch.glb'] = process.argv.slice(2)
if (!input) {
  console.error('Usage: npm run optimize-model -- <input.glb> [output.glb]')
  process.exit(1)
}

await MeshoptEncoder.ready
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
const doc = await io.read(input)

if (doc.getRoot().listTextures().length === 0) {
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives())
      for (const semantic of prim.listSemantics())
        if (semantic.startsWith('TEXCOORD')) prim.setAttribute(semantic, null)
}

await doc.transform(dedup(), prune(), weld(), meshopt({ encoder: MeshoptEncoder, level: 'high' }))
await io.write(output, doc)

const kb = (f) => `${(statSync(f).size / 1024).toFixed(0)} KB`
console.log(`${input} (${kb(input)}) → ${output} (${kb(output)})`)
console.log('Objects:', doc.getRoot().listNodes().map((n) => n.getName()).join(', '))
