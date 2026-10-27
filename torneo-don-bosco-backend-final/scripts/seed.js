import { validateConfig } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { initializeModels } from '../src/services/systemService.js';
import { seedDatabase } from '../src/services/seedService.js';

try {
  validateConfig();
  await connectDB();
  await initializeModels();
  console.log(await seedDatabase());
} catch (error) {
  console.error(`No se pudo cargar la demostración: ${error.message}`);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
