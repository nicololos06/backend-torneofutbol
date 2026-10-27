import mongoose from 'mongoose';
import Equipo from '../models/teamModel.js';
import Partido from '../models/matchModel.js';
import Usuario from '../models/userModel.js';

export async function initializeModels() {
  await Promise.all([Equipo.init(), Partido.init(), Usuario.init()]);
}
export async function health() {
  if (mongoose.connection.readyState !== 1) return { ok: false, database: 'disconnected' };
  try {
    await mongoose.connection.db.admin().ping();
    return { ok: true, database: 'connected' };
  } catch {
    return { ok: false, database: 'unavailable' };
  }
}
