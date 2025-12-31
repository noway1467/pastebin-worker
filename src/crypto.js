// Lightweight crypto helpers for password-based AES-GCM encryption/decryption

// Derive an AES-GCM key from a password and salt using PBKDF2-SHA256
export async function deriveAesGcmKey(password, salt) {
  const enc = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  )
  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

export function randomBytes(length) {
  const iv = new Uint8Array(length)
  crypto.getRandomValues(iv)
  return iv
}

export async function encryptWithPassword(plainBuffer, password) {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = await deriveAesGcmKey(password, salt)
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plainBuffer,
  )
  return { cipher, salt, iv }
}

export async function decryptWithPassword(cipherBuffer, password, salt, iv) {
  const key = await deriveAesGcmKey(password, salt)
  return await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipherBuffer,
  )
}

export function arrayBufferToBase64(buffer) {
  let binary = ""
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToUint8Array(base64) {
  const binary_string = atob(base64)
  const len = binary_string.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i)
  }
  return bytes
}


