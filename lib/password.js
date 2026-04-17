// Simple password hashing using Web Crypto API (works in Edge Runtime)

export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_latte_diary_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password, hash) {
  const computed = await hashPassword(password);
  return computed === hash;
}

// Generate a random share code (6 chars, URL-safe)
export function generateShareCode() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  for (const b of arr) code += chars[b % chars.length];
  return code;
}

// Generate a session token
export function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}
