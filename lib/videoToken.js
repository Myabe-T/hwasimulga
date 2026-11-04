// lib/videoToken.js — URL-safe, reversible encryption & obfuscation for Video IDs
// Protects raw sequence numbers (e.g., 1163, 10042) from public URLs and share links.
// Fast, lightweight, Edge-compatible and Client-compatible.

const TOKEN_PREFIX = 'v_';
const CIPHER_SALT = 0x5a3c9e71; // Fixed 32-bit permutation mask

/**
 * Obfuscates a numeric video ID into a URL-safe encrypted token.
 * Example: 1163 -> "v_k8f9a2"
 * @param {number|string} id - Raw numeric video ID
 * @returns {string} - Obfuscated token e.g. "v_..."
 */
export function encodeVideoId(id) {
  const num = parseInt(id, 10);
  if (isNaN(num) || num <= 0) return String(id || '');

  // 1. Bitwise mix with fixed salt
  const mixed = (num ^ CIPHER_SALT) >>> 0;

  // 2. Format with checksum nibble to detect tampering
  const check = ((num * 31 + 17) & 0xff);
  const hexMixed = mixed.toString(16).padStart(8, '0');
  const hexCheck = check.toString(16).padStart(2, '0');

  // 3. Return compact hex token with prefix
  return `${TOKEN_PREFIX}${hexMixed}${hexCheck}`;
}

/**
 * Decodes an obfuscated video token back to its raw numeric video ID.
 * Supports backwards compatibility: if passed a plain numeric ID (e.g. "1163"), returns "1163".
 * @param {string} token - The URL token (e.g., "v_..." or raw number)
 * @returns {string|null} - The original raw numeric ID as string, or null if invalid
 */
export function decodeVideoId(token) {
  if (!token) return null;
  const str = String(token).trim();

  // If already a plain positive integer (legacy URL support)
  if (/^\d+$/.test(str)) {
    return str;
  }

  // Check prefix
  if (!str.startsWith(TOKEN_PREFIX)) {
    return str; // Return as-is if unparseable
  }

  const payload = str.slice(TOKEN_PREFIX.length);
  if (payload.length < 10) return null;

  const hexMixed = payload.slice(0, 8);
  const hexCheck = payload.slice(8, 10);

  const mixed = parseInt(hexMixed, 16);
  const check = parseInt(hexCheck, 16);
  if (isNaN(mixed) || isNaN(check)) return null;

  // Reverse bitwise mix
  const num = (mixed ^ CIPHER_SALT) >>> 0;

  // Verify checksum
  const expectedCheck = ((num * 31 + 17) & 0xff);
  if (check !== expectedCheck) {
    return null; // Tampered or invalid token
  }

  return String(num);
}
