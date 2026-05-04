import { Redis } from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const isTLS = redisUrl.startsWith('rediss://');

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  connectTimeout: 10000,
  commandTimeout: 5000,
  keepAlive: 30000,        // send TCP keepalive every 30s to prevent idle timeout
  enableOfflineQueue: true,
  lazyConnect: false,
  ...(isTLS && {
    tls: {
      rejectUnauthorized: false,
    },
  }),
});

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('ready', () => console.log('✅ Redis ready'));
redis.on('error', (err) => console.error('❌ Redis error:', err.message));
redis.on('close', () => console.warn('⚠️ Redis connection closed'));
redis.on('reconnecting', () => console.log('🔄 Redis reconnecting...'));

export default redis;