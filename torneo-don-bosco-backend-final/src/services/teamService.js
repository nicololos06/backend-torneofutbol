import { z } from 'zod';
import Equipo from '../models/teamModel.js';
import Partido from '../models/matchModel.js';
import { AppError } from '../utils/AppError.js';
import { parse, parseId, pagination, pageResult, teamInput, nonEmpty } from './validation.js';

const references = (id) => ({ $or: [{ equipoLocalId: id }, { equipoVisitanteId: id }] });
export async function list(query) {
  const { page, limit, ...filters } = parse(
    z
      .object({
        ...pagination,
        grupo: z.enum(['A', 'B']).optional(),
        categoria: z.enum(['Infantil', 'Juvenil', 'Senior']).optional(),
        activo: z
          .enum(['true', 'false'])
          .transform((v) => v === 'true')
          .optional(),
      })
      .strict(),
    query,
  );
  const [data, total] = await Promise.all([
    Equipo.find(filters)
      .sort({ nombre: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Equipo.countDocuments(filters),
  ]);
  return pageResult(data, total, page, limit);
}
export async function get(id) {
  parseId(id);
  const team = await Equipo.findById(id);
  if (!team) throw new AppError(404, 'Equipo no encontrado');
  return team;
}
export async function create(input) {
  return Equipo.create(parse(teamInput, input));
}
export async function update(id, input) {
  const values = parse(nonEmpty(teamInput.partial()), input);
  const team = await get(id);
  const changesIdentity = ['grupo', 'categoria'].some(
    (key) => values[key] !== undefined && values[key] !== team[key],
  );
  if (changesIdentity && (await Partido.exists(references(id))))
    throw new AppError(
      409,
      'No se puede cambiar grupo o categoría de un equipo con partidos registrados',
    );
  Object.assign(team, values);
  return team.save();
}
export async function remove(id) {
  await get(id);
  if (await Partido.exists(references(id)))
    throw new AppError(409, 'El equipo tiene partidos asociados; podés desactivarlo con PATCH');
  await Equipo.deleteOne({ _id: id });
  return { message: 'Equipo eliminado' };
}
