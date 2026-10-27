import app from './app.js';
import { config, validateConfig } from './src/config/env.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { initializeModels } from './src/services/systemService.js';

try {
  validateConfig();
  await connectDB();
  await initializeModels();
  const server = app.listen(config.port, '127.0.0.1', () =>
    console.log(`API: http://localhost:${config.port}/api/health`),
  );
  server.on('error', async (error) => {
    console.error(`No se pudo iniciar HTTP: ${error.code}`);
    await disconnectDB();
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () =>
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      }),
    );
} catch (error) {
  console.error(`No se pudo iniciar la API: ${error.message}`);
  await disconnectDB();
  process.exitCode = 1;
}
