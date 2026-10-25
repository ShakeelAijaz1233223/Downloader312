import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
export const BACKEND_ROOT = path.resolve(path.dirname(__filename), '../..');

dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });

const rawOrigins = process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173';

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 4000),
  HOST: process.env.HOST || '0.0.0.0',
  PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL || 'http://localhost:5173',
  CORS_ORIGINS: rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  // XAMPP MySQL Connection (Default XAMPP: 127.0.0.1:3306, user=root, password="")
  DB_HOST: process.env.DB_HOST || '127.0.0.1',
  DB_PORT: Number(process.env.DB_PORT || 3306),
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD ?? '',
  DB_NAME: process.env.DB_NAME || 'ultradownloader_db',

  // Storage Directories
  VAULT_STORAGE_DIR: path.resolve(
    BACKEND_ROOT,
    process.env.VAULT_STORAGE_DIR || './storage/vault'
  ),
  TEMP_EPHEMERAL_DIR: path.resolve(
    BACKEND_ROOT,
    process.env.TEMP_EPHEMERAL_DIR || './storage/tmp'
  ),

  EXTRACTOR_TIMEOUT_MS: Number(process.env.EXTRACTOR_TIMEOUT_MS || 25000),

  JWT_ADMIN_SECRET:
    process.env.JWT_ADMIN_SECRET ||
    'ultradownloader_v10_superadmin_jwt_secret_key_change_in_prod_998877',
  JWT_USER_SECRET:
    process.env.JWT_USER_SECRET ||
    'ultradownloader_v10_public_user_jwt_secret_key_change_in_prod_445566',
  PADLOCK_TICKET_SECRET:
    process.env.PADLOCK_TICKET_SECRET ||
    'ultradownloader_v10_gate1_padlock_ticket_secret_key_112233',
  AES_256_VAULT_KEY:
    process.env.AES_256_VAULT_KEY ||
    '7f9a8b2c4d6e1f3a5b7c9d0e2f4a6b8c1d3e5f7a9b0c2d4e6f8a0b1c3d5e7f9a',
  ADMIN_TOTP_SECRET: process.env.ADMIN_TOTP_SECRET || 'JBSWY3DPEHPK3PXP',
  // Static 6-digit Pro-Security passcode (second factor). Real RFC-6238
  // authenticator codes are still accepted for the same secret.
  ADMIN_STATIC_2FA_CODE: process.env.ADMIN_STATIC_2FA_CODE || '189230',
  // Legacy alias kept so old deployments keep working (no other code reads it).
  ADMIN_ALLOW_DEV_TOTP_CODE: process.env.ADMIN_STATIC_2FA_CODE || '189230',

  // Super-Admin identity (bcrypt hashes are stored in SQL, never the plaintext)
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'shakeelaijaz559986@gmail.com',
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'shakeeladminprod',
  ADMIN_FULL_NAME: process.env.ADMIN_FULL_NAME || 'Shakeel Ahmed — Super Admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'ShakeelAhmed@@45637189230',
  ADMIN_PIN: process.env.ADMIN_PIN || '78645637189230',

  // Signed download tickets are stored server-side, so the URL stays short
  // (long base64 payloads used to be truncated by proxies -> "link modified").
  DOWNLOAD_TICKET_TTL_SECONDS: Number(process.env.DOWNLOAD_TICKET_TTL_SECONDS || 900),
  DOWNLOAD_TICKET_MAX_LENGTH: Number(process.env.DOWNLOAD_TICKET_MAX_LENGTH || 512),

  ADMIN_IP_ALLOWLIST: (process.env.ADMIN_IP_ALLOWLIST || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean),
  ADMIN_MAX_FAILED_ATTEMPTS: Number(process.env.ADMIN_MAX_FAILED_ATTEMPTS || 3),
  ADMIN_BAN_DURATION_MINUTES: Number(process.env.ADMIN_BAN_DURATION_MINUTES || 30),

  GUEST_DAILY_DOWNLOAD_LIMIT: Number(process.env.GUEST_DAILY_DOWNLOAD_LIMIT || 50),
  USER_DAILY_DOWNLOAD_LIMIT: Number(process.env.USER_DAILY_DOWNLOAD_LIMIT || 500),
};
