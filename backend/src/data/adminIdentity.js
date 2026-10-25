// ============================================================================
// SINGLE SOURCE OF TRUTH — SUPER-ADMIN IDENTITY, PADLOCK PIN & PRO-SECURITY URL
//
// Nothing else in the codebase may hard-code an admin e-mail / password / PIN.
// The plaintext values only ever live in `backend/.env` on the server; the
// database stores bcrypt hashes and the browser never receives a credential.
// ============================================================================
import { ENV } from '../config/env.js';

export const ADMIN_BRAND = 'ShakeelAdminProDownloader';

// The secret console slug stays exactly `vault-control-x9p4`; the Pro-Security
// segment can be placed either in front of it or after it, so all three URLs
// open the same command center (and the old bookmark keeps working forever).
// Keep this list in sync with ADMIN_ROUTE_PATHS in frontend/src/App.jsx.
export const ADMIN_ROUTE_SLUGS = [
  'vault-control-x9p4',
  'pro-security/vault-control-x9p4',
  'vault-control-x9p4/pro-security',
];

export const ADMIN_PRIMARY_ROUTE = '/vault-control-x9p4';
export const ADMIN_PRO_SECURITY_ROUTE = '/pro-security/vault-control-x9p4';

// Padlock PIN: the one the owner configured (14 digits). The keypad adapts to
// whatever length the server reports, so a longer PIN needs no code change.
export const ADMIN_PIN = String(ENV.ADMIN_PIN || '78645637189230');
export const ADMIN_PIN_LENGTH = Math.max(4, ADMIN_PIN.length);

export const ADMIN_EMAIL = String(ENV.ADMIN_EMAIL || 'shakeelaijaz559986@gmail.com').toLowerCase();
export const ADMIN_USERNAME = String(ENV.ADMIN_USERNAME || 'shakeeladminprod');
export const ADMIN_FULL_NAME = String(ENV.ADMIN_FULL_NAME || 'Shakeel Ahmed — Super Admin');
export const ADMIN_PASSWORD = String(ENV.ADMIN_PASSWORD || '');
export const ADMIN_STATIC_2FA_CODE = String(ENV.ADMIN_STATIC_2FA_CODE || ENV.ADMIN_ALLOW_DEV_TOTP_CODE || '');

export const ADMIN_MAX_FAILED_ATTEMPTS = Number(ENV.ADMIN_MAX_FAILED_ATTEMPTS || 3);
export const ADMIN_BAN_DURATION_MINUTES = Number(ENV.ADMIN_BAN_DURATION_MINUTES || 30);

/** Public (non-secret) description of the login screen — safe to send to a browser. */
export function getAdminLoginHints() {
  return {
    brand: ADMIN_BRAND,
    // Never expose the admin e-mail on a public endpoint: the owner types it.
    pinLength: ADMIN_PIN_LENGTH,
    totpLength: 6,
    supportsAuthenticatorApp: true,
    maxFailedAttempts: ADMIN_MAX_FAILED_ATTEMPTS,
    lockoutMinutes: ADMIN_BAN_DURATION_MINUTES,
    routes: {
      primary: ADMIN_PRIMARY_ROUTE,
      proSecurity: ADMIN_PRO_SECURITY_ROUTE,
    },
  };
}

/** Seed row used for the very first boot (hashes are computed by the caller). */
export function buildAdminSeedRow({ pinHash, passwordHash, totpSecret }) {
  return {
    id: 'admin-master-01',
    username: ADMIN_USERNAME,
    email: ADMIN_EMAIL,
    full_name: ADMIN_FULL_NAME,
    password_hash: passwordHash,
    pin_hash: pinHash,
    totp_secret: totpSecret || ENV.ADMIN_TOTP_SECRET,
    role: 'super_admin',
  };
}
