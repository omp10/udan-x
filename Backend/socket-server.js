import { createServer } from 'node:http';
import { connectDatabase } from './src/config/database.js';
import { env } from './src/config/env.js';
import { connectRedis, getRedisStatus } from './src/infrastructure/redis/redisClient.js';
import { configureTaxiSocketServer } from './src/modules/taxi/socket/index.js';

const bootstrap = async () => {
  await connectDatabase();
  
  if (!env.redis.enabled || !env.redis.url) {
    console.warn('[redis] disabled or not configured in socket server');
  } else {
    const redisClient = await connectRedis();
    if (!redisClient?.isReady) {
      console.warn('[redis] startup connect did not complete in socket server');
    }
  }

  // Create a simple HTTP server to attach Socket.io
  const httpServer = createServer((req, res) => {
    res.writeHead(200);
    res.end('Socket Server is running');
  });

  configureTaxiSocketServer(httpServer);

  // Use the port defined in env config
  const socketPort = env.socketPort;
  
  httpServer.listen(socketPort, () => {
    const redisStatus = getRedisStatus();
    console.log(`Taxi socket server listening on port ${socketPort}`);
    console.log('[redis] status', redisStatus);
  });
};

bootstrap().catch((error) => {
  console.error('Failed to start taxi socket server', error);
  process.exit(1);
});
