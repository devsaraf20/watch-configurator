/**
 * Remembers the part mapping (and orientation fix) for each uploaded file,
 * keyed by file name, in this browser's localStorage.
 */
const PREFIX = 'watch-configurator:parts:v1:'

export function loadMapping(fileName, meshIds) {
  try {
    const raw = window.localStorage.getItem(PREFIX + fileName)
    if (!raw) return null
    const saved = JSON.parse(raw)
    // Only trust it if the file still has the same meshes.
    const known = meshIds.filter((id) => id in (saved.roles ?? {})).length
    if (known < meshIds.length * 0.8) return null
    return saved
  } catch {
    return null
  }
}

export function saveMapping(fileName, { roles, manual, fix }) {
  try {
    window.localStorage.setItem(
      PREFIX + fileName,
      JSON.stringify({ roles, manual: [...manual], fix, savedAt: new Date().toISOString() }),
    )
  } catch {
    // Storage full or blocked (private mode): the mapping just won't be remembered.
  }
}

export function forgetMapping(fileName) {
  try {
    window.localStorage.removeItem(PREFIX + fileName)
  } catch {
    /* ignore */
  }
}
