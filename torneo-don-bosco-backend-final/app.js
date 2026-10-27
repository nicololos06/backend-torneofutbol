import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './src/config/env.js';
import { AppError } from './src/utils/AppError.js';
import { createRouter } from './src/routes/index.js';
import { notFound, errorHandler } from './src/middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
        callback(new AppError(403, 'Origen no permitido por CORS'));
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', createRouter());
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
export default createApp();
