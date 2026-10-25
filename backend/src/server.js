import { ENV } from './config/env.js';
import { initDatabase } from './db/database.js';
import { initLiveCardBus } from './services/liveCardBus.js';
import { getMediaBinariesStatus } from './services/extractorEngine.js';
import { createBackendApp } from './app.js';
import { logger } from './utils/logger.js';

async function bootstrapServer() {
  // 1. Bind HTTP Port 4000 IMMEDIATELY (<80ms) — zero binary downloads, zero ECONNREFUSED!
  const app = createBackendApp();

  const server = app.listen(ENV.PORT, ENV.HOST, () => {
    logger.info(
      { url: `http://${ENV.HOST}:${ENV.PORT}` },
      `UltraDownloader V10.0 Pure-IDM Backend active on http://${ENV.HOST}:${ENV.PORT}`
    );
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.info(
        { port: ENV.PORT },
        `Backend API already running on port ${ENV.PORT} — ready with zero conflict.`
      );
      process.exit(0);
    }
    logger.error({ err }, 'HTTP server bind error');
  });

  // 2. Initialize XAMPP MySQL & Live Card Bus
  await initLiveCardBus();
  const dbInfo = await initDatabase();
  const engine = await getMediaBinariesStatus();

  logger.info(
    {
      dbDriver: dbInfo.driver,
      xamppConnected: dbInfo.connected,
      pureIdmEngine: engine.engineMode,
      windowsIdmDetected: engine.windowsIdmDetected,
    },
    'UltraDownloader V10.0 Engine fully initialized and ready!'
  );

  // Background warm-up (never blocks a request): YouTube visitor session,
  // SQL pool keep-alive and the platform catalogue cache.
  setImmediate(() => {
    import('./services/extractorEngine.js')
      .then((engine) => engine.warmUpExtractorEngine?.())
      .catch(() => {});
  });

  const gracefulShutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

bootstrapServer().catch((err) => {
  logger.error({ err }, 'Unexpected warning during bootstrap');
});
