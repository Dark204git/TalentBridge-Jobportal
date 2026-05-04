/**
 * embeddingService.js
 *
 * Wraps @xenova/transformers to generate 384-dimensional sentence embeddings
 * using the free, fully local "all-MiniLM-L6-v2" model.
 *
 * The model (~23 MB) is downloaded once on first use and cached in
 * node_modules/.cache/transformers — no API keys, no cost, no network
 * calls after the first download.
 *
 * Usage:
 *   import { embed, embedBatch, cosineSimilarity } from './embeddingService.js';
 *   const vec = await embed("Senior React developer with 5 years experience");
 */

import { pipeline, env } from '@xenova/transformers';

// ── Config ────────────────────────────────────────────────────────────────────
// Keep model files in the project's .cache folder so Railway / Render
// persistent disks can cache them between deploys.
env.cacheDir = './.cache/transformers';

// Disable the remote model check in production to avoid network delays.
// The model is always available once downloaded.
env.allowRemoteModels = true;
env.allowLocalModels  = true;

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2'; // 384 dims, ~23 MB, very fast

// ── Singleton ─────────────────────────────────────────────────────────────────
// We load the pipeline once and reuse it across all requests.
// This avoids the ~1-2 second cold-start on every embedding call.
let _pipe = null;
let _loading = false;
let _waiters = [];

async function getPipeline() {
  if (_pipe) return _pipe;

  // If another call is already loading, queue up and wait
  if (_loading) {
    return new Promise((resolve, reject) => _waiters.push({ resolve, reject }));
  }

  _loading = true;
  console.log(`🤖 Loading embedding model: ${MODEL_NAME} …`);

  try {
    _pipe = await pipeline('feature-extraction', MODEL_NAME, {
      quantized: true, // use int8 quantized weights — 4× smaller, nearly same accuracy
    });
    console.log('✅ Embedding model ready');
    _waiters.forEach(w => w.resolve(_pipe));
    _waiters = [];
    return _pipe;
  } catch (err) {
    _loading = false;
    _waiters.forEach(w => w.reject(err));
    _waiters = [];
    throw err;
  }
}

// Pre-warm the model on startup so the first real request is fast
getPipeline().catch(err => console.error('Model pre-warm failed:', err.message));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Mean-pool the token embeddings into a single fixed-size vector,
 * then L2-normalise it so cosine similarity = dot product.
 */
function meanPoolAndNormalize(tensorData, dims) {
  // tensorData shape: [1, seq_len, hidden_size]
  const [, seqLen, hiddenSize] = dims;
  const pooled = new Float32Array(hiddenSize);

  for (let h = 0; h < hiddenSize; h++) {
    let sum = 0;
    for (let t = 0; t < seqLen; t++) {
      sum += tensorData[t * hiddenSize + h];
    }
    pooled[h] = sum / seqLen;
  }

  // L2 normalise
  let norm = 0;
  for (let i = 0; i < hiddenSize; i++) norm += pooled[i] ** 2;
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < hiddenSize; i++) pooled[i] /= norm;

  return Array.from(pooled);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generate a 384-dimensional embedding vector for a single text string.
 * Returns a regular JS number[] that can be JSON-serialised and stored in pgvector.
 *
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function embed(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('embed() requires a non-empty string');
  }

  const extractor = await getPipeline();

  // Truncate very long texts — the model max is 512 tokens (~2000 chars)
  const truncated = text.slice(0, 2000);

  const output = await extractor(truncated, {
    pooling: 'mean',
    normalize: true,
  });

  // output.data is a Float32Array, dims is [batch, seq, hidden]
  return Array.from(output.data);
}

/**
 * Embed multiple texts in one call (slightly more efficient).
 * Returns an array of vectors in the same order.
 *
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function embedBatch(texts) {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  return Promise.all(texts.map(t => embed(t)));
}

/**
 * Cosine similarity between two vectors (both must be L2-normalised).
 * Returns a value in [-1, 1] where 1 = identical.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) throw new Error('Vector dimension mismatch');
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // already normalised → dot == cosine similarity
}

/**
 * Convert a similarity score ([-1,1]) to a human-readable match percentage [0,100].
 * Scores below 0 are clamped to 0.
 *
 * @param {number} similarity
 * @returns {number}
 */
