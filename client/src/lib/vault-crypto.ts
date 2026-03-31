/**
 * Vault Crypto — Web Crypto API utilities for client-side encryption
 *
 * Algorithms:
 *  - Key derivation : PBKDF2-SHA256 (600 000 iterations par défaut)
 *  - Symmetric      : AES-256-GCM
 *  - Asymmetric     : RSA-OAEP 2048
 *  - TOTP           : HMAC-SHA1 (RFC 6238)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// Ensure Uint8Array always has ArrayBuffer (not SharedArrayBuffer) as its buffer type.
// This satisfies strict WebCrypto typings (BufferSource = ArrayBuffer | ArrayBufferView<ArrayBuffer>).
function asTypedBytes(arr: Uint8Array): Uint8Array<ArrayBuffer> {
  if (arr.buffer instanceof ArrayBuffer) return arr as Uint8Array<ArrayBuffer>;
  const copy = new ArrayBuffer(arr.byteLength);
  new Uint8Array(copy).set(arr);
  return new Uint8Array(copy);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new ArrayBuffer(bin.length);
  const view = new Uint8Array(out);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return view;
}

function strToBytes(str: string): Uint8Array<ArrayBuffer> {
  return asTypedBytes(new TextEncoder().encode(str));
}

function bytesToStr(buf: ArrayBuffer): string {
  return new TextDecoder().decode(buf);
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(n);
  crypto.getRandomValues(new Uint8Array(buf));
  return new Uint8Array(buf);
}

// ─────────────────────────────────────────────────────────────────────────────
// Key derivation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dérive une CryptoKey AES-256-GCM depuis un mot de passe + sel (PBKDF2-SHA256).
 */
export async function deriveKey(
  password: string,
  salt: string,
  iterations: number = 600_000,
): Promise<CryptoKey> {
  const passKey = await crypto.subtle.importKey(
    'raw',
    strToBytes(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: strToBytes(salt),
      iterations,
      hash: 'SHA-256',
    },
    passKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AES-256-GCM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chiffre une chaîne en AES-256-GCM.
 * Retourne base64(IV_12B ‖ ciphertext ‖ tag_16B).
 */
export async function encrypt(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    strToBytes(plaintext),
  );

  // Combine iv + ciphertext (tag already appended by WebCrypto)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return toBase64(combined.buffer);
}

/**
 * Déchiffre un message produit par `encrypt`.
 */
export async function decrypt(key: CryptoKey, ciphertext: string): Promise<string> {
  const data = fromBase64(ciphertext);
  const iv = data.slice(0, 12);
  const payload = data.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    payload,
  );
  return bytesToStr(plaintext);
}

// ─────────────────────────────────────────────────────────────────────────────
// RSA-OAEP 2048
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère une paire de clés RSA-OAEP 2048 bits.
 * Retourne les clés encodées en base64 (SPKI / PKCS#8).
 */
export async function generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  );

  const [pubRaw, privRaw] = await Promise.all([
    crypto.subtle.exportKey('spki', pair.publicKey),
    crypto.subtle.exportKey('pkcs8', pair.privateKey),
  ]);

  return {
    publicKey: toBase64(pubRaw),
    privateKey: toBase64(privRaw),
  };
}

/**
 * Chiffre `data` avec une clé publique RSA-OAEP (base64 SPKI).
 */
export async function encryptWithPublicKey(publicKeyB64: string, data: string): Promise<string> {
  const pub = await crypto.subtle.importKey(
    'spki',
    fromBase64(publicKeyB64),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    pub,
    strToBytes(data),
  );
  return toBase64(ciphertext);
}

/**
 * Déchiffre `encryptedB64` avec une clé privée RSA-OAEP (base64 PKCS#8).
 */
export async function decryptWithPrivateKey(
  privateKeyB64: string,
  encryptedB64: string,
): Promise<string> {
  const priv = await crypto.subtle.importKey(
    'pkcs8',
    fromBase64(privateKeyB64),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  );

  const plaintext = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    priv,
    fromBase64(encryptedB64),
  );
  return bytesToStr(plaintext);
}

// ─────────────────────────────────────────────────────────────────────────────
// Server auth hash
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Produit un hash envoyé au serveur pour valider le mot de passe
 * sans exposer la clé symétrique dérivée.
 * hash = HMAC-SHA256(masterKey, "auth:" + password) → hex
 */
export async function hashForServer(masterKey: CryptoKey, password: string): Promise<string> {
  const rawKey = await crypto.subtle.exportKey('raw', masterKey);
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    hmacKey,
    strToBytes('auth:' + password),
  );

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// TOTP (RFC 6238)
// ─────────────────────────────────────────────────────────────────────────────

function base32Decode(input: string): Uint8Array<ArrayBuffer> {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = input.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of cleaned) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  const buf = new ArrayBuffer(output.length);
  const view = new Uint8Array(buf);
  output.forEach((b, i) => { view[i] = b; });
  return view;
}

async function hmacSha1(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(signature);
}

/**
 * Génère un code TOTP 6 chiffres côté client (RFC 6238).
 * Utilise la fenêtre de 30 s courante.
 */
