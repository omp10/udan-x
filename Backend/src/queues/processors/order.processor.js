export const processOrderJob = async (job) => {
    console.log(`Processing Order job ${job.id}`);
    return { processed: true, jobId: job.id };
};
