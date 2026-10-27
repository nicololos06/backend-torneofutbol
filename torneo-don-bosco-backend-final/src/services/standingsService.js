import { z } from 'zod';
import Equipo from '../models/teamModel.js';
import Partido from '../models/matchModel.js';
import { parse } from './validation.js';

export async function getStandings(query) {
  const { categoria } = parse(
    z.object({ categoria: z.enum(['Infantil', 'Juvenil', 'Senior']).default('Juvenil') }).strict(),
    query,
  );
  const teams = await Equipo.find({ categoria }).sort({ nombre: 1 });
  const rows = new Map(
    teams.map((t) => [
      String(t._id),
      { equipo: t.toJSON(), PJ: 0, PG: 0, PE: 0, PP: 0, GF: 0, GC: 0, DG: 0, PTS: 0 },
    ]),
  );
  const matches = await Partido.find({
    fase: 'grupos',
    estado: 'finalizado',
    equipoLocalId: { $in: teams.map((t) => t._id) },
  });
  for (const match of matches) {
    const local = rows.get(String(match.equipoLocalId));
    const visitor = rows.get(String(match.equipoVisitanteId));
    if (!local || !visitor || !match.resultado) continue;
    const { golesLocal: a, golesVisitante: b } = match.resultado;
    local.PJ++;
    visitor.PJ++;
    local.GF += a;
    local.GC += b;
    visitor.GF += b;
    visitor.GC += a;
    if (a === b) {
      local.PE++;
      visitor.PE++;
      local.PTS++;
      visitor.PTS++;
    } else {
      const winner = a > b ? local : visitor;
      const loser = a > b ? visitor : local;
      winner.PG++;
      winner.PTS += 3;
      loser.PP++;
    }
  }
  const groups = { A: [], B: [] };
  for (const row of rows.values()) {
    row.DG = row.GF - row.GC;
    groups[row.equipo.grupo].push(row);
  }
  for (const group of Object.values(groups))
    group.sort(
      (a, b) =>
        b.PTS - a.PTS ||
        b.DG - a.DG ||
        b.GF - a.GF ||
        a.equipo.nombre.localeCompare(b.equipo.nombre, 'es'),
    );
  return { categoria, grupos: groups, desempate: ['PTS', 'DG', 'GF', 'nombre'] };
}
