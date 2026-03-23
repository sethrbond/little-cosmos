const DEBUG = typeof window !== 'undefined' && localStorage.getItem('cosmos_debug') === '1'
export function debugWarn(...args) { if (DEBUG) console.warn('[cosmos]', ...args) }
