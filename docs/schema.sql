-- ============================================================
-- TalentBridge Job Portal — Supabase SQL Schema
-- Paste this into Supabase → SQL Editor → New Query → Run
-- ============================================================


-- ============================================================
-- EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;


-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL CHECK (role IN ('candidate', 'employer', 'admin')),
  is_active     BOOLEAN      DEFAULT TRUE,
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);


-- ============================================================
-- EMPLOYER PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS employer_profiles (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name        VARCHAR(255),
  company_description TEXT,
  industry            VARCHAR(100),
  company_size        VARCHAR(50),
  company_website     VARCHAR(255),
  company_logo        TEXT,
  headquarters        VARCHAR(255),
  founded_year        INTEGER,
  linkedin_url        VARCHAR(255),
  twitter_url         VARCHAR(255),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);


-- ============================================================
-- CANDIDATE PROFILES
-- All columns consolidated here — no ALTER TABLE needed.
-- ============================================================

CREATE TABLE IF NOT EXISTS candidate_profiles (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Basic info
  headline             VARCHAR(255),
  bio                  TEXT,
  profile_picture      TEXT,
  phone_number         TEXT,
  country_code         TEXT        DEFAULT '+91',
  date_of_birth        TEXT,
  gender               TEXT,
  lives_in             TEXT,

  -- Skills & experience
  skills               TEXT[]      DEFAULT '{}',
  experience_years     INTEGER,
  education            TEXT,
  experience           TEXT,

  -- Job preferences
  desired_job_title    VARCHAR(255),
  preferred_location   VARCHAR(255),
  preferred_category   VARCHAR(100),
  preferred_job_type   VARCHAR(50),
  desired_salary       TEXT,
  is_open_to_work      BOOLEAN     DEFAULT TRUE,

  -- Resume
  resume_url           TEXT,
  resume_key           TEXT,
  resume_filename      VARCHAR(255),
  resume_uploaded_at   TIMESTAMPTZ,
  resume_parsed        BOOLEAN     DEFAULT FALSE,
  resume_parsed_at     TIMESTAMPTZ,
  resume_parse_failed  BOOLEAN     DEFAULT FALSE,

  -- Social links
  linkedin_url         VARCHAR(255),
  github_url           VARCHAR(255),
  portfolio_url        VARCHAR(255),

  -- Matching vector
  embedding            VECTOR(384),

  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);


-- ============================================================
-- JOBS
-- ============================================================

CREATE TABLE IF NOT EXISTS jobs (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employer_profile_id  UUID        REFERENCES employer_profiles(id),
  title                VARCHAR(255) NOT NULL,
  description          TEXT        NOT NULL,
  requirements         TEXT,
  skills               TEXT[]      DEFAULT '{}',
  location             VARCHAR(255),
  job_type             VARCHAR(50)  CHECK (job_type IN ('full-time', 'part-time', 'contract', 'freelance', 'internship')),
  experience_level     VARCHAR(50)  CHECK (experience_level IN ('entry', 'mid', 'senior', 'lead', 'executive')),
  category             VARCHAR(100),
  salary_min           INTEGER,
  salary_max           INTEGER,
  is_remote            BOOLEAN     DEFAULT FALSE,
  application_deadline DATE,
  status               VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'draft')),
  views                INTEGER     DEFAULT 0,

  -- Matching vector
  embedding            VECTOR(384),

  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- APPLICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS applications (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id         UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employer_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cover_letter   TEXT,
  resume_url     TEXT,
  status         VARCHAR(30) DEFAULT 'pending' CHECK (
    status IN ('pending', 'reviewing', 'shortlisted', 'interviewed', 'offered', 'rejected', 'withdrawn')
  ),
  employer_notes TEXT,
  match_score    INTEGER,
  applied_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, candidate_id)
);


-- ============================================================
-- SAVED JOBS
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_jobs (
  id       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id   UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);


-- ============================================================
-- JOB VIEWS  (analytics)
-- ============================================================

CREATE TABLE IF NOT EXISTS job_views (
  id        UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id    UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  viewer_id UUID        REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- PASSWORD RESET TOKENS
-- ============================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50)  NOT NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT        NOT NULL,
  link       VARCHAR(500),
  is_read    BOOLEAN     DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- INDEXES
-- ============================================================

-- Jobs
CREATE INDEX IF NOT EXISTS idx_jobs_employer_id  ON jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status        ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_category      ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_jobs_deadline      ON jobs(application_deadline);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at    ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_is_remote     ON jobs(is_remote);

-- Applications
CREATE INDEX IF NOT EXISTS idx_applications_job_id       ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_candidate_id ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_employer_id  ON applications(employer_id);
CREATE INDEX IF NOT EXISTS idx_applications_status       ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_applied_at   ON applications(applied_at DESC);

-- Profiles
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_user_id ON candidate_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_employer_profiles_user_id  ON employer_profiles(user_id);

-- Saved jobs
CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_id ON saved_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_job_id  ON saved_jobs(job_id);

