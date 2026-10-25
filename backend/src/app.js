import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { ENV } from './config/env.js';
import { attachRequestContext } from './middleware/securityMiddleware.js';
import { trackBackendTxRxMiddleware } from './services/trafficEngine.js';
import { publicRouter } from './routes/publicRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { seoSitemapRouter } from './routes/seoSitemapRoutes.js';
import { AppError, sendError } from './utils/errors.js';
import { logger } from './utils/logger.js';

export function createBackendApp() {
  const app = express();
  app.set('trust proxy', 1);

  // Measure real-time RX (Receive) & TX (Send) bandwidth + latency on every socket chunk!
  app.use(trackBackendTxRxMiddleware);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    })
  );

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (
          ENV.CORS_ORIGINS.includes(origin) ||
          origin.endsWith('.e2b.app') ||
          origin.includes('localhost')
        ) {
          return cb(null, true);
        }
        return cb(null, true);
      },
      credentials: true,
      exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Disposition'],
    })
  );

  // Skip gzip on SSE & binary MP4/HLS streams so zero CPU overhead bottlenecks 100 MB/s+ streaming!
  app.use(
    compression({
      filter: (req, res) => {
        if (
          req.path.includes('/live-cards/stream') ||
          req.path.includes('/downloads/') ||
          req.path.includes('/stream/')
        ) {
          return false;
        }
        return compression.filter(req, res);
      },
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '4mb' }));
  app.use(attachRequestContext);

  // High-Traffic Rate Limiter (1,200 req/min burst safe per IP)
  const publicApiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 1200,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => ENV.NODE_ENV === 'test',
  });
  app.use('/api/v1', publicApiLimiter);

  app.use('/', seoSitemapRouter);
  app.use('/api/v1', publicRouter);
  app.use('/api/v1/admin', adminRouter);

  app.use('/api', (req, _res, next) => {
    next(new AppError(404, 'NOT_FOUND', `API endpoint ${req.method} ${req.originalUrl} does not exist.`));
  });

  app.use((err, req, res, _next) => {
    if (!err.statusCode || err.statusCode >= 500) {
      logger.error({ err, path: req.originalUrl }, 'Unhandled server error');
    }
    return sendError(res, err);
  });

  return app;
}
