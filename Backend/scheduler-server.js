import { connectDatabase } from './src/config/database.js';
import { env } from './src/config/env.js';
import { connectRedis, getRedisStatus } from './src/infrastructure/redis/redisClient.js';
import { restoreScheduledDispatches, startDispatchRecoveryLoop } from './src/modules/taxi/services/dispatchService.js';
import { startSubscriptionRenewalWorker } from './src/modules/taxi/services/subscriptionRenewalWorker.js';

const bootstrap = async () => {
  await connectDatabase();
  
  if (!env.redis.enabled || !env.redis.url) {
    console.warn('[redis] disabled or not configured in scheduler server');
  } else {
    const redisClient = await connectRedis();
    if (!redisClient?.isReady) {
      console.warn('[redis] startup connect did not complete in scheduler server');
    }
  }

  console.log('Starting scheduler and workers...');
  
  await restoreScheduledDispatches();
  startDispatchRecoveryLoop();
  startSubscriptionRenewalWorker();

  console.log('Taxi scheduler and background workers started successfully');
};

bootstrap().catch((error) => {
  console.error('Failed to start taxi scheduler', error);
  process.exit(1);
});
