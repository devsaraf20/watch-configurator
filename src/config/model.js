/**
 * ─────────────────────────────────────────────────────────────
 *  YOUR 3D MODEL
 * ─────────────────────────────────────────────────────────────
 * MODEL_URL points at the GLB in /public. Set it to null to go back to
 * the built-in placeholder watch. It can also be overridden with the
 * environment variable VITE_MODEL_URL (e.g. in Vercel).
 *
 * public/models/watch.glb is an optimised copy of the original Blender
 * export (meshopt-compressed, unused UVs removed: 2.4 MB → 0.4 MB) —
 * see README → "Updating the model" for the one-line command.
 */
export const MODEL_URL = import.meta.env.VITE_MODEL_URL || '/models/watch.glb'

/**
 * Rotation (radians, [x, y, z]) applied so the dial faces the camera.
 * This model is already exported upright with the dial facing +Z and
 * 12 o'clock at +Y, so no rotation is needed.
 * (A watch modelled lying flat, dial up in Blender, would need [Math.PI / 2, 0, 0].)
 */
export const MODEL_ROTATION = [0, 0, 0]

/**
 * 'auto' scales the model so the case is the same size as the placeholder,
 * whatever units you modelled in. Set a number to scale manually instead.
 */
export const MODEL_SCALE = 'auto'

/**
 * Explicit object → part mapping for the current model.
 *
 * The objects in this file still have their default modelling names
 * (pCube8, polySurface11…), so they are mapped here by hand. Names are
 * compared ignoring case and punctuation, so 'pCube8.001' also matches
 * 'pCube8001' (the glTF loader strips the dots).
 *
 * Parts: case, dial, strap, hands, glass, buckle (follows the case),
 * markers (follow the hands). Anything not listed here and not matching
 * PART_RULES below keeps the material it was exported with.
 */
export const PART_OVERRIDES = {
  // Case
  'pCylinder1.001': 'case', // front case / bezel
  'pCylinder4.001': 'case', // case back
  'pCylinder5.001': 'case', // crown
  'polySurface11.001': 'case', // lug
  'polySurface12.001': 'case', // lug
  'polySurface13.001': 'case', // lug
  'polySurface14.001': 'case', // lug
  'polySurface5.001': 'case', // spring bar (top)
  'polySurface6.001': 'case', // spring bar (bottom)

  // Dial
  'pCylinder2.001': 'dial', // outer dial ring (outer ball track)
  'pCylinder3.001': 'dial', // centre disc

  // Hour markers (12 indices; polySurface15 is the triangle at 12)
  'polySurface15.001': 'markers',
  'polySurface16.001': 'markers',
  'polySurface17.001': 'markers',
  'polySurface18.001': 'markers',
  'polySurface19.001': 'markers',
  'polySurface20.001': 'markers',
  'polySurface21.001': 'markers',
  'polySurface22.001': 'markers',
  'polySurface23.001': 'markers',
  'polySurface24.001': 'markers',
  'polySurface25.001': 'markers',
  'polySurface26.001': 'markers',

  // Hands — this watch tells the time with two ball bearings
  pSphere1: 'hands', // inner ball → hours
  pSphere2: 'hands', // outer ball → minutes

  // Strap
  'pCube8.001': 'strap', // lower strap
  'pPlane2.001': 'strap', // upper strap

  // Buckle
  'pCube12.001': 'buckle', // buckle frame
  'pCube13.001': 'buckle', // buckle prong
}

/**
 * Name-based rules for any object not listed in PART_OVERRIDES.
 *
 * An object belongs to a part when its name (or the name of any parent
 * object/empty above it, or its material name) STARTS WITH one of the
 * keywords below, ignoring case — so "Case", "case_bezel", "Case.001"
 * all count as the case. The first matching rule wins.
 */
export const PART_RULES = [
  // Optional extras — these follow the colour/material of another part.
  { part: 'buckle', keywords: ['buckle', 'clasp'] }, // follows the case material
  { part: 'markers', keywords: ['marker', 'index', 'indices'] }, // follows the hands
  // The five main parts.
  { part: 'glass', keywords: ['glass', 'crystal'] },
  { part: 'hands', keywords: ['hand'] }, // "hands", "hand_hour", …
  { part: 'dial', keywords: ['dial'] },
  { part: 'strap', keywords: ['strap', 'bracelet', 'band'] },
  { part: 'case', keywords: ['case', 'bezel', 'crown', 'lug'] },
]

/**
 * Objects that tell the time. They turn around the centre of the dial, and
 * their resting position is measured automatically, so they can be exported
 * pointing anywhere. Use null for a hand the model doesn't have.
 */
export const HAND_NAMES = {
  hour: 'pSphere1',
  minute: 'pSphere2',
  second: null,
}

/**
 * Direction the dial faces and direction of 12 o'clock, in the model's own
 * (glTF) coordinates. Hands turn clockwise around HAND_AXIS.
 * This model: dial faces +Z, 12 o'clock is +Y.
 * (A watch modelled lying flat, dial up in Blender: HAND_AXIS 'y', TWELVE_DIRECTION '-z'.)
 */
export const HAND_AXIS = 'z'
export const TWELVE_DIRECTION = 'y'
