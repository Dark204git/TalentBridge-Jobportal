-- ============================================================
-- TalentBridge Job Portal - Complete Supabase SQL Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('candidate', 'employer', 'admin')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- EMPLOYER PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS employer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255),
  company_description TEXT,
  industry VARCHAR(100),
  company_size VARCHAR(50),
  company_website VARCHAR(255),
  company_logo VARCHAR(500),
  headquarters VARCHAR(255),
  founded_year INTEGER,
  linkedin_url VARCHAR(255),
  twitter_url VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================
-- CANDIDATE PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS candidate_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  headline VARCHAR(255),
  bio TEXT,
  profile_picture VARCHAR(500),
  skills TEXT[] DEFAULT '{}',
  experience_years INTEGER,
  education TEXT,
  experience TEXT,
  desired_job_title VARCHAR(255),
  preferred_location VARCHAR(255),
  desired_salary INTEGER,
  is_open_to_work BOOLEAN DEFAULT TRUE,
  resume_url VARCHAR(500),
  resume_filename VARCHAR(255),
  resume_uploaded_at TIMESTAMP WITH TIME ZONE,
  resume_parsed BOOLEAN DEFAULT FALSE,
  resume_parsed_at TIMESTAMP WITH TIME ZONE,
  linkedin_url VARCHAR(255),
  github_url VARCHAR(255),
  portfolio_url VARCHAR(255),
  embedding VECTOR(384),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================
-- JOBS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employer_profile_id UUID REFERENCES employer_profiles(id),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT,
  skills TEXT[] DEFAULT '{}',
  location VARCHAR(255),
  job_type VARCHAR(50) CHECK (job_type IN ('full-time', 'part-time', 'contract', 'freelance', 'internship')),
  experience_level VARCHAR(50) CHECK (experience_level IN ('entry', 'mid', 'senior', 'lead', 'executive')),
  category VARCHAR(100),
  salary_min INTEGER,
  salary_max INTEGER,
  is_remote BOOLEAN DEFAULT FALSE,
  application_deadline TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'draft')),
  views INTEGER DEFAULT 0,
  embedding VECTOR(384),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- APPLICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cover_letter TEXT,
  resume_url VARCHAR(500),
  status VARCHAR(30) DEFAULT 'pending' CHECK (
    status IN ('pending', 'reviewing', 'shortlisted', 'interviewed', 'offered', 'rejected', 'withdrawn')
  ),
  employer_notes TEXT,
  match_score INTEGER,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(job_id, candidate_id)
);

-- ============================================================
-- SAVED JOBS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- ============================================================
-- JOB VIEWS TABLE (for analytics)
-- ============================================================
CREATE TABLE IF NOT EXISTS job_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_jobs_employer_id ON jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_candidate_id ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_employer_id ON applications(employer_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_id ON saved_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_job_views_job_id ON job_views(job_id);
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_user_id ON candidate_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_employer_profiles_user_id ON employer_profiles(user_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
-- Note: Since we use service role key in backend, RLS is optional
-- but recommended for extra security. Enable if you want direct 
-- Supabase client calls from frontend.

-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPFUL VIEWS
-- ============================================================

-- Jobs with employer info
CREATE OR REPLACE VIEW jobs_with_company AS
SELECT 
  j.*,
  ep.company_name,
  ep.company_logo,
  ep.company_website,
  ep.industry
FROM jobs j
LEFT JOIN employer_profiles ep ON j.employer_profile_id = ep.id
WHERE j.status = 'active';

-- Application stats per job
CREATE OR REPLACE VIEW job_application_stats AS
SELECT 
  j.id as job_id,
  j.title,
  j.employer_id,
  j.views,
  COUNT(a.id) as total_applications,
  COUNT(CASE WHEN a.status = 'shortlisted' THEN 1 END) as shortlisted_count,
  COUNT(CASE WHEN a.status = 'offered' THEN 1 END) as offered_count
FROM jobs j
LEFT JOIN applications a ON j.id = a.job_id
GROUP BY j.id, j.title, j.employer_id, j.views;
