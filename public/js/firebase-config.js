// Firebase Configuration Manager
// Retrieves configuration from localStorage or from the Node.js backend (/api/config)

const STORAGE_KEY = 'firechat_firebase_config';

/**
 * Fetch Firebase config either from localStorage (user override) or from backend (.env)
 * @returns {Promise<Object|null>}
 */
export async function getFirebaseConfig() {
  // 1. Check if user configured directly in browser
  try {
    const savedConfig = localStorage.getItem(STORAGE_KEY);
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      if (isValidConfig(parsed)) {
        return { config: parsed, source: 'localStorage' };
      }
    }
  } catch (err) {
    console.warn('Failed to parse localStorage Firebase config', err);
  }

  // 2. Fetch from Node backend .env (if running with Node server)
  try {
    const response = await fetch('./api/config');
    if (response && response.ok) {
      const data = await response.json();
      if (data.configured && data.config && isValidConfig(data.config)) {
        return { config: data.config, source: 'env' };
      }
    }
  } catch (err) {
    // Expected on static hosts like GitHub Pages where /api/config doesn't exist
  }

  return { config: null, source: 'none' };
}

/**
 * Validates that minimum required Firebase configuration fields exist
 * @param {Object} cfg 
 * @returns {boolean}
 */
export function isValidConfig(cfg) {
  if (!cfg) return false;
  return Boolean(
    cfg.apiKey &&
    cfg.apiKey.trim() !== '' &&
    cfg.projectId &&
    cfg.projectId.trim() !== '' &&
    cfg.authDomain &&
    cfg.authDomain.trim() !== ''
  );
}

/**
 * Saves config to browser localStorage
 * @param {Object} cfg 
 */
export function saveFirebaseConfig(cfg) {
  if (!isValidConfig(cfg)) {
    throw new Error('Please fill in at least API Key, Auth Domain, and Project ID.');
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

/**
 * Clears saved config from localStorage
 */
export function clearFirebaseConfig() {
  localStorage.removeItem(STORAGE_KEY);
}
