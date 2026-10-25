import pino from 'pino';
import { ENV } from '../config/env.js';

export const logger = pino({
  level: ENV.NODE_ENV === 'test' ? 'silent' : 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-admin-token"]',
      'req.headers["x-admin-padlock-ticket"]',
      'password',
      'pin',
      'ephemeralCookiesTxt',
      'cookieText',
    ],
    remove: true,
  },
});
