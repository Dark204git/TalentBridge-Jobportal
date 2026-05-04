import { Redis } from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const isTLS = redisUrl.startsWith('rediss://');

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  ...(isTLS && {
    tls: {
      rejectUnauthorized: false, // required for Upstash on Railway
    },
  }),
});

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err) => console.error('❌ Redis error:', err.message));

export default redis;