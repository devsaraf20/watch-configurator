/**
 * Roles a mesh of an uploaded model can be assigned to, and which of the
 * configurator's materials each role uses (see materials/useWatchMaterials.js).
 * `material: null` keeps the mesh's original material from the file.
 */
export const ROLES = [
  { id: 'case', label: 'Case', material: 'case' },
  { id: 'crown', label: 'Crown', material: 'case' },
  { id: 'dial', label: 'Dial', material: 'dial' },
  { id: 'hands', label: 'Hands', material: 'hands' },
  { id: 'markers', label: 'Hour markers', material: 'markers' },
  { id: 'glass', label: 'Glass', material: 'glass' },
  { id: 'strap', label: 'Strap / bracelet', material: 'strap' },
  { id: 'buckle', label: 'Buckle / clasp', material: 'buckle' },
  { id: 'ignore', label: 'Ignore (keep original)', material: null },
]

export const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r]))

export const roleLabel = (id) => ROLE_BY_ID[id]?.label ?? id
