export const processTrackingJob = async (job) => {
    console.log(`Processing Tracking job ${job.id}`);
    return { processed: true, jobId: job.id };
};
