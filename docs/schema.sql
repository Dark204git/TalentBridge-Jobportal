



-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- USERS TABLE

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


-- EMPLOYER PROFILES TABLE

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


-- CANDIDATE PROFILES TABLE

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


-- JOBS TABLE

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


-- APPLICATIONS TABLE

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


-- SAVED JOBS TABLE

CREATE TABLE IF NOT EXISTS saved_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);


-- JOB VIEWS TABLE (for analytics)

CREATE TABLE IF NOT EXISTS job_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- INDEXES FOR PERFORMANCE

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


-- ROW LEVEL SECURITY (RLS)



-- Find jobs matching a candidate embedding

DROP FUNCTION IF EXISTS match_jobs_for_candidate(vector, double precision, integer);
CREATE OR REPLACE FUNCTION match_jobs_for_candidate(
  query_embedding vector(384),
  match_threshold double precision,
  match_count integer
)
RETURNS TABLE (
  id         UUID,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    j.id,
    1 - (j.embedding <=> query_embedding) AS similarity
  FROM jobs j
  WHERE
    j.status    = 'active'
    AND j.embedding IS NOT NULL
    AND 1 - (j.embedding <=> query_embedding) >= match_threshold
  ORDER BY j.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Find candidates matching a job embedding
DROP FUNCTION match_candidates_for_job(vector,double precision,integer);
CREATE OR REPLACE FUNCTION match_candidates_for_job(
  query_embedding VECTOR(384),
  match_threshold FLOAT,
  match_count     INT
)
RETURNS TABLE (
  user_id    UUID,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    cp.user_id,
    1 - (cp.embedding <=> query_embedding) AS similarity
  FROM candidate_profiles cp
  WHERE
    cp.embedding IS NOT NULL
    AND 1 - (cp.embedding <=> query_embedding) >= match_threshold
  ORDER BY cp.embedding <=> query_embedding
  LIMIT match_count;
$$;

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


-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- USERS TABLE

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


-- EMPLOYER PROFILES TABLE

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


-- CANDIDATE PROFILES TABLE

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


-- JOBS TABLE

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


-- APPLICATIONS TABLE

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


-- SAVED JOBS TABLE

CREATE TABLE IF NOT EXISTS saved_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);


-- JOB VIEWS TABLE (for analytics)

CREATE TABLE IF NOT EXISTS job_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- INDEXES FOR PERFORMANCE

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


-- pgvector similarity search functions
-- DROP first so return type can be changed safely on re-runs.


DROP FUNCTION IF EXISTS match_jobs_for_candidate(vector, float, int);
DROP FUNCTION IF EXISTS match_candidates_for_job(vector, float, int);

CREATE FUNCTION match_jobs_for_candidate(
  query_embedding  vector(384),
  match_threshold  float  DEFAULT 0.20,
  match_count      int    DEFAULT 20
)
RETURNS TABLE (
  id               uuid,
  title            text,
  employer_id      uuid,
  location         text,
  job_type         text,
  experience_level text,
  category         text,
  salary_min       int,
  salary_max       int,
  is_remote        boolean,
  skills           text[],
  status           text,
  created_at       timestamptz,
  similarity       float
)
LANGUAGE sql STABLE AS $$
  SELECT
    j.id, j.title, j.employer_id, j.location, j.job_type,
    j.experience_level, j.category, j.salary_min, j.salary_max,
    j.is_remote, j.skills, j.status, j.created_at,
    1 - (j.embedding <=> query_embedding) AS similarity
  FROM jobs j
  WHERE j.status = 'active'
    AND j.embedding IS NOT NULL
    AND 1 - (j.embedding <=> query_embedding) >= match_threshold
  ORDER BY j.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE FUNCTION match_candidates_for_job(
  query_embedding  vector(384),
  match_threshold  float  DEFAULT 0.20,
  match_count      int    DEFAULT 50
)
RETURNS TABLE (
  user_id            uuid,
  headline           text,
  skills             text[],
  experience_years   int,
  preferred_location text,
  resume_url         text,
  similarity         float
)
LANGUAGE sql STABLE AS $$
  SELECT
    cp.user_id, cp.headline, cp.skills, cp.experience_years,
    cp.preferred_location, cp.resume_url,
    1 - (cp.embedding <=> query_embedding) AS similarity
  FROM candidate_profiles cp
  WHERE cp.embedding IS NOT NULL
    AND cp.is_open_to_work = true
    AND 1 - (cp.embedding <=> query_embedding) >= match_threshold
  ORDER BY cp.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- HNSW indexes for fast ANN search
DROP INDEX IF EXISTS idx_jobs_embedding;
DROP INDEX IF EXISTS idx_candidate_profiles_embedding;

CREATE INDEX IF NOT EXISTS idx_jobs_embedding_hnsw
  ON jobs USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_candidates_embedding_hnsw
  ON candidate_profiles USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

  ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS resume_parse_failed BOOLEAN DEFAULT FALSE;

  ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS preferred_category VARCHAR(100);
  ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS preferred_job_type VARCHAR(50);

  DROP FUNCTION IF EXISTS match_jobs_for_candidate(vector, double precision, integer);
DROP FUNCTION IF EXISTS match_candidates_for_job(vector, double precision, integer);

CREATE OR REPLACE FUNCTION match_jobs_for_candidate(
  query_embedding  vector(384),
  match_threshold  float   DEFAULT 0.20,
  match_count      integer DEFAULT 20
)
RETURNS TABLE (
  id               uuid,
  title            text,
  similarity       float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.id,
    j.title,
    (1 - (j.embedding <=> query_embedding))::float AS similarity
  FROM jobs j
  WHERE
    j.status = 'active'
    AND j.embedding IS NOT NULL
    AND 1 - (j.embedding <=> query_embedding) >= match_threshold
  ORDER BY j.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


CREATE OR REPLACE FUNCTION match_candidates_for_job(
  query_embedding  vector(384),
  match_threshold  float   DEFAULT 0.20,
  match_count      integer DEFAULT 30
)
RETURNS TABLE (
  user_id    uuid,
  headline   text,
  bio        text,
  skills     text[],
  experience_years integer,
  preferred_location text,
  similarity float
)
LANGUAGE plpgsql
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
    (1 - (cp.embedding <=> query_embedding))::float AS similarity
  FROM candidate_profiles cp
  WHERE
    cp.embedding IS NOT NULL
    AND 1 - (cp.embedding <=> query_embedding) >= match_threshold
  ORDER BY cp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


-- pgvector RPC Functions for AI Job Matching

DROP FUNCTION IF EXISTS match_jobs_for_candidate(vector, double precision, integer);
DROP FUNCTION IF EXISTS match_candidates_for_job(vector, double precision, integer);

-- Enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. match_jobs_for_candidate 

-- Called by: findMatchingJobsForCandidate()

CREATE OR REPLACE FUNCTION match_jobs_for_candidate(
  query_embedding  vector(384),
  match_threshold  float   DEFAULT 0.20,
  match_count      integer DEFAULT 20
)
RETURNS TABLE (
  id               uuid,
  title            text,
  description      text,
  requirements     text,
  skills           text[],
  location         text,
  job_type         text,
  experience_level text,
  category         text,
  salary_min       integer,
  salary_max       integer,
  status           text,
  employer_id      uuid,
  employer_profile_id uuid,
  views            integer,
  created_at       timestamptz,
  updated_at       timestamptz,
  similarity       float
)
LANGUAGE plpgsql
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
    j.status,
    j.employer_id,
    j.employer_profile_id,
    j.views,
    j.created_at,
    j.updated_at,
    1 - (j.embedding <=> query_embedding) AS similarity
  FROM jobs j
  WHERE
    j.status = 'active'
    AND j.embedding IS NOT NULL
    AND 1 - (j.embedding <=> query_embedding) >= match_threshold
  ORDER BY j.embedding <=> query_embedding   -- ASC = most similar first
  LIMIT match_count;
END;
$$;


-- 2. match_candidates_for_job

CREATE OR REPLACE FUNCTION match_candidates_for_job(
  query_embedding  vector(384),
  match_threshold  float   DEFAULT 0.20,
  match_count      integer DEFAULT 30
)
RETURNS TABLE (
  user_id    uuid,
  headline   text,
  bio        text,
  skills     text[],
  experience_years integer,
  preferred_location text,
  similarity float
)
LANGUAGE plpgsql
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
    1 - (cp.embedding <=> query_embedding) AS similarity
  FROM candidate_profiles cp
  WHERE
    cp.embedding IS NOT NULL
    AND 1 - (cp.embedding <=> query_embedding) >= match_threshold
  ORDER BY cp.embedding <=> query_embedding   -- ASC = most similar first
  LIMIT match_count;
END;
$$;


--  3. Optional: HNSW index for fast ANN search 

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Tables 
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL CHECK (role IN ('candidate', 'employer', 'admin')),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employer_profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name        VARCHAR(255),
  company_description TEXT,
  industry            VARCHAR(100),
  company_size        VARCHAR(50),
  company_website     VARCHAR(255),
  company_logo        VARCHAR(500),
  headquarters        VARCHAR(255),
  founded_year        INTEGER,
  linkedin_url        VARCHAR(255),
  twitter_url         VARCHAR(255),
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS candidate_profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  headline            VARCHAR(255),
  bio                 TEXT,
  profile_picture     TEXT,
  skills              TEXT[] DEFAULT '{}',
  experience_years    INTEGER,
  education           TEXT,
  experience          TEXT,
  desired_job_title   VARCHAR(255),
  preferred_location  VARCHAR(255),
  desired_salary      TEXT,
  is_open_to_work     BOOLEAN DEFAULT TRUE,
  resume_url          VARCHAR(500),
  resume_key          TEXT,
  resume_filename     VARCHAR(255),
  resume_uploaded_at  TIMESTAMP WITH TIME ZONE,
  resume_parsed       BOOLEAN DEFAULT FALSE,
  resume_parsed_at    TIMESTAMP WITH TIME ZONE,
  linkedin_url        VARCHAR(255),
  github_url          VARCHAR(255),
  portfolio_url       VARCHAR(255),
  phone_number        TEXT,
  country_code        TEXT DEFAULT '+91',
  date_of_birth       DATE,
  gender              TEXT,
  lives_in            TEXT,
  embedding           VECTOR(384),
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employer_profile_id  UUID REFERENCES employer_profiles(id),
  title                VARCHAR(255) NOT NULL,
  description          TEXT NOT NULL,
  requirements         TEXT,
  skills               TEXT[] DEFAULT '{}',
  location             VARCHAR(255),
  job_type             VARCHAR(50)  CHECK (job_type IN ('full-time','part-time','contract','freelance','internship')),
  experience_level     VARCHAR(50)  CHECK (experience_level IN ('entry','mid','senior','lead','executive')),
  category             VARCHAR(100),
  salary_min           INTEGER,
  salary_max           INTEGER,
  is_remote            BOOLEAN DEFAULT FALSE,
  application_deadline TIMESTAMP WITH TIME ZONE,
  status               VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','closed','draft')),
  views                INTEGER DEFAULT 0,
  embedding            VECTOR(384),
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id         UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cover_letter   TEXT,
  resume_url     VARCHAR(500),
  status         VARCHAR(30) DEFAULT 'pending' CHECK (
    status IN ('pending','reviewing','shortlisted','interviewed','offered','rejected','withdrawn')
  ),
  employer_notes TEXT,
  match_score    INTEGER,
  applied_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(job_id, candidate_id)
);

CREATE TABLE IF NOT EXISTS saved_jobs (
  id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id   UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

CREATE TABLE IF NOT EXISTS job_views (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id    UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50)  NOT NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT NOT NULL,
  link       VARCHAR(500),
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

--  Indexes 
CREATE INDEX IF NOT EXISTS idx_jobs_employer_id          ON jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status               ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_category             ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at           ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_job_id       ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_candidate_id ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_employer_id  ON applications(employer_id);
CREATE INDEX IF NOT EXISTS idx_applications_status       ON applications(status);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_id        ON saved_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_job_views_job_id          ON job_views(job_id);
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_user_id ON candidate_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_employer_profiles_user_id  ON employer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash  ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_user_id     ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id      ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read      ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created      ON notifications(created_at DESC);

-- HNSW vector indxes (fast approximate nearest-neighbour

CREATE INDEX IF NOT EXISTS idx_jobs_embedding_hnsw
  ON jobs USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_candidates_embedding_hnsw
  ON candidate_profiles USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Views

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

CREATE OR REPLACE VIEW job_application_stats AS
SELECT
  j.id          AS job_id,
  j.title,
  j.employer_id,
  j.views,
  COUNT(a.id)                                              AS total_applications,
  COUNT(CASE WHEN a.status = 'shortlisted' THEN 1 END)    AS shortlisted_count,
  COUNT(CASE WHEN a.status = 'offered'     THEN 1 END)    AS offered_count
FROM jobs j
LEFT JOIN applications a ON j.id = a.job_id
GROUP BY j.id, j.title, j.employer_id, j.views;

--  pgvector functions

DROP FUNCTION IF EXISTS match_jobs_for_candidate(vector, float, int);
DROP FUNCTION IF EXISTS match_candidates_for_job(vector, float, int);


CREATE FUNCTION match_jobs_for_candidate(
  query_embedding  vector(384),
  match_threshold  float  DEFAULT 0.20,
  match_count      int    DEFAULT 20
)
RETURNS TABLE (
  id               uuid,
  title            text,
  employer_id      uuid,
  location         text,
  job_type         text,
  experience_level text,
  category         text,
  salary_min       int,
  salary_max       int,
  is_remote        boolean,
  skills           text[],
  status           text,
  created_at       timestamptz,
  similarity       float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    j.id,
    j.title,
    j.employer_id,
    j.location,
    j.job_type,
    j.experience_level,
    j.category,
    j.salary_min,
    j.salary_max,
    j.is_remote,
    j.skills,
    j.status,
    j.created_at,
    1 - (j.embedding <=> query_embedding) AS similarity
  FROM jobs j
  WHERE
    j.status    = 'active'
    AND j.embedding IS NOT NULL
    AND 1 - (j.embedding <=> query_embedding) >= match_threshold
  ORDER BY j.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Returns candidates ranked by cosine similarity to a job embedding.
CREATE FUNCTION match_candidates_for_job(
  query_embedding  vector(384),
  match_threshold  float  DEFAULT 0.20,
  match_count      int    DEFAULT 50
)
RETURNS TABLE (
  user_id            uuid,
  headline           text,
  skills             text[],
  experience_years   int,
  preferred_location text,
  resume_url         text,
  similarity         float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    cp.user_id,
    cp.headline,
    cp.skills,
    cp.experience_years,
    cp.preferred_location,
    cp.resume_url,
    1 - (cp.embedding <=> query_embedding) AS similarity
  FROM candidate_profiles cp
  WHERE
    cp.embedding IS NOT NULL
    AND cp.is_open_to_work = true
    AND 1 - (cp.embedding <=> query_embedding) >= match_threshold
  ORDER BY cp.embedding <=> query_embedding
  LIMIT match_count;
$$;

--  Clear stale embeddings 
UPDATE candidate_profiles SET embedding = NULL;
UPDATE jobs               SET embedding = NULL WHERE status = 'active';

ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS date_of_birth  TEXT,
  ADD COLUMN IF NOT EXISTS gender         TEXT,
  ADD COLUMN IF NOT EXISTS phone_number   TEXT,
  ADD COLUMN IF NOT EXISTS lives_in       TEXT;


-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
create extension if not exists vector with schema extensions;


-- USERS TABLE

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


-- EMPLOYER PROFILES TABLE

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


-- CANDIDATE PROFILES TABLE

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


-- JOBS TABLE

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


-- APPLICATIONS TABLE

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


-- SAVED JOBS TABLE

CREATE TABLE IF NOT EXISTS saved_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);


-- JOB VIEWS TABLE (for analytics)

CREATE TABLE IF NOT EXISTS job_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- INDEXES FOR PERFORMANCE

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

create extension if not exists vector
with schema extensions;

CREATE TABLE  IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX ON password_reset_tokens(token_hash);
CREATE INDEX ON password_reset_tokens(user_id);


CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  -- Types: application_received | application_status_changed | job_match | job_saved | profile_viewed | system
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(500),          -- optional deep-link (e.g. /employer/applications)
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read   ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created   ON notifications(created_at DESC);

ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS resume_key TEXT;

create table table_name (
  id bigint generated by default as identity primary key,
  inserted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  data jsonb,
  name text
);


-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
create extension if not exists vector with schema extensions;


-- USERS TABLE

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


-- EMPLOYER PROFILES TABLE

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


-- CANDIDATE PROFILES TABLE

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


-- JOBS TABLE

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


-- APPLICATIONS TABLE

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


-- SAVED JOBS TABLE

CREATE TABLE IF NOT EXISTS saved_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);


-- JOB VIEWS TABLE (for analytics)

CREATE TABLE IF NOT EXISTS job_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- INDEXES FOR PERFORMANCE

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

create extension if not exists vector
with schema extensions;

CREATE TABLE  IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX ON password_reset_tokens(token_hash);
CREATE INDEX ON password_reset_tokens(user_id);

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding columns if they don't exist yet
--    (skip if your schema.sql already added them)
ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS embedding vector(384);

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS embedding vector(384);

-- 3. Add match_score to applications if missing
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS match_score INTEGER;

-- 4. HNSW indexes for fast approximate nearest-neighbour search

CREATE INDEX IF NOT EXISTS idx_candidate_embedding
  ON candidate_profiles
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_job_embedding
  ON jobs
  USING hnsw (embedding vector_cosine_ops);


-- 5. match_jobs_for_candidate(candidate_embedding, limit)

CREATE OR REPLACE FUNCTION match_jobs_for_candidate(
  query_embedding   vector(384),
  match_threshold   float    DEFAULT 0.3,
  match_count       int      DEFAULT 20
)
RETURNS TABLE (
  id            uuid,
  title         text,
  employer_id   uuid,
  location      text,
  job_type      text,
  salary_min    int,
  salary_max    int,
  is_remote     boolean,
  skills        text[],
  created_at    timestamptz,
  similarity    float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    j.id,
    j.title,
    j.employer_id,
    j.location,
    j.job_type,
    j.salary_min,
    j.salary_max,
    j.is_remote,
    j.skills,
    j.created_at,
    1 - (j.embedding <=> query_embedding) AS similarity
  FROM jobs j
  WHERE
    j.status   = 'active'
    AND j.embedding IS NOT NULL
    AND 1 - (j.embedding <=> query_embedding) >= match_threshold
  ORDER BY j.embedding <=> query_embedding   -- cosine distance ASC = similarity DESC
  LIMIT match_count;
$$;


-- 6. match_candidates_for_job(job_embedding, limit)

CREATE OR REPLACE FUNCTION match_candidates_for_job(
  query_embedding   vector(384),
  match_threshold   float    DEFAULT 0.3,
  match_count       int      DEFAULT 50
)
RETURNS TABLE (
  user_id           uuid,
  headline          text,
  skills            text[],
  experience_years  int,
  preferred_location text,
  resume_url        text,
  similarity        float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    cp.user_id,
    cp.headline,
    cp.skills,
    cp.experience_years,
    cp.preferred_location,
    cp.resume_url,
    1 - (cp.embedding <=> query_embedding) AS similarity
  FROM candidate_profiles cp
  WHERE
    cp.embedding IS NOT NULL
    AND cp.is_open_to_work = true
    AND 1 - (cp.embedding <=> query_embedding) >= match_threshold
  ORDER BY cp.embedding <=> query_embedding
  LIMIT match_count;
$$;

ALTER TABLE candidate_profiles
  ALTER COLUMN desired_salary TYPE TEXT;

  ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS resume_key TEXT;

  ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS profile_picture  TEXT,
  ADD COLUMN IF NOT EXISTS phone_number     TEXT,
  ADD COLUMN IF NOT EXISTS country_code     TEXT DEFAULT '+91',
  ADD COLUMN IF NOT EXISTS date_of_birth    DATE,
  ADD COLUMN IF NOT EXISTS gender           TEXT,
  ADD COLUMN IF NOT EXISTS lives_in         TEXT;

  