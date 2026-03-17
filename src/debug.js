// Debug logging — enable via localStorage.setItem('cosmos_debug', '1')
const DEBUG = typeof window !== 'undefined' && localStorage.getItem('cosmos_debug') === '1'
export function debugLog(...args) { if (DEBUG) console.log('[cosmos]', ...args) }
export function debugWarn(...args) { if (DEBUG) console.warn('[cosmos]', ...args) }
// Always log errors regardless of debug flag
export function debugError(...args) { console.error('[cosmos]', ...args) }
