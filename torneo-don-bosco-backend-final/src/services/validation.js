import { z } from 'zod';
import { AppError } from '../utils/AppError.js';

export const idSchema = z.string().regex(/^[a-f\d]{24}$/i, 'ObjectId inválido');
export const text = (min, max) => z.string().trim().min(min).max(max);
export const email = text(3, 120).toLowerCase().pipe(z.email());
export const password = z
  .string()
  .min(10)
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Máximo 72 bytes UTF-8');
export const pagination = {
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success)
    throw new AppError(
      400,
      'Datos inválidos',
      result.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    );
  return result.data;
}
export const parseId = (value) => parse(idSchema, value);
export const nonEmpty = (schema) =>
  schema.refine((v) => Object.keys(v).length > 0, 'Enviar al menos un campo');
export const pageResult = (data, total, page, limit) => ({
  data,
  meta: { total, page, limit, pages: Math.ceil(total / limit) },
});

export const teamInput = z
  .object({
    nombre: text(2, 80),
    nombreCorto: text(2, 30),
    grupo: z.enum(['A', 'B']),
    categoria: z.enum(['Infantil', 'Juvenil', 'Senior']),
    escudoUrl: text(1, 300)
      .refine(
        (v) => v.startsWith('/') || /^https?:\/\//.test(v),
        'Usar ruta relativa o URL http(s)',
      )
      .optional(),
    colores: z
      .array(text(2, 30))
      .min(1)
      .max(4)
      .refine((v) => new Set(v).size === v.length, 'Colores duplicados'),
    activo: z.boolean().optional(),
  })
  .strict();

const score = z.number().int().min(0).max(99);
export const resultInput = z
  .object({
    golesLocal: score,
    golesVisitante: score,
    penalesLocal: score.optional(),
    penalesVisitante: score.optional(),
    definidoPor: z.enum(['tiempo_reglamentario', 'penales']),
  })
  .strict();
export const matchInput = z
  .object({
    equipoLocalId: idSchema,
    equipoVisitanteId: idSchema,
    fase: z.enum(['grupos', 'cuartos', 'semifinal', 'final']),
    jornada: z.number().int().min(1).max(20).optional(),
    fechaHora: z.iso.datetime({ offset: true }),
    sede: text(2, 120),
    estado: z.enum(['programado', 'en_juego', 'finalizado', 'suspendido']).optional(),
    resultado: resultInput.optional(),
    observaciones: text(0, 250).optional(),
  })
  .strict();

export function validateMatchRules(match) {
  const fail = (message) => {
    throw new AppError(400, message);
  };
  if (String(match.equipoLocalId) === String(match.equipoVisitanteId))
    fail('Un equipo no puede jugar contra sí mismo');
  if (match.fase === 'grupos' && !match.jornada) fail('Los partidos de grupos requieren jornada');
  if (match.fase !== 'grupos' && match.jornada != null)
    fail('Las eliminatorias no tienen jornada de grupos');
  const r = match.resultado;
  if (match.estado === 'programado' && r) fail('Un partido programado no puede tener resultado');
  if (match.estado === 'finalizado' && !r) fail('Un partido finalizado requiere resultado');
  if (!r) return;
  if (r.definidoPor === 'penales') {
    if (match.fase === 'grupos' || match.estado !== 'finalizado')
      fail('Los penales solo se admiten en eliminatorias finalizadas');
    if (r.golesLocal !== r.golesVisitante) fail('Los penales requieren empate en goles');
    if (
      r.penalesLocal == null ||
      r.penalesVisitante == null ||
      r.penalesLocal === r.penalesVisitante
    )
      fail('Ingresar ambos marcadores de penales con un ganador');
  } else if (r.penalesLocal != null || r.penalesVisitante != null)
    fail('No se admiten penales en tiempo reglamentario');
  if (
    match.fase !== 'grupos' &&
    match.estado === 'finalizado' &&
    r.golesLocal === r.golesVisitante &&
    r.definidoPor !== 'penales'
  )
    fail('Una eliminatoria empatada debe definirse por penales');
}
