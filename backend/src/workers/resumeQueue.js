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
    removeOnComplete: 100,  // keep last 100 completed jobs then auto-delete
    removeOnFail: 50,       // keep last 50 failed jobs then auto-delete
  },
});

// Graceful shutdown — close the queue connection when the process exits
// so it doesn't leave a dangling Redis connection open
process.on('SIGTERM', async () => { await resumeQueue.close(); });
process.on('SIGINT',  async () => { await resumeQueue.close(); });

export default resumeQueue;