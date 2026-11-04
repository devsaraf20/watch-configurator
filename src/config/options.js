/**
 * Everything the user can pick in the side panel lives here.
 * Add, remove or tweak options freely — the UI and the 3D materials
 * are both generated from these lists.
 *
 * Colours are sRGB hex values. For metals, `color` is the reflectance
 * colour (what the metal tints its reflections with).
 */

export const CASE_MATERIALS = [
  {
    id: 'steel',
    label: 'Polished Steel',
    color: '#c8cacd',
    metalness: 1,
    roughness: 0.09,
    swatch: 'linear-gradient(135deg, #f4f5f6 0%, #a9adb2 45%, #e9eaec 60%, #8d9196 100%)',
  },
  {
    id: 'gold',
    label: 'Yellow Gold',
    color: '#ecc677',
    metalness: 1,
    roughness: 0.11,
    swatch: 'linear-gradient(135deg, #fbe7a8 0%, #d4a443 45%, #f6d98a 60%, #b0832c 100%)',
  },
  {
    id: 'rose',
    label: 'Rose Gold',
    color: '#ebb49c',
    metalness: 1,
    roughness: 0.11,
    swatch: 'linear-gradient(135deg, #fbe0d3 0%, #cf8f74 45%, #f2c6b2 60%, #a8674f 100%)',
  },
  {
    id: 'black',
    label: 'Matte Black',
    color: '#2b2b2d',
    metalness: 0.75,
    roughness: 0.48,
    swatch: 'linear-gradient(135deg, #4a4a4d 0%, #1c1c1e 55%, #2e2e31 100%)',
    // Black hands on a black case are hard to read, so use steel ones instead.
    handsMaterial: 'steel',
  },
]

export const DIAL_COLORS = [
  { id: 'midnight', label: 'Midnight Blue', color: '#1c2c4f' },
  { id: 'onyx', label: 'Onyx Black', color: '#141416' },
  { id: 'silver', label: 'Silver White', color: '#e4e2dc' },
  { id: 'forest', label: 'Forest Green', color: '#1e3f30' },
  { id: 'salmon', label: 'Salmon', color: '#e2a487' },
  { id: 'slate', label: 'Slate Grey', color: '#4d535b' },
  { id: 'burgundy', label: 'Burgundy', color: '#5b1d28' },
]

export const STRAP_MATERIALS = [
  {
    id: 'leather',
    label: 'Leather',
    metalness: 0,
    roughness: 0.62,
    sheen: 0.45,
  },
  {
    id: 'rubber',
    label: 'Rubber',
    metalness: 0,
    roughness: 0.82,
    sheen: 0.15,
  },
  {
    id: 'metal',
    label: 'Metal',
    // A metal bracelet always matches the case finish, so it has no colour of its own.
    matchesCase: true,
  },
]

export const STRAP_COLORS = [
  { id: 'black', label: 'Black', color: '#1b1b1c' },
  { id: 'espresso', label: 'Espresso', color: '#3a241a' },
  { id: 'cognac', label: 'Cognac', color: '#8c4c26' },
  { id: 'navy', label: 'Navy', color: '#1e2a44' },
  { id: 'olive', label: 'Olive', color: '#4b5034' },
  { id: 'stone', label: 'Stone', color: '#8d8a83' },
  { id: 'sand', label: 'Sand', color: '#c4ae8c' },
]

export const DEFAULT_CONFIG = {
  caseMaterial: 'steel',
  dialColor: 'midnight',
  strapMaterial: 'leather',
  strapColor: 'cognac',
}

const byId = (list, id) => list.find((o) => o.id === id) ?? list[0]

/** Resolve a config of ids into the full option objects. */
export function resolveConfig(config) {
  return {
    caseMaterial: byId(CASE_MATERIALS, config.caseMaterial),
    dialColor: byId(DIAL_COLORS, config.dialColor),
    strapMaterial: byId(STRAP_MATERIALS, config.strapMaterial),
    strapColor: byId(STRAP_COLORS, config.strapColor),
  }
}

export function getCaseMaterial(id) {
  return byId(CASE_MATERIALS, id)
}