-- Job views
CREATE INDEX IF NOT EXISTS idx_job_views_job_id   ON job_views(job_id);
CREATE INDEX IF NOT EXISTS idx_job_views_viewed_at ON job_views(viewed_at DESC);

-- Password reset
CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_user_id    ON password_reset_tokens(user_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread    ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created   ON notifications(created_at DESC);

-- HNSW vector indexes for fast similarity search
-- Comment these out if you are on the Supabase free plan and they time out.
CREATE INDEX IF NOT EXISTS idx_jobs_embedding_hnsw
  ON jobs USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_candidates_embedding_hnsw
  ON candidate_profiles USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);


-- ============================================================
-- VIEWS
-- ============================================================

-- Active jobs with company details (used by job listing pages)
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

-- Per-job application stats (used by employer analytics)
CREATE OR REPLACE VIEW job_application_stats AS
SELECT
  j.id            AS job_id,
  j.title,
  j.employer_id,
  j.status        AS job_status,
  j.views,
  COUNT(a.id)                                              AS total_applications,
  COUNT(CASE WHEN a.status = 'reviewing'   THEN 1 END)    AS reviewing_count,
  COUNT(CASE WHEN a.status = 'shortlisted' THEN 1 END)    AS shortlisted_count,
  COUNT(CASE WHEN a.status = 'interviewed' THEN 1 END)    AS interviewed_count,
  COUNT(CASE WHEN a.status = 'offered'     THEN 1 END)    AS offered_count,
  COUNT(CASE WHEN a.status = 'rejected'    THEN 1 END)    AS rejected_count
FROM jobs j
LEFT JOIN applications a ON j.id = a.job_id
GROUP BY j.id, j.title, j.employer_id, j.status, j.views;


-- ============================================================
-- RPC FUNCTIONS  (called by matchingService.js via supabase.rpc())
--
-- pgvector: <=> is cosine DISTANCE  (lower = more similar)
--           similarity = 1 - distance
--
-- Both functions are dropped first so they can be re-run safely
-- without "cannot change return type" errors.
-- ============================================================

DROP FUNCTION IF EXISTS match_jobs_for_candidate(vector, float, int);
DROP FUNCTION IF EXISTS match_candidates_for_job(vector, float, int);

-- ------------------------------------------------------------------
-- match_jobs_for_candidate
-- Given a candidate's resume embedding, returns active jobs
-- ranked by cosine similarity (highest first).
-- Called by: findMatchingJobsForCandidate() in matchingService.js
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_jobs_for_candidate(
  query_embedding  vector(384),
  match_threshold  float   DEFAULT 0.20,
  match_count      integer DEFAULT 20
)
RETURNS TABLE (
  id                  uuid,
  title               text,
  description         text,
  requirements        text,
  skills              text[],
  location            text,
  job_type            text,
  experience_level    text,
  category            text,
  salary_min          integer,
  salary_max          integer,
  is_remote           boolean,
  status              text,
  employer_id         uuid,
  employer_profile_id uuid,
  views               integer,
  created_at          timestamptz,
  updated_at          timestamptz,
  similarity          float
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.id,
    j.title,
    j.description,
    j.requirements,
    j.skills,
    j.location,
    j.job_type,
    j.experience_level,
    j.category,
    j.salary_min,
    j.salary_max,
    j.is_remote,
    j.status,
    j.employer_id,
    j.employer_profile_id,
    j.views,
    j.created_at,
    j.updated_at,
    (1 - (j.embedding <=> query_embedding))::float AS similarity
  FROM jobs j
  WHERE
    j.status    = 'active'
    AND j.embedding IS NOT NULL
    AND (1 - (j.embedding <=> query_embedding)) >= match_threshold
  ORDER BY j.embedding <=> query_embedding   -- ASC = most similar first
  LIMIT match_count;
END;
$$;


-- ------------------------------------------------------------------
-- match_candidates_for_job
-- Given a job's embedding, returns candidates ranked by cosine
-- similarity (highest first). Used by employer matching panel.
-- Called by: findMatchingCandidatesForJob() in matchingService.js
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_candidates_for_job(
  query_embedding  vector(384),
  match_threshold  float   DEFAULT 0.20,
  match_count      integer DEFAULT 30
)
RETURNS TABLE (
  user_id            uuid,
  headline           text,
  bio                text,
  skills             text[],
  experience_years   integer,
  preferred_location text,
  resume_url         text,
  similarity         float
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.user_id,
    cp.headline,
    cp.bio,
    cp.skills,
    cp.experience_years,
    cp.preferred_location,
    cp.resume_url,
    (1 - (cp.embedding <=> query_embedding))::float AS similarity
  FROM candidate_profiles cp
  WHERE
    cp.embedding IS NOT NULL
    AND cp.is_open_to_work = true
    AND (1 - (cp.embedding <=> query_embedding)) >= match_threshold
  ORDER BY cp.embedding <=> query_embedding   -- ASC = most similar first
  LIMIT match_count;
END;
$$;


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
-- The backend uses the service_role key which bypasses RLS,
-- so these are left disabled by default.
-- Uncomment if you want to add extra protection.
--
-- ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE jobs         ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
