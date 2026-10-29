// Firebase Configuration Manager
// Retrieves configuration from default constants, localStorage, or Node.js backend (/api/config)

const STORAGE_KEY = 'firechat_firebase_config';

// User's default project configuration
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAq5CfhRRJwCapoWgUwgfDRlRDjCiASVZo",
  authDomain: "connect-37efb.firebaseapp.com",
  projectId: "connect-37efb",
  storageBucket: "connect-37efb.firebasestorage.app",
  messagingSenderId: "63782859773",
  appId: "1:63782859773:web:16303078ab723c4359df94",
  measurementId: "G-N19WCBQ6SH"
};

/**
 * Fetch Firebase config either from localStorage, backend .env, or default constants
 * @returns {Promise<Object>}
 */
export async function getFirebaseConfig() {
  // 1. Check if user configured custom override directly in browser
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
    // Expected on static hosts like GitHub Pages
  }

  // 3. Fallback to built-in project configuration
  if (isValidConfig(DEFAULT_FIREBASE_CONFIG)) {
    return { config: DEFAULT_FIREBASE_CONFIG, source: 'default' };
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
