import { Queue } from 'bullmq';
import dotenv from 'dotenv';
dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const isTLS = redisUrl.startsWith('rediss://');

const queueConnection = {
  url: redisUrl,
  maxRetriesPerRequest: null,
  keepAlive: 30000,
  connectTimeout: 10000,
  ...(isTLS && {
    tls: { rejectUnauthorized: false },
  }),
};

export const resumeQueue = new Queue('resume-parsing', {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export default resumeQueue;
