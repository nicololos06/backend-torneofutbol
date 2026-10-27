import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const schema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 120,
      unique: true,
    },
    passwordHash: { type: String, required: true, select: false },
    rol: { type: String, enum: ['admin', 'organizador', 'consulta'], default: 'consulta' },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false, collection: 'usuarios', strict: 'throw' },
);

// La contraseña llega por un virtual y se transforma antes de guardar.
schema.virtual('password').set(function (value) {
  this.$locals.password = value;
});
schema.pre('validate', function () {
  if (this.$locals.password !== undefined) this.passwordHash = 'pendiente-de-hash';
});
schema.pre('save', async function () {
  if (this.$locals.password === undefined) return;
  const password = this.$locals.password;
  if (
    typeof password !== 'string' ||
    password.length < 10 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    throw new Error('Contraseña fuera del dominio permitido');
  }
  this.passwordHash = await bcrypt.hash(password, 12);
  delete this.$locals.password;
});
schema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});
schema.index({ rol: 1, activo: 1 });

export default mongoose.model('Usuario', schema);
