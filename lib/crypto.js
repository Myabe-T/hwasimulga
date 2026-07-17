// AES-GCM (256-bit) Utility for Application-Layer Encryption
// Works in Edge Runtime, Node.js, and Browser (Web Crypto API)

// We use a predefined 256-bit AES secret or fallback
const RAW_SECRET = process.env.NEXT_PUBLIC_AES_SECRET || 'desihawas-aes-256-secret-key-2024';

let cachedKey = null;

async function getKey() {
  if (cachedKey) return cachedKey;
  
  // Hash the raw secret to ensure it's exactly 256 bits (32 bytes)
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.digest('SHA-256', encoder.encode(RAW_SECRET));
  
  cachedKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  return cachedKey;
}

// Convert ArrayBuffer to Hex String
function buf2hex(buffer) {
  return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

// Convert Hex String to Uint8Array
function hex2buf(hexString) {
  const bytes = new Uint8Array(Math.ceil(hexString.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Encrypts a JSON payload using AES-GCM
 * @param {any} data - The JSON object to encrypt
 * @returns {Promise<{ cipher: string, iv: string }>} - Hex encoded cipher and iv
 */
export async function encryptPayload(data) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(JSON.stringify(data));
  
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedData
  );
  
  return {
    cipher: buf2hex(cipherBuffer),
    iv: buf2hex(iv)
  };
}

/**
 * Decrypts a payload back to JSON
 * @param {string} cipherHex - Hex encoded ciphertext
 * @param {string} ivHex - Hex encoded IV
 * @returns {Promise<any>} - The decrypted JSON object
 */
export async function decryptPayload(cipherHex, ivHex) {
  try {
  if (!cipherHex || !ivHex) throw new Error('Missing cipher or iv');
  
  const key = await getKey();
  const iv = hex2buf(ivHex);
  const cipherBuffer = hex2buf(cipherHex);
  
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherBuffer
  );
  
  const decoder = new TextDecoder();
  const jsonString = decoder.decode(decryptedBuffer);
  return JSON.parse(jsonString);
  } catch (e) {
    console.error('Decryption failed:', e);
    return null;
  }
}

/**
 * Safe fetch wrapper for client-side API calls
 * Automatically encrypts the body (if present) and decrypts the response
 */
export async function secureFetch(url, options = {}) {
  const isPost = options.method && options.method.toUpperCase() !== 'GET';
  
  let finalOptions = { ...options };
  
  if (isPost && finalOptions.body && typeof finalOptions.body === 'string') {
    // Encrypt the JSON body
    try {
      const rawData = JSON.parse(finalOptions.body);
      const encryptedBody = await encryptPayload(rawData);
      finalOptions.body = JSON.stringify(encryptedBody);
    } catch(e) {}
  }
  
  const response = await fetch(url, finalOptions);
  
  // Clone response so we can read body
  const resClone = response.clone();
  try {
    const data = await resClone.json();
    if (data.cipher && data.iv) {
      const decrypted = await decryptPayload(data.cipher, data.iv);
      // Return a mocked Response object with the decrypted JSON
      return new Response(JSON.stringify(decrypted), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }
  } catch (e) {
    // Not JSON or not encrypted, just fall through and return original response
  }
  
  return response;
}
