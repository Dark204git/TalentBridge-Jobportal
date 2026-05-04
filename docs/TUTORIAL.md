# TalentBridge Job Portal — Complete Setup Tutorial

This guide walks you through connecting every piece of the application from scratch.

---

## Prerequisites

Install these on your machine before starting:

- **Node.js** v18+ → https://nodejs.org
- **Git** → https://git-scm.com
- **Redis** → https://redis.io/docs/install (or use Docker: `docker run -p 6379:6379 redis`)
- A code editor (VS Code recommended)

---

## Step 1 — Create a Supabase Project (Free Database)

1. Go to **https://supabase.com** and click **Start your project**
2. Sign in with GitHub and click **New Project**
3. Fill in:
   - **Project name**: `talentbridge`
   - **Database password**: Create a strong password (save it!)
   - **Region**: Choose the closest to your users
4. Wait ~2 minutes for the project to provision
5. In your project dashboard, go to **Settings → API**
6. Copy and save these three values:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)
   - **service_role key** (starts with `eyJ...`) ← Keep this secret!

### Run the Database Schema

1. In Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New Query**
3. Open the file `docs/schema.sql` from this project
4. Copy all the SQL content and paste it into the editor
5. Click **Run** (green button)
6. You should see "Success. No rows returned" — your tables are created!

---

## Step 2 — Set Up Resend for Emails (Free 3,000/month)

1. Go to **https://resend.com** and sign up (free)
2. Click **API Keys** → **Create API Key**
3. Name it `talentbridge` and click **Create**
4. Copy the key that starts with `re_...` (you only see it once!)
5. Go to **Domains** and add your domain (or use `onboarding@resend.dev` for testing)

---

## Step 3 — Set Up Cloudflare R2 for File Storage (Free 10GB)

1. Go to **https://dash.cloudflare.com** and sign up
2. In the left sidebar, click **R2 Object Storage**
3. Click **Create bucket**
   - Bucket name: `jobportal-resumes`
   - Click **Create bucket**
4. G
5. Click **o to **R2 → Manage R2 API tokens**Create API token** with **Edit** permissions
6. Copy: **Access Key ID** and **Secret Access Key**
7. Your Account ID is in the URL: `dash.cloudflare.com/YOUR_ACCOUNT_ID/r2`
8. To make files public: Go to your bucket → **Settings** → **Public access** → Enable

---

## Step 4 — Configure the Backend

```bash
# Navigate to backend folder
cd jobportal/backend

# Install dependencies
npm install

# Also install AWS SDK for R2 access
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# Create your environment file
cp .env.example .env
```

Now open `backend/.env` in your editor and fill in every value:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# From Step 1 — Supabase
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...your_anon_key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your_service_role_key

# Generate a random 32+ character string
JWT_SECRET=mysuper_secret_key_change_this_in_production_32chars
JWT_EXPIRES_IN=7d

# Redis (default local)
REDIS_URL=redis://localhost:6379

# From Step 3 — Cloudflare R2
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=jobportal-resumes
R2_PUBLIC_URL=https://pub-xxxx.r2.dev  # Your R2 public URL

# From Step 2 — Resend
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=noreply@yourdomain.com

APP_NAME=TalentBridge
```

---

## Step 5 — Start Redis

### Option A: If Redis is installed locally
```bash
redis-server
```

### Option B: Using Docker
```bash
docker run -d -p 6379:6379 --name redis redis:latest
```

### Option C: Use a free cloud Redis (Upstash)
1. Go to https://upstash.com → Create a free Redis database
2. Copy the **Redis URL** (starts with `rediss://`)
3. Set `REDIS_URL=rediss://your-upstash-url` in your `.env`

---

## Step 6 — Start the Backend

Open **two terminal windows** in the `backend/` folder:

### Terminal 1 — API Server
```bash
cd jobportal/backend
npm run dev
```

You should see:
```
🚀 Server running on http://localhost:5000
✅ Redis connected
```

### Terminal 2 — Resume Parser Worker
```bash
cd jobportal/backend
node src/workers/resumeWorker.js
```

You should see:
```
🚀 Resume parsing worker started
✅ Redis connected
```

### Test the API
```bash
curl http://localhost:5000/health
# Should return: {"status":"ok","timestamp":"..."}
```

---

## Step 7 — Configure the Frontend

