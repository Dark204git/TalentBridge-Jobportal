import { Queue } from 'bullmq';
import { redis } from '../config/redis.js';

export const resumeQueue = new Queue('resume-parsing', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export default resumeQueue;
