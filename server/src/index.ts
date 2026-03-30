import { server } from './server.js';
import { config } from './config.js';
import { closeAllDatabases } from './metadata.js';

// Start server
const start = async () => {
  try {
    // Brief delay on startup to let filesystem settle after potential crash
    await new Promise(resolve => setTimeout(resolve, 2000));

    await server.listen({ port: config.port, host: config.host });
    console.log(`Server listening on http://${config.host}:${config.port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await server.close();
  closeAllDatabases();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await server.close();
  closeAllDatabases();
  process.exit(0);
});

start();
