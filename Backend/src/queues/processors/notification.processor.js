export const processNotificationJob = async (job) => {
    console.log(`Processing Notification job ${job.id}`);
    return { processed: true, jobId: job.id };
};
