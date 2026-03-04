/**
 * Encode a state object to a base64url string for use in URL hash.
 * Usage: window.location.hash = '#state=' + encodeState({...})
 */
export function encodeState(obj) {
  try {
    const json = JSON.stringify(obj)
    const b64 = btoa(unescape(encodeURIComponent(json)))
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  } catch {
    return ''
  }
}

/**
 * Decode a base64url string back to a state object.
 * Returns null on any error.
 */
export function decodeState(str) {
  if (!str) return null
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(
      str.length + (4 - str.length % 4) % 4, '='
    )
    const json = decodeURIComponent(escape(atob(b64)))
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * Read current app state from window.location.hash.
 * Returns null if no state is encoded.
 */
export function readHashState() {
  const hash = window.location.hash
  const match = hash.match(/[#&]state=([^&]*)/)
  return match ? decodeState(match[1]) : null
}

/**
 * Write app state to window.location.hash, preserving the tool path.
 * e.g. hash becomes '#/world-map&state=...'
 */
export function writeHashState(toolPath, obj) {
  window.location.hash = toolPath + '&state=' + encodeState(obj)
}