export function generateTotp(secretBase32: string): string {
  // Synchronous wrapper — returns a promise, callers must await
  // For use in components, use generateTotpAsync instead.
  throw new Error('Use generateTotpAsync() — TOTP requires async SubtleCrypto.');
}

export async function generateTotpAsync(secretBase32: string): Promise<string> {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / 30);

  // Counter as 8-byte big-endian
  const counterBuf = new ArrayBuffer(8);
  const counterBytes = new Uint8Array(counterBuf);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = c & 0xff;
    c = Math.floor(c / 256);
  }

  const hmac = await hmacSha1(key, new Uint8Array(counterBuf));

  // Dynamic truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    1_000_000;

  return code.toString().padStart(6, '0');
}

// ─────────────────────────────────────────────────────────────────────────────
// Password generator
// ─────────────────────────────────────────────────────────────────────────────

export interface PasswordOptions {
  length: number;
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
}

const CHARS_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CHARS_LOWER = 'abcdefghijklmnopqrstuvwxyz';
const CHARS_DIGITS = '0123456789';
const CHARS_SYMBOLS = '!@#$%^&*()-_=+[]{}|;:,.<>?';

export function generatePassword(opts: PasswordOptions): string {
  let charset = '';
  const required: string[] = [];

  if (opts.upper) {
    charset += CHARS_UPPER;
    required.push(CHARS_UPPER[Math.floor(Math.random() * CHARS_UPPER.length)]);
  }
  if (opts.lower) {
    charset += CHARS_LOWER;
    required.push(CHARS_LOWER[Math.floor(Math.random() * CHARS_LOWER.length)]);
  }
  if (opts.digits) {
    charset += CHARS_DIGITS;
    required.push(CHARS_DIGITS[Math.floor(Math.random() * CHARS_DIGITS.length)]);
  }
  if (opts.symbols) {
    charset += CHARS_SYMBOLS;
    required.push(CHARS_SYMBOLS[Math.floor(Math.random() * CHARS_SYMBOLS.length)]);
  }

  if (!charset) charset = CHARS_LOWER + CHARS_DIGITS;

  const random = crypto.getRandomValues(new Uint8Array(opts.length));
  const chars = Array.from(random).map((b) => charset[b % charset.length]);

  // Ensure at least one character of each required set
  for (let i = 0; i < required.length && i < chars.length; i++) {
    chars[i] = required[i];
  }

  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint8Array(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('').slice(0, opts.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// Password strength
// ─────────────────────────────────────────────────────────────────────────────

export type PasswordStrength = 'faible' | 'correct' | 'fort' | 'excellent';

export function evaluatePasswordStrength(password: string): {
  score: number; // 0–4
  label: PasswordStrength;
} {
  if (!password) return { score: 0, label: 'faible' };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 14) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (password.length >= 20) score++;

  const clamped = Math.min(score, 4);
  const labels: PasswordStrength[] = ['faible', 'faible', 'correct', 'fort', 'excellent'];
  return { score: clamped, label: labels[clamped] };
}

// ─────────────────────────────────────────────────────────────────────────────
// High-level: initialize vault
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialise un nouveau coffre-fort pour l'utilisateur.
 *
 * 1. Dérive masterKey depuis password + email (PBKDF2)
 * 2. Génère une clé symétrique AES-256-GCM (symKey)
 * 3. Génère une paire RSA-OAEP 2048
 * 4. Chiffre symKey avec masterKey → encryptedSymKey
 * 5. Chiffre privateKey avec masterKey → encryptedPrivateKey
 * 6. Produit un hash d'authentification pour le serveur
 */
export async function initializeVault(
  password: string,
  email: string,
): Promise<{
  encryptedSymKey: string;
  encryptedPrivateKey: string;
  publicKey: string;
  passwordHash: string;
}> {
  const masterKey = await deriveKey(password, email);
  const { publicKey, privateKey } = await generateKeyPair();

  // Generate a random sym key and export it
  const symKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
  const symKeyRaw = await crypto.subtle.exportKey('raw', symKey);
  const symKeyB64 = toBase64(symKeyRaw);

  const [encryptedSymKey, encryptedPrivateKey, passwordHash] = await Promise.all([
    encrypt(masterKey, symKeyB64),
    encrypt(masterKey, privateKey),
    hashForServer(masterKey, password),
  ]);

  return { encryptedSymKey, encryptedPrivateKey, publicKey, passwordHash };
}

// ─────────────────────────────────────────────────────────────────────────────
// High-level: unlock vault
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Déverrouille le coffre-fort en dérivant la masterKey puis en déchiffrant la symKey.
 * Retourne la clé symétrique pour chiffrer/déchiffrer les éléments du coffre.
 */
export async function unlockVault(
  password: string,
  email: string,
  encryptedSymKeyB64: string,
): Promise<CryptoKey> {
  const masterKey = await deriveKey(password, email);
  const symKeyB64 = await decrypt(masterKey, encryptedSymKeyB64);
  const symKeyRaw = fromBase64(symKeyB64);

  return crypto.subtle.importKey(
    'raw',
    symKeyRaw,
    { name: 'AES-GCM' },
    false, // not extractable once unlocked
    ['encrypt', 'decrypt'],
  );
}
