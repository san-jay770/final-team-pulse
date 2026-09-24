/**
 * TEAM PULSE — Universal Password Verifier & Hasher
 * Optimized Async Version with Memory Cache
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const util   = require('util');

const pbkdf2Async = util.promisify(crypto.pbkdf2);
const scryptAsync = util.promisify(crypto.scrypt);

// In-memory cache for validated password matches (speeds up repeat auth checks)
const verifiedCache = new Map();
const MAX_CACHE_SIZE = 500;

function cacheKey(plain, hash) {
  return crypto.createHash('sha256').update(`${plain}:${hash}`).digest('hex');
}

/**
 * Verify a plain password against a stored hash in any supported format
 */
async function verifyPassword(plainPassword, storedHash) {
  if (!plainPassword || !storedHash) return false;

  const key = cacheKey(plainPassword, storedHash);
  if (verifiedCache.has(key)) {
    return verifiedCache.get(key);
  }

  let isMatch = false;

  // 1. Check bcrypt ($2a$, $2b$, $2y$)
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    try {
      isMatch = await bcrypt.compare(plainPassword, storedHash);
    } catch (e) {
      isMatch = false;
    }
  }
  // 2. Check Werkzeug PBKDF2: pbkdf2:sha256:iterations$salt$hash
  else if (storedHash.startsWith('pbkdf2:')) {
    try {
      const parts = storedHash.split('$');
      if (parts.length >= 3) {
        const prefixParts = parts[0].split(':');
        const algo = prefixParts[1] || 'sha256';
        const iterations = parseInt(prefixParts[2] || '1000000', 10);
        const salt = parts[1];
        const expectedHash = parts[2];

        const derived = await pbkdf2Async(
          plainPassword,
          salt,
          iterations,
          expectedHash.length / 2,
          algo
        );

        isMatch = derived.toString('hex').toLowerCase() === expectedHash.toLowerCase();
      }
    } catch (e) {
      console.error('[PasswordUtil] pbkdf2 verify error:', e.message);
      isMatch = false;
    }
  }
  // 3. Check Werkzeug Scrypt: scrypt:N:r:p$salt$hash
  else if (storedHash.startsWith('scrypt:')) {
    try {
      const parts = storedHash.split('$');
      if (parts.length >= 3) {
        const prefixParts = parts[0].split(':');
        const N = parseInt(prefixParts[1] || '32768', 10);
        const r = parseInt(prefixParts[2] || '8', 10);
        const p = parseInt(prefixParts[3] || '1', 10);
        const salt = parts[1];
        const expectedHash = parts[2];

        const derived = await scryptAsync(
          plainPassword,
          salt,
          expectedHash.length / 2,
          { N, r, p, maxmem: 128 * 1024 * 1024 }
        );

        isMatch = derived.toString('hex').toLowerCase() === expectedHash.toLowerCase();
      }
    } catch (e) {
      console.error('[PasswordUtil] scrypt verify error:', e.message);
      isMatch = false;
    }
  }
  // 4. Fallback plain text comparison
  else {
    isMatch = plainPassword === storedHash;
  }

  // Cache successful match
  if (isMatch) {
    if (verifiedCache.size >= MAX_CACHE_SIZE) {
      const firstKey = verifiedCache.keys().next().value;
      verifiedCache.delete(firstKey);
    }
    verifiedCache.set(key, true);
  }

  return isMatch;
}

/**
 * Hash a password using standard bcrypt
 */
async function hashPassword(plainPassword) {
  return await bcrypt.hash(plainPassword, 10);
}

module.exports = {
  verifyPassword,
  hashPassword,
};
