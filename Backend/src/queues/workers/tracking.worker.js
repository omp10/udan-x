import 'dotenv/config';
import { Worker } from 'bullmq';
import { env } from '../../../config/env.js';
import { getBullMQConnection } from '../connection.js';
import { TRACKING_QUEUE } from '../queue.constants.js';
import { processTrackingJob } from '../processors/tracking.processor.js';

const defaultJobOptions = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
};

const startTrackingWorker = () => {
    if (!env.redis.enabled) {
        console.log('Redis is disabled. Tracking worker not started.');
        return null;
    }
    const connection = getBullMQConnection();
    if (!connection) {
        console.error('Tracking worker: Redis connection unavailable. Exiting.');
        process.exit(1);
    }
    const worker = new Worker(TRACKING_QUEUE, processTrackingJob, {
        connection,
        concurrency: 5,
        defaultJobOptions
    });
    worker.on('completed', (job) => console.log(`Tracking job ${job.id} completed`));
    worker.on('failed', (job, err) => console.error(`Tracking job ${job?.id} failed: ${err.message}`));
    worker.on('error', (err) => console.error(`Tracking worker error: ${err.message}`));
    console.log('Tracking worker started');
    return worker;
};

const worker = startTrackingWorker();
if (worker) {
    const shutdown = async () => {
        await worker.close();
        process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}
