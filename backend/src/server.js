import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { supabase } from './config/supabase.js';

import authRoutes from './routes/auth.js';
import jobRoutes from './routes/jobs.js';
import applicationRoutes from './routes/applications.js';
import profileRoutes from './routes/profiles.js';
import analyticsRoutes from './routes/analytics.js';
import notificationRoutes from './routes/notifications.js';
import matchingRoutes from './routes/matching.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      'http://localhost:5173',
      'http://talent-bridge-jobportal.vercel.app',
      process.env.FRONTEND_URL,        // your Vercel URL from .env
    ].filter(Boolean);

    // Allow requests with no origin (e.g. Postman, Railway health checks)
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
}));

const isDev = process.env.NODE_ENV !== 'production';

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,          // 15 minutes
  max: isDev ? 2000 : 500,            // 2000 in dev, 500 in production
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip: () => isDev && false,         // remove this line to enforce in dev
});


const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 20,              // 100 in dev, 20 in production
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again in 15 minutes' },
});

app.use(limiter);
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/matching', matchingRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Daily cron — runs every night at midnight
// 1. Auto-close jobs whose application_deadline has passed
// 2. Analytics aggregation placeholder
cron.schedule('0 0 * * *', async () => {
  console.log('⏰ Running daily maintenance...');

  try {
    const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

    const { data: expiredJobs, error } = await supabase
      .from('jobs')
      .update({ status: 'closed' })
      .eq('status', 'active')
      .not('application_deadline', 'is', null)
      .lt('application_deadline', today)
      .select('id, title');

    if (error) {
      console.error('❌ Auto-close cron error:', error.message);
    } else {
      console.log(`✅ Auto-closed ${expiredJobs?.length ?? 0} expired jobs`);
      if (expiredJobs?.length) {
        expiredJobs.forEach(j => console.log(`   — "${j.title}" (${j.id})`));
      }
    }
  } catch (err) {
    console.error('❌ Daily cron failed:', err.message);
  }

  // Analytics aggregation — add logic here if needed
  console.log('📊 Daily analytics aggregation complete.');
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;