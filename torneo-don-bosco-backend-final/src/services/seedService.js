import Usuario from '../models/userModel.js';
import Equipo from '../models/teamModel.js';
import Partido from '../models/matchModel.js';
import { config } from '../config/env.js';
import { createAccount } from './userService.js';
import { parse, teamInput, matchInput, validateMatchRules } from './validation.js';
import { teams, matches } from '../data/demoData.js';

// Idempotente: solo inserta lo que falta, no borra ni sobrescribe documentos.
export async function seedDatabase() {
  if (config.env === 'production')
    throw new Error('El seed de demostración está deshabilitado en producción');
  let admin = await Usuario.findOne({ email: config.adminEmail.toLowerCase() });
  if (!admin)
    admin = await createAccount(
      {
        nombre: 'Administrador Don Bosco',
        email: config.adminEmail,
        password: config.adminPassword,
      },
      'admin',
    );
  if (admin.rol !== 'admin' || !admin.activo)
    throw new Error('La cuenta de seed existente no es un administrador activo');
  let teamsCreated = 0;
  let matchesCreated = 0;
  for (const { _id, ...values } of teams) {
    if (await Equipo.exists({ _id })) continue;
    await Equipo.create({ _id, ...parse(teamInput, values) });
    teamsCreated++;
  }
  for (const { _id, ...values } of matches) {
    if (await Partido.exists({ _id })) continue;
    const input = parse(matchInput, values);
    validateMatchRules(input);
    const referencedTeams = await Equipo.find({
      _id: { $in: [input.equipoLocalId, input.equipoVisitanteId] },
    });
    if (
      referencedTeams.length !== 2 ||
      referencedTeams[0].categoria !== referencedTeams[1].categoria ||
      (input.fase === 'grupos' && referencedTeams[0].grupo !== referencedTeams[1].grupo)
    ) {
      throw new Error('Los equipos existentes no coinciden con los requisitos del seed');
    }
    await Partido.create({ _id, ...input, creadoPorId: admin._id });
    matchesCreated++;
  }
  return { equiposCreados: teamsCreated, partidosCreados: matchesCreated, adminEmail: admin.email };
}
