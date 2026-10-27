import mongoose from 'mongoose';

const score = { type: Number, min: 0, max: 99, validate: Number.isInteger };
const resultSchema = new mongoose.Schema(
  {
    golesLocal: { ...score, required: true },
    golesVisitante: { ...score, required: true },
    penalesLocal: score,
    penalesVisitante: score,
    definidoPor: { type: String, enum: ['tiempo_reglamentario', 'penales'], required: true },
  },
  { _id: false, strict: 'throw' },
);

const schema = new mongoose.Schema(
  {
    equipoLocalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipo', required: true },
    equipoVisitanteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipo', required: true },
    creadoPorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
      immutable: true,
    },
    fase: { type: String, enum: ['grupos', 'cuartos', 'semifinal', 'final'], required: true },
    jornada: { type: Number, min: 1, max: 20, validate: Number.isInteger },
    fechaHora: { type: Date, required: true },
    sede: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    estado: {
      type: String,
      enum: ['programado', 'en_juego', 'finalizado', 'suspendido'],
      default: 'programado',
    },
    resultado: { type: resultSchema, default: undefined },
    observaciones: { type: String, maxlength: 250 },
  },
  { timestamps: true, versionKey: false, collection: 'partidos', strict: 'throw' },
);
schema.index({ fechaHora: 1 });
schema.index({ fase: 1, jornada: 1, fechaHora: 1 });
schema.index({ equipoLocalId: 1, fechaHora: -1 });
schema.index({ equipoVisitanteId: 1, fechaHora: -1 });
schema.index({ equipoLocalId: 1, equipoVisitanteId: 1, fechaHora: 1 }, { unique: true });

export default mongoose.model('Partido', schema);
