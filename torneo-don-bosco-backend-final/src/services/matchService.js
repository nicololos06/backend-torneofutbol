import { z } from 'zod';
import Partido from '../models/matchModel.js';
import Equipo from '../models/teamModel.js';
import { AppError } from '../utils/AppError.js';
import {
  parse,
  parseId,
  idSchema,
  pagination,
  pageResult,
  matchInput,
  resultInput,
  nonEmpty,
  validateMatchRules,
} from './validation.js';

const populate = (query) =>
  query
    .populate('equipoLocalId')
    .populate('equipoVisitanteId')
    .populate({ path: 'creadoPorId', select: 'nombre rol' });
const updateInput = nonEmpty(
  matchInput
    .partial()
    .extend({
      jornada: z.number().int().min(1).max(20).nullable().optional(),
      resultado: resultInput.nullable().optional(),
    }),
);

async function validateReferences(values, requireActive) {
  const [local, visitor] = await Promise.all([
    Equipo.findById(values.equipoLocalId),
    Equipo.findById(values.equipoVisitanteId),
  ]);
  if (!local || !visitor) throw new AppError(404, 'Uno de los equipos referenciados no existe');
  if (requireActive && (!local.activo || !visitor.activo))
    throw new AppError(400, 'Para asignar equipos al partido ambos deben estar activos');
  if (local.categoria !== visitor.categoria)
    throw new AppError(400, 'Los equipos deben pertenecer a la misma categoría');
  if (values.fase === 'grupos' && local.grupo !== visitor.grupo)
    throw new AppError(400, 'En fase de grupos los equipos deben pertenecer al mismo grupo');
}
export async function list(query) {
  const { page, limit, equipoId, desde, hasta, ...filters } = parse(
    z
      .object({
        ...pagination,
        equipoId: idSchema.optional(),
        fase: matchInput.shape.fase.optional(),
        estado: matchInput.shape.estado,
        jornada: z.coerce.number().int().min(1).max(20).optional(),
        desde: z.iso.datetime({ offset: true }).optional(),
        hasta: z.iso.datetime({ offset: true }).optional(),
      })
      .strict(),
    query,
  );
  if (desde && hasta && new Date(desde) > new Date(hasta))
    throw new AppError(400, 'desde debe ser anterior o igual a hasta');
  if (equipoId) filters.$or = [{ equipoLocalId: equipoId }, { equipoVisitanteId: equipoId }];
  if (desde || hasta)
    filters.fechaHora = {
      ...(desde && { $gte: new Date(desde) }),
      ...(hasta && { $lte: new Date(hasta) }),
    };
  const [data, total] = await Promise.all([
    populate(
      Partido.find(filters)
        .sort({ fechaHora: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ),
    Partido.countDocuments(filters),
  ]);
  return pageResult(data, total, page, limit);
}
export async function get(id) {
  parseId(id);
  const match = await populate(Partido.findById(id));
  if (!match) throw new AppError(404, 'Partido no encontrado');
  return match;
}
export async function create(input, actorId) {
  const values = { estado: 'programado', ...parse(matchInput, input) };
  validateMatchRules(values);
  await validateReferences(values, true);
  const match = await Partido.create({ ...values, creadoPorId: actorId });
  return get(String(match._id));
}
export async function update(id, input) {
  parseId(id);
  const values = parse(updateInput, input);
  const match = await Partido.findById(id);
  if (!match) throw new AppError(404, 'Partido no encontrado');
  const candidate = { ...match.toObject(), ...values };
  validateMatchRules(candidate);
  await validateReferences(candidate, Boolean(values.equipoLocalId || values.equipoVisitanteId));
  for (const [key, value] of Object.entries(values))
    match.set(key, value === null ? undefined : value);
  await match.save();
  return get(id);
}
export async function remove(id) {
  parseId(id);
  const match = await Partido.findByIdAndDelete(id);
  if (!match) throw new AppError(404, 'Partido no encontrado');
  return { message: 'Partido eliminado' };
}
