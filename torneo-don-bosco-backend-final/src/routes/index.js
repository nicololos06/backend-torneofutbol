import { Router } from 'express';
import * as system from '../controllers/systemController.js';
import teamRoute from './teamRoute.js';
import matchRoute from './matchRoute.js';
import { createAuthRoute, createUserRoute } from './userRoute.js';

export function createRouter() {
  const router = Router();
  router.get('/health', system.health);
  router.use('/auth', createAuthRoute());
  router.use('/usuarios', createUserRoute());
  router.use('/equipos', teamRoute);
  router.use('/partidos', matchRoute);
  router.get('/posiciones', system.standings);
  return router;
}
