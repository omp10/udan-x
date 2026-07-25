export const processOtpJob = async (job) => {
    console.log(`Processing OTP job ${job.id}`);
    return { processed: true, jobId: job.id };
};
