import 'dotenv/config';
import { Worker } from 'bullmq';
import { env } from '../../../config/env.js';
import { getBullMQConnection } from '../connection.js';
import { OTP_QUEUE } from '../queue.constants.js';
import { processOtpJob } from '../processors/otp.processor.js';

const defaultJobOptions = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
};

const startOtpWorker = () => {
    if (!env.redis.enabled) {
        console.log('Redis is disabled. OTP worker not started.');
        return null;
    }
    const connection = getBullMQConnection();
    if (!connection) {
        console.error('OTP worker: Redis connection unavailable. Exiting.');
        process.exit(1);
    }
    const worker = new Worker(OTP_QUEUE, processOtpJob, {
        connection,
        concurrency: 5,
        defaultJobOptions
    });
    worker.on('completed', (job) => console.log(`OTP job ${job.id} completed`));
    worker.on('failed', (job, err) => console.error(`OTP job ${job?.id} failed: ${err.message}`));
    worker.on('error', (err) => console.error(`OTP worker error: ${err.message}`));
    console.log('OTP worker started');
    return worker;
};

const worker = startOtpWorker();
if (worker) {
    const shutdown = async () => {
        await worker.close();
        process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}