export function similarityToPercent(similarity) {
  // all-MiniLM-L6-v2 cosine similarities for job matching cluster between 0.15–0.70.
  // Mapping this range to 0–100% gives human-readable scores:
  //   raw 0.15 → 0%   (completely unrelated)
  //   raw 0.35 → 33%  (weak match)
  //   raw 0.50 → 58%  (decent match)
  //   raw 0.60 → 75%  (strong match)
  //   raw 0.70 → 100% (excellent match)
  const MIN_SIM = 0.15;
  const MAX_SIM = 0.70;
  const clamped = Math.max(MIN_SIM, Math.min(MAX_SIM, similarity));
  return Math.round(((clamped - MIN_SIM) / (MAX_SIM - MIN_SIM)) * 100);
}

/**
 * Build the text blob we embed for a candidate.
 * Packs all signal into one string so the model captures the whole profile.
 *
 * @param {object} profile  candidate_profiles row
 * @returns {string}
 */
// Parse a TEXT column value that may be a plain string OR a JSON-serialised array/object.
// Returns a native JS value (array, object, or string).
function parseField(value) {
  if (!value) return value;
  if (typeof value !== 'string') return value;   // already parsed (JSONB path)
  const t = value.trim();
  if (t.startsWith('[') || t.startsWith('{')) {
    try { return JSON.parse(t); } catch { /* fall through */ }
  }
  return value;   // plain text written by the user
}

// Flatten an experience entry (object or string) to a readable sentence
function expToText(e) {
  if (typeof e === 'string') return e;
  const duration = e.duration || [e.startDate, e.endDate].filter(Boolean).join('–');
  const parts = [e.title, e.company && `at ${e.company}`, duration].filter(Boolean);
  const desc   = Array.isArray(e.responsibilities) && e.responsibilities.length
    ? e.responsibilities.join('. ')
    : (e.description || '');
  return [parts.join(' '), desc].filter(Boolean).join(': ');
}

// Flatten an education entry (object or string) to a readable phrase
function eduToText(e) {
  if (typeof e === 'string') return e;
  return [e.degree, e.field, e.institution, e.year || e.graduationYear].filter(Boolean).join(', ');
}

export function buildCandidateText(profile) {
  const parts = [];

  // Identity / intent
  if (profile.desired_job_title)  parts.push(profile.desired_job_title);
  if (profile.preferred_category) parts.push(`Category: ${profile.preferred_category}`);
  if (profile.preferred_job_type)  parts.push(`Preferred job type: ${profile.preferred_job_type}`);
  if (profile.headline)            parts.push(profile.headline);

  // Skills — repeated for emphasis
  if (profile.skills?.length) {
    const skillStr = profile.skills.join(', ');
    parts.push(`Technical skills: ${skillStr}`);
    parts.push(`Proficient in: ${skillStr}`);
  }

  if (profile.experience_years) parts.push(`${profile.experience_years} years of professional experience`);
  if (profile.bio)               parts.push(profile.bio.slice(0, 600));

  // Work history — handles TEXT/JSON string, array of objects, or plain string
  const rawExp = parseField(profile.experience);
  if (rawExp) {
    const expText = Array.isArray(rawExp)
      ? rawExp.map(expToText).filter(Boolean).join('. ')
      : typeof rawExp === 'object'
        ? expToText(rawExp)
        : String(rawExp);
    if (expText.trim()) parts.push(expText.slice(0, 600));
  }

  // Education — same handling
  const rawEdu = parseField(profile.education);
  if (rawEdu) {
    const eduText = Array.isArray(rawEdu)
      ? rawEdu.map(eduToText).filter(Boolean).join('. ')
      : typeof rawEdu === 'object'
        ? eduToText(rawEdu)
        : String(rawEdu);
    if (eduText.trim()) parts.push(eduText.slice(0, 300));
  }

  return parts.join('. ');
}

/**
 * Build the text blob we embed for a job posting.
 *
 * @param {object} job  jobs row
 * @returns {string}
 */
export function buildJobText(job) {
  const parts = [];

  // Title + level — core identity
  if (job.title)            parts.push(job.title);
  if (job.experience_level) parts.push(`${job.experience_level} level position`);
  if (job.category)         parts.push(job.category);

  // Skills — most discriminating signal, repeated for weight
  if (job.skills?.length) {
    const skillStr = job.skills.join(', ');
    parts.push(`Required skills: ${skillStr}`);
    parts.push(`Looking for expertise in: ${skillStr}`);  // intentional repetition
  }

  // Requirements before description (more signal-dense)
  if (job.requirements)     parts.push(job.requirements.slice(0, 500));

  // Description last (most verbose, least signal-dense)
  if (job.description)      parts.push(job.description.slice(0, 700));

  return parts.join('. ');
}