import mongoose from 'mongoose';
import { config } from './env.js';

export async function connectDB(uri = config.mongoUri) {
  mongoose.set('bufferCommands', false);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
