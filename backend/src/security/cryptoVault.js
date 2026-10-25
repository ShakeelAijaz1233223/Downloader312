import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import { ENV } from '../config/env.js';

function getMasterKeyBuffer() {
  const hex = String(ENV.AES_256_VAULT_KEY || '').trim();
  if (/^[0-9a-fA-F]{64}$/.test(hex)) {
    return Buffer.from(hex, 'hex');
  }
  return crypto.createHash('sha256').update(hex).digest();
}

// ============================================================================
// REAL AES-256-GCM AUTHENTICATED ENCRYPTION FOR COOKIES VAULT (ZERO PLAINTEXT!)
// ============================================================================
export function encryptVaultSecret(plaintext) {
  const key = getMasterKeyBuffer();
  const iv = crypto.randomBytes(12); // Recommended 96-bit GCM IV
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ivHex: iv.toString('hex'),
    authTagHex: authTag.toString('hex'),
    ciphertextHex: encrypted.toString('hex'),
    maskedPreview: `AES256-GCM::${encrypted.toString('hex').slice(0, 18)}...`,
  };
}

export function decryptVaultSecret({ ivHex, authTagHex, ciphertextHex }) {
  const key = getMasterKeyBuffer();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

// ============================================================================
// BCRYPT HASHING + JWT PADLOCK / ADMIN / USER TOKENS + RFC-6238 TOTP 2FA
// ============================================================================
export async function hashSecret(plain) {
  return bcrypt.hash(String(plain), 12);
}

export async function verifySecretHash(plain, hash) {
  return bcrypt.compare(String(plain), String(hash));
}

// Constant-time string compare (no length / prefix timing leak).
export function safeEqualString(a, b) {
  const left = Buffer.from(String(a ?? ''), 'utf8');
  const right = Buffer.from(String(b ?? ''), 'utf8');
  if (left.length !== right.length) {
    // Still burn the same amount of work, then fail.
    crypto.timingSafeEqual(left, left);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

/**
 * Second factor: accepts the owner's static Pro-Security passcode AND any real
 * RFC-6238 authenticator code for the configured secret.
 * An EMPTY code is always rejected — password-only login is not allowed.
 */
export function verifyTotp2FA(tokenInput, totpSecret = ENV.ADMIN_TOTP_SECRET) {
  const cleaned = String(tokenInput || '').replace(/\s+/g, '').trim();
  if (!cleaned) return false;

  const staticCodes = String(ENV.ADMIN_STATIC_2FA_CODE || '')
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean);
  for (const code of staticCodes) {
    if (safeEqualString(cleaned, code)) return true;
  }

  if (!/^\d{6}$/.test(cleaned)) return false;
  try {
    return authenticator.check(cleaned, totpSecret || ENV.ADMIN_TOTP_SECRET);
  } catch {
    return false;
  }
}

export function signPadlockTicket(ipAddress) {
  return jwt.sign({ scope: 'padlock_gate_1', ip: ipAddress }, ENV.PADLOCK_TICKET_SECRET, {
    expiresIn: '10m',
  });
}

export function verifyPadlockTicket(ticket) {
  return jwt.verify(String(ticket), ENV.PADLOCK_TICKET_SECRET);
}

export function signAdminAccessToken(admin) {
  return jwt.sign(
    {
      sub: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role || 'super_admin',
      scope: 'super_admin_vault',
    },
    ENV.JWT_ADMIN_SECRET,
    { expiresIn: '8h' }
  );
}

export function verifyAdminAccessToken(token) {
  return jwt.verify(String(token), ENV.JWT_ADMIN_SECRET);
}

export function signUserAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      scope: 'registered_user',
    },
    ENV.JWT_USER_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyUserAccessToken(token) {
  return jwt.verify(String(token), ENV.JWT_USER_SECRET);
}

// Sanitize Custom Admin SVG Markup (Prevents stored XSS `<script>`, `onload=`, `javascript:`)
export function sanitizeCustomSvg(rawSvg) {
  if (!rawSvg || typeof rawSvg !== 'string') return '';
  const trimmed = rawSvg.trim();
  if (!trimmed.toLowerCase().startsWith('<svg')) return '';
  return trimmed
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript:/gi, '');
}
