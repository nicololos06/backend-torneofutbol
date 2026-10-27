import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, minlength: 2, maxlength: 80, unique: true },
    nombreCorto: { type: String, required: true, trim: true, minlength: 2, maxlength: 30 },
    grupo: { type: String, enum: ['A', 'B'], required: true },
    categoria: { type: String, enum: ['Infantil', 'Juvenil', 'Senior'], required: true },
    escudoUrl: { type: String, maxlength: 300 },
    colores: { type: [String], required: true },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false, collection: 'equipos', strict: 'throw' },
);
schema.index({ grupo: 1, activo: 1 });

export default mongoose.model('Equipo', schema);
