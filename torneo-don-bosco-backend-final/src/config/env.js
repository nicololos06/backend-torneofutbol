import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// Las variables del sistema tienen prioridad, luego .env.local y después .env.
dotenv.config({ path: fileURLToPath(new URL('../../.env.local', import.meta.url)), quiet: true });
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  adminEmail: process.env.SEED_ADMIN_EMAIL,
  adminPassword: process.env.SEED_ADMIN_PASSWORD,
};

export function validateConfig() {
  if (!config.mongoUri) throw new Error('Falta MONGODB_URI');
  if (!config.jwtSecret || config.jwtSecret.length < 32)
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535)
    throw new Error('PORT inválido');
  if (config.env === 'production' && config.jwtSecret.includes('solo-desarrollo')) {
    throw new Error('Reemplazar JWT_SECRET de ejemplo antes de producción');
  }
}