```bash
# Navigate to frontend folder
cd jobportal/frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Open `frontend/.env` and set:
```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=TalentBridge
```

---

## Step 8 — Start the Frontend

```bash
cd jobportal/frontend
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:3000/
```

Open **http://localhost:3000** in your browser — TalentBridge is running!

---

## Step 9 — Test the Full Flow

### Test as a Candidate
1. Go to http://localhost:3000/register
2. Select **Job Seeker** and create an account
3. You'll be redirected to your dashboard
4. Go to **My Profile** and fill in your info
5. Upload a PDF resume — it will be sent to the parsing worker
6. Go to **Find Jobs** and search for positions
7. Click a job and apply!

### Test as an Employer
1. Open an incognito window → http://localhost:3000/register
2. Select **Employer** and create an account
3. Go to **Company Profile** and fill in company details
4. Go to **My Jobs** → **Post New Job**
5. Fill in the job details and submit
6. The system will auto-match candidates and send email alerts
7. View **Applications** to see the ATS interface

---

## Step 10 — Deployment

### Deploy Frontend to Vercel (Free)

1. Push your code to GitHub
2. Go to https://vercel.com → **New Project**
3. Import your GitHub repo
4. Set **Root Directory** to `frontend`
5. Add environment variables:
   - `VITE_API_URL` = `https://your-backend.railway.app/api`
6. Click **Deploy**

### Deploy Backend to Railway (Free tier)

1. Go to https://railway.app → **New Project**
2. Click **Deploy from GitHub repo** → select your repo
3. Set **Root Directory** to `backend`
4. Add all your `.env` variables in the Railway dashboard
5. Railway will auto-detect Node.js and deploy
6. Copy your Railway URL (e.g., `https://xxx.railway.app`)

### Update CORS after deployment
In your backend `.env` on Railway:
```env
FRONTEND_URL=https://your-app.vercel.app
```

---

## Common Issues & Fixes

### ❌ "Cannot connect to Redis"
- Make sure Redis is running: `redis-cli ping` → should return `PONG`
- Check your `REDIS_URL` in `.env`

### ❌ "Invalid token" on API calls
- Check your `JWT_SECRET` is the same in backend `.env`
- Clear localStorage in browser: DevTools → Application → Local Storage → Clear

### ❌ Resume upload fails
- Verify your R2 credentials are correct
- Check bucket CORS settings in Cloudflare R2 dashboard:
  ```json
  [{"AllowedOrigins": ["*"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["*"]}]
  ```

### ❌ Emails not sending
- Verify your Resend API key is correct
- Check that your domain is verified in Resend dashboard
- For testing, use the default `onboarding@resend.dev` sender

### ❌ Supabase connection errors
- Double-check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Make sure the schema was applied (check tables in Supabase → Table Editor)

---

## Project Structure Overview

```
jobportal/
├── backend/
│   ├── src/
│   │   ├── config/          # Supabase + Redis connections
│   │   ├── controllers/     # Business logic per feature
│   │   ├── middleware/      # JWT auth + role guards
│   │   ├── routes/          # Express route definitions
│   │   ├── services/        # Email + Storage services
│   │   ├── workers/         # BullMQ resume parser
│   │   └── server.js        # Express app entry point
│   ├── .env                 # Your secret config (never commit!)
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── context/         # Auth state (React Context)
│   │   ├── pages/           # All page components
│   │   │   ├── auth/        # Login + Register
│   │   │   ├── employer/    # Employer dashboard pages
│   │   │   └── candidate/   # Candidate dashboard pages
│   │   ├── services/        # API call functions
│   │   └── App.jsx          # Routes + providers
│   ├── .env                 # Frontend config
│   └── package.json
│
└── docs/
    ├── schema.sql           # Database tables (run in Supabase)
    └── TUTORIAL.md          # This file
```

---

## Quick Start Summary

```bash
# 1. Start Redis
redis-server

# 2. Backend
cd backend && npm install && npm run dev

# 3. Worker (new terminal)
cd backend && node src/workers/resumeWorker.js

# 4. Frontend (new terminal)
cd frontend && npm install && npm run dev

# 5. Open browser
open http://localhost:3000
```

---

## Need Help?

- Supabase docs: https://supabase.com/docs
- Railway docs: https://docs.railway.app
- Vercel docs: https://vercel.com/docs
- Resend docs: https://resend.com/docs
- Cloudflare R2 docs: https://developers.cloudflare.com/r2
