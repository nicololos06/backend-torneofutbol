import { authenticate } from '../services/userService.js';
import { AppError } from '../utils/AppError.js';

export async function verifyToken(req, res, next) {
  try {
    req.user = await authenticate(req.headers.authorization);
    next();
  } catch (error) {
    next(error);
  }
}
export const allowRoles =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(new AppError(401, 'Iniciá sesión'));
    if (!roles.includes(req.user.rol))
      return next(new AppError(403, 'No tenés permisos para esta acción'));
    next();
  };
