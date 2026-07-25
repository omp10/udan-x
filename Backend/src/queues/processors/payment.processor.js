export const processPaymentJob = async (job) => {
    console.log(`Processing Payment job ${job.id}`);
    return { processed: true, jobId: job.id };
};
