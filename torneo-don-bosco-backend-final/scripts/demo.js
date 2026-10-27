import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import { config, validateConfig } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { initializeModels } from '../src/services/systemService.js';
import { seedDatabase } from '../src/services/seedService.js';

let mongo;
let server;
async function close() {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  await disconnectDB();
  if (mongo) await mongo.stop();
}
try {
  validateConfig();
  if (config.env === 'production') throw new Error('El modo demo no se utiliza en producción');
  mongo = await MongoMemoryServer.create({ instance: { dbName: 'torneo_don_bosco_demo' } });
  await connectDB(mongo.getUri());
  await initializeModels();
  console.log(await seedDatabase());
  server = app.listen(config.port, '127.0.0.1', () => {
    console.log(`API demo: http://localhost:${config.port}/api/health`);
    console.log(
      'MongoDB temporal: los cambios se pierden al cerrar. Para persistir datos usá npm start con MongoDB local o Atlas.',
    );
  });
  server.on('error', async (error) => {
    console.error(`Error HTTP: ${error.code}`);
    await close();
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, async () => {
      await close();
      process.exit(0);
    });
} catch (error) {
  console.error(`No se pudo iniciar la demo: ${error.message}`);
  await close();
  process.exitCode = 1;
}
