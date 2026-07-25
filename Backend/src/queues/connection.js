import IORedis from 'ioredis';
import { env } from '../config/env.js';

const DEFAULT_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

const getRetryStrategy = () => (times) => {
    const delay = Math.min(DEFAULT_RETRY_DELAY_MS * Math.pow(2, times), MAX_RETRY_DELAY_MS);
    console.warn(`BullMQ Redis reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
};

let connection = null;

export const getBullMQConnection = () => {
    if (!env.redis.enabled) {
        console.warn('BullMQ: Redis is disabled in env, queue connection skipped.');
        return null;
    }

    if (!env.redis.url) {
        console.warn('BullMQ: REDIS_URL not set, queue connection skipped.');
        return null;
    }

    if (connection) {
        return connection;
    }

    connection = new IORedis(env.redis.url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        retryStrategy: getRetryStrategy()
    });

    connection.on('error', (err) => {
        console.error(`BullMQ Redis connection error: ${err.message}`);
    });

    connection.on('connect', () => {
        console.log('BullMQ Redis connection established');
    });

    connection.on('close', () => {
        console.warn('BullMQ Redis connection closed');
    });

    return connection;
};

export const closeBullMQConnection = async () => {
    if (connection) {
        await connection.quit();
        connection = null;
        console.log('BullMQ Redis connection closed');
    }
};
