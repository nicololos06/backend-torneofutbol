import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as controller from '../controllers/userController.js';
import { verifyToken, allowRoles } from '../middleware/verifyToken.js';

export function createAuthRoute() {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { message: 'Demasiados intentos; intentá de nuevo más tarde' } },
  });
  router.post('/register', limiter, controller.register);
  router.post('/login', limiter, controller.login);
  router.get('/me', verifyToken, controller.me);
  return router;
}
export function createUserRoute() {
  const router = Router();
  router.use(verifyToken, allowRoles('admin'));
  router.get('/', controller.list);
  router.patch('/:id', controller.updateAccess);
  return router;
}
