const DEBUG = typeof window !== 'undefined' && localStorage.getItem('cosmos_debug') === '1'
export function debugLog(...args) { if (DEBUG) console.log('[cosmos]', ...args) }
export function debugWarn(...args) { if (DEBUG) console.warn('[cosmos]', ...args) }
export function debugError(...args) { console.error('[cosmos]', ...args) }
