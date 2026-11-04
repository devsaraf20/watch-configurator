/**
 * ─────────────────────────────────────────────────────────────
 *  YOUR 3D MODEL
 * ─────────────────────────────────────────────────────────────
 * Leave MODEL_URL as null to show the built-in placeholder watch.
 *
 * To use your own Blender model:
 *   1. Export it as GLB (File → Export → glTF 2.0, format "glTF Binary").
 *   2. Save it as  public/models/watch.glb
 *   3. Set MODEL_URL below to '/models/watch.glb'
 *      (or set the environment variable VITE_MODEL_URL, e.g. in Vercel).
 *
 * See README.md → "Using your own Blender model" for the naming rules.
 */
export const MODEL_URL = import.meta.env.VITE_MODEL_URL || null

/**
 * Rotation (radians, [x, y, z]) applied to your model so the dial faces
 * the camera. The default assumes you modelled the watch the "Blender way":
 * lying flat with the dial facing up (+Z) and 12 o'clock pointing to +Y.
 * If your model already stands upright facing -Y in Blender, use [0, 0, 0].
 */
export const MODEL_ROTATION = [Math.PI / 2, 0, 0]

/**
 * 'auto' scales the model so the case is the same size as the placeholder,
 * whatever units you modelled in. Set a number to scale manually instead.
 */
export const MODEL_SCALE = 'auto'

/**
 * Which part of the model each Blender object belongs to.
 *
 * An object belongs to a part when its name (or the name of any parent
 * object/collection-empty above it, or its material name) STARTS WITH one
 * of the keywords below. Matching ignores upper/lower case, so "Case",
 * "case_bezel", "Case.001" and "CASE-back" all count as the case.
 *
 * The first matching rule wins, so more specific parts come first.
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
 * Optional: if your hands are separate objects with these exact names,
 * they will tick like a real watch. Each hand must be modelled pointing
 * at 12 o'clock with its origin at the centre of the dial.
 */
export const HAND_NAMES = {
  hour: 'hand_hour',
  minute: 'hand_minute',
  second: 'hand_second',
}

/**
 * Axis the hands rotate around, in the model's own (glTF) coordinates.
 * For a watch modelled lying flat face-up in Blender this is 'y'.
 */
export const HAND_AXIS = 'y'
