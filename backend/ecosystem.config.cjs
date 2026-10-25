module.exports = {
  apps: [
    {
      name: 'ultradownloader-backend-v7',
      script: './src/server.js',
      instances: 1, // Single primary node keeps RAM SSE Bus unified unless REDIS_ENABLED=true
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        HOST: '0.0.0.0',
      },
    },
  ],
};
