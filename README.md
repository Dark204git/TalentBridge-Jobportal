# TalentBridge — AI-Powered Job Portal

A full-stack job portal with AI-powered resume parsing, smart job matching, applicant tracking, email notifications, and real-time analytics.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| Auth | JWT + bcrypt |
| File Storage | Cloudflare R2 |
| Email | Resend |
| Queue | BullMQ + Redis |
| Deployment | Vercel (FE) + Railway (BE) |

## Features

- **Dual Role System** — Separate employer and candidate experiences
- **Secure JWT Auth** — Registration, login, role-based access control
- **Resume Upload & Parsing** — Background worker extracts skills automatically
- **Smart Job Matching** — Skill-based matching with email notifications
- **ATS Dashboard** — Employers manage applications with status tracking
- **Analytics** — Charts for views, applications, and hiring trends
- **Saved Jobs** — Candidates bookmark interesting opportunities
- **Responsive** — Mobile, tablet, and desktop ready

## Quick Start

```bash
# 1. Set up Supabase, run docs/schema.sql in SQL Editor
# 2. Configure backend/.env (copy from .env.example)
# 3. Configure frontend/.env (copy from .env.example)

# Start Redis
redis-server

# Backend
cd backend && npm install && npm run dev

# Worker (new terminal)
cd backend && node src/workers/resumeWorker.js

# Frontend (new terminal)  
cd frontend && npm install && npm run dev
```

See **docs/TUTORIAL.md** for the complete step-by-step setup guide.

## Project Structure

```
jobportal/
├── backend/          # Express API + workers
├── frontend/         # React SPA
└── docs/
    └──  schema.sql    # Database schema (run in Supabase)
```
