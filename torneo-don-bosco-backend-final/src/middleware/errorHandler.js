import { AppError } from '../utils/AppError.js';

export function notFound(req, res, next) {
  next(new AppError(404, 'Ruta no encontrada'));
}
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = 500;
  let message = 'Error interno del servidor';
  let details;
  if (error instanceof AppError) {
    status = error.status;
    message = error.message;
    details = error.details;
  } else if (error.code === 11000) {
    status = 409;
    message = 'Ya existe un registro con esos datos únicos';
  } else if (['ValidationError', 'CastError', 'StrictModeError'].includes(error.name)) {
    status = 400;
    message = 'Datos inválidos para el modelo';
  } else if (error.type === 'entity.parse.failed') {
    status = 400;
    message = 'El cuerpo debe ser JSON válido';
  } else if (error.type === 'entity.too.large') {
    status = 413;
    message = 'El cuerpo supera el límite de 32 KB';
  }
  if (status === 500 && process.env.NODE_ENV !== 'test')
    console.error('Error interno:', error.name);
  res.status(status).json({ error: { message, ...(details && { details }) } });
}
