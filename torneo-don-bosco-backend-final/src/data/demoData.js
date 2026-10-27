// Datos ficticios de demostración basados en los equipos y el cuadro de la web.
export const teamId = (n) => `66c2${n.toString(16).padStart(20, '0')}`;
export const matchId = (n) => `66c3${n.toString(16).padStart(20, '0')}`;
const names = [
  ['Don Bosco FC', 'Don Bosco', 'A', ['azul', 'amarillo']],
  ['La Gloria', 'La Gloria', 'A', ['rojo', 'blanco']],
  ['Juniors Unidos', 'Juniors', 'A', ['verde', 'blanco']],
  ['Atlético Norte', 'Atlético Norte', 'A', ['negro', 'amarillo']],
  ['Real Madrid Juniors', 'Real Madrid Jrs.', 'B', ['blanco', 'dorado']],
  ['Boca del Riachuelo', 'Boca Riachuelo', 'B', ['azul', 'amarillo']],
  ['River Plate Kids', 'River Kids', 'B', ['blanco', 'rojo']],
  ['San Lorenzo FC', 'San Lorenzo', 'B', ['azul', 'rojo']],
];
export const teams = names.map(([nombre, nombreCorto, grupo, colores], i) => ({
  _id: teamId(i + 1),
  nombre,
  nombreCorto,
  grupo,
  colores,
  categoria: 'Juvenil',
  activo: true,
}));
const fixtures = [
  [1, 2, 'grupos', 1, '2026-04-19T13:00:00Z', 2, 1],
  [3, 4, 'grupos', 1, '2026-04-19T14:00:00Z', 2, 0],
  [5, 6, 'grupos', 1, '2026-04-19T15:00:00Z', 2, 1],
  [7, 8, 'grupos', 1, '2026-04-19T16:00:00Z', 2, 0],
  [1, 3, 'grupos', 2, '2026-04-26T13:00:00Z', 4, 1],
  [2, 4, 'grupos', 2, '2026-04-26T14:00:00Z', 3, 2],
  [5, 7, 'grupos', 2, '2026-04-26T15:00:00Z', 4, 1],
  [6, 8, 'grupos', 2, '2026-04-26T16:00:00Z', 3, 2],
  [1, 4, 'grupos', 3, '2026-05-03T13:00:00Z', 3, 0],
  [2, 3, 'grupos', 3, '2026-05-03T14:00:00Z', 2, 0],
  [5, 8, 'grupos', 3, '2026-05-03T15:00:00Z', 3, 0],
  [6, 7, 'grupos', 3, '2026-05-03T16:00:00Z', 2, 0],
  [1, 5, 'cuartos', null, '2026-05-10T13:00:00Z', 1, 0],
  [6, 2, 'cuartos', null, '2026-05-10T14:00:00Z', 2, 1],
  [7, 3, 'cuartos', null, '2026-05-17T13:00:00Z', 2, 0],
  [4, 8, 'cuartos', null, '2026-05-17T14:00:00Z', 1, 0],
  [1, 4, 'semifinal', null, '2026-05-24T13:00:00Z', 2, 0],
  [7, 6, 'semifinal', null, '2026-05-31T13:00:00Z', 3, 0],
  [1, 7, 'final', null, '2026-06-07T19:00:00Z', 3, 2],
];
export const matches = fixtures.map(
  ([local, visitor, fase, jornada, fechaHora, golesLocal, golesVisitante], i) => ({
    _id: matchId(i + 1),
    equipoLocalId: teamId(local),
    equipoVisitanteId: teamId(visitor),
    fase,
    ...(jornada && { jornada }),
    fechaHora,
    sede: 'Oratorio Don Bosco - Cancha principal',
    estado: 'finalizado',
    resultado: { golesLocal, golesVisitante, definidoPor: 'tiempo_reglamentario' },
    observaciones: 'Datos ficticios para la entrega académica.',
  }),
);
