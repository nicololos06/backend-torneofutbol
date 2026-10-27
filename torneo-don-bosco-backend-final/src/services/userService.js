import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import Usuario from '../models/userModel.js';
import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import {
  parse,
  parseId,
  text,
  email,
  password,
  pagination,
  pageResult,
  nonEmpty,
} from './validation.js';

const registration = z.object({ nombre: text(2, 80), email, password }).strict();
const loginInput = z.object({ email, password: z.string().min(1).max(200) }).strict();
const jwtOptions = {
  algorithm: 'HS256',
  issuer: 'don-bosco-api',
  audience: 'don-bosco-web',
  expiresIn: '1h',
};
// Esta función es interna: el registro público nunca recibe rol ni activo.
export async function createAccount(input, role = 'consulta') {
  const values = parse(registration, input);
  const user = new Usuario({ nombre: values.nombre, email: values.email, rol: role });
  user.password = values.password;
  await user.save();
  return user.toJSON();
}
export const register = (input) => createAccount(input);

export async function login(input) {
  const values = parse(loginInput, input);
  const user = await Usuario.findOne({ email: values.email }).select('+passwordHash');
  if (!user || !user.activo || !(await bcrypt.compare(values.password, user.passwordHash))) {
    throw new AppError(401, 'Email o contraseña incorrectos');
  }
  return {
    token: jwt.sign({}, config.jwtSecret, { ...jwtOptions, subject: String(user._id) }),
    tokenType: 'Bearer',
    expiresIn: 3600,
    usuario: user.toJSON(),
  };
}

export async function authenticate(header) {
  if (typeof header !== 'string' || !/^Bearer \S+$/i.test(header))
    throw new AppError(401, 'Se requiere Authorization: Bearer <token>');
  let payload;
  try {
    payload = jwt.verify(header.split(' ')[1], config.jwtSecret, {
      algorithms: ['HS256'],
      issuer: jwtOptions.issuer,
      audience: jwtOptions.audience,
    });
  } catch {
    throw new AppError(401, 'Token inválido o vencido');
  }
  if (typeof payload.sub !== 'string' || !/^[a-f\d]{24}$/i.test(payload.sub))
    throw new AppError(401, 'Token inválido');
  const user = await Usuario.findById(payload.sub);
  if (!user || !user.activo) throw new AppError(401, 'Usuario no disponible');
  return user.toJSON();
}

export async function list(query) {
  const { page, limit } = parse(z.object(pagination).strict(), query);
  const [data, total] = await Promise.all([
    Usuario.find()
      .sort({ nombre: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Usuario.countDocuments(),
  ]);
  return pageResult(data, total, page, limit);
}

export async function updateAccess(id, input, actorId) {
  parseId(id);
  const values = parse(
    nonEmpty(
      z
        .object({
          rol: z.enum(['admin', 'organizador', 'consulta']).optional(),
          activo: z.boolean().optional(),
        })
        .strict(),
    ),
    input,
  );
  if (
    id.toLowerCase() === String(actorId) &&
    (values.activo === false || (values.rol && values.rol !== 'admin'))
  ) {
    throw new AppError(400, 'No podés quitarte tu propio acceso de administrador');
  }
  const user = await Usuario.findById(id);
  if (!user) throw new AppError(404, 'Usuario no encontrado');
  Object.assign(user, values);
  await user.save();
  return user.toJSON();
}
