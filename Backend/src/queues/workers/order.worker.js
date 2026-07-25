import 'dotenv/config';
import { Worker } from 'bullmq';
import { env } from '../../../config/env.js';
import { getBullMQConnection } from '../connection.js';
import { ORDER_QUEUE } from '../queue.constants.js';
import { processOrderJob } from '../processors/order.processor.js';

const defaultJobOptions = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
};

const startOrderWorker = () => {
    if (!env.redis.enabled) {
        console.log('Redis is disabled. Order worker not started.');
        return null;
    }
    const connection = getBullMQConnection();
    if (!connection) {
        console.error('Order worker: Redis connection unavailable. Exiting.');
        process.exit(1);
    }
    const worker = new Worker(ORDER_QUEUE, processOrderJob, {
        connection,
        concurrency: 5,
        defaultJobOptions
    });
    worker.on('completed', (job) => console.log(`Order job ${job.id} completed`));
    worker.on('failed', (job, err) => console.error(`Order job ${job?.id} failed: ${err.message}`));
    worker.on('error', (err) => console.error(`Order worker error: ${err.message}`));
    console.log('Order worker started');
    return worker;
};

const worker = startOrderWorker();
if (worker) {
    const shutdown = async () => {
        await worker.close();
        process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}
