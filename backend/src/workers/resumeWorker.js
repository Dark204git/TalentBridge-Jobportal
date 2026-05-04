import { Worker } from 'bullmq';
import { redis } from '../config/redis.js';
import { supabase } from '../config/supabase.js';
import { triggerCandidateMatchOnResume } from '../services/matchingService.js';
import https from 'https';
import http from 'http';

// ── Text fetcher ──────────────────────────────────────────────────────────────
const fetchBuffer = (url) =>
  new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });

// ── Gemini resume parser ──────────────────────────────────────────────────────
// Primary parser — sends resume text to Gemini 1.5 Flash and gets back
// a structured JSON object. All existing regex functions below are used
// as a fallback if Gemini fails (rate limit, missing key, network error).

// Model priority: try flash-lite first (higher free quota), fall back to flash
const GEMINI_MODELS = [ 
  'gemini-2.5-flash',   
  'gemini-2.5-flash-lite',  
  'gemini-3-flash',     
  'gemini-3-flash-lite'  
 ];
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const RESUME_PROMPT = (resumeText) => `
Your sole objective is to analyze the provided resume text and extract specific data points into a strict, predefined JSON format.

Extraction Rules:
1. Strict Compliance: You must return only a valid JSON object. Do not include any conversational text, markdown formatting (like \`\`\`json), or explanations before or after the JSON.
2. Missing Data: If a specific piece of information is not found in the resume, return null for that field (or an empty array [] for lists). Do not guess or invent information.
3. Data Formatting Rules:
   * dateOfBirth: Must be formatted exactly as "DD-MM-YYYY". If only a year is found, return "01-01-YYYY". If not found, return null.
   * totalYearsExperience: Must be a single number (e.g., 5.5). Calculate this if not explicitly stated, based on the work history dates. If unable to calculate, return 0.
   * expectedSalary: Must be a single number. If a range is given (e.g., "$80k - $100k"), extract the average or the lower bound as a number (e.g., 80000).
   * gender: Extract if explicitly stated or strongly implied by pronouns/awards, otherwise null.

Required JSON Structure:
{
  "contact": {
    "phoneNumber": "string or null",
    "address": "string or null (City, State/Country preferred)"
  },
  "personal": {
    "dateOfBirth": "string (DD-MM-YYYY) or null",
    "gender": "string or null",
    "bio": "string (A concise 2-3 sentence professional summary) or null"
  },
  "professional": {
    "currentHeadline": "string (Current job title or professional headline) or null",
    "totalYearsExperience": 0,
    "desiredJobTitle": "string or null",
    "preferredLocation": "string or null",
    "expectedSalary": 0,
    "preferredJobType": "string (one of: full-time, part-time, contract, freelance, internship) or null",
    "preferredCategory": "string (one of: Technology, Finance, Design, Marketing, Healthcare, Legal, Education, Engineering, Sales, HR, Other) or null — infer from skills and experience if not explicitly stated"
  },
  "skills": [
    "array of strings (extract all technical, soft, and domain-specific skills)"
  ],
  "education": [
    {
      "degree": "string (e.g., B.S. Computer Science)",
      "institution": "string",
      "graduationYear": "string (YYYY) or null"
    }
  ],
  "workExperience": [
    {
      "jobTitle": "string",
      "company": "string",
      "startDate": "string (MM-YYYY or YYYY)",
      "endDate": "string (MM-YYYY, YYYY, or 'Present')",
      "description": "string (Brief summary of responsibilities)"
    }
  ],
  "links": {
    "linkedin": "string (URL) or null",
    "github": "string (URL) or null",
    "portfolio": "string (URL) or null"
  }
}

Resume text:
---
${resumeText.slice(0, 12000)}
---
`.trim();

async function parseWithGemini(resumeText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in environment');

  let lastError;
  for (const model of GEMINI_MODELS) {
    try {
      const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: RESUME_PROMPT(resumeText) }] }],
          generationConfig: {
            temperature: 0.1,
            topP: 0.8,
            maxOutputTokens: 4096,
          },
        }),
        signal: AbortSignal.timeout(30_000),
      });

      // 429 = quota hit on this model → try next model
      if (response.status === 429) {
        console.warn(`  ⚠️  ${model} quota exceeded, trying next model…`);
        lastError = new Error(`${model} quota exceeded (429)`);
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) throw new Error('Gemini returned empty response');

      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned);
      console.log(`  ✅ Gemini model used: ${model}`);
      return parsed;

    } catch (err) {
      if (err.message.includes('quota exceeded')) { lastError = err; continue; }
      throw err; // non-quota errors bubble up immediately
    }
  }

  throw lastError || new Error('All Gemini models exhausted');
}

// Maps the new structured JSON from Gemini to the existing DB column names,
// enforcing correct types for every field along the way.
function sanitiseGeminiOutput(parsed) {
  const p = parsed || {};
  const professional = p.professional || {};
  const personal     = p.personal     || {};
  const contact      = p.contact      || {};
  const links        = p.links        || {};

  // expectedSalary comes back as a number — store as string for the TEXT column
  const salaryNum = Number(professional.expectedSalary);
  const salary    = !isNaN(salaryNum) && salaryNum > 0
    ? String(Math.round(salaryNum))
    : null;

  // totalYearsExperience — already a number per the prompt rules
  const expYears = typeof professional.totalYearsExperience === 'number'
    ? Math.round(professional.totalYearsExperience)
    : null;

  // workExperience → map to the shape the rest of the app expects
  const experience = Array.isArray(p.workExperience)
    ? p.workExperience.slice(0, 10).map(e => ({
        title:    e.jobTitle   || null,
        company:  e.company    || null,
        duration: e.startDate && e.endDate
          ? `${e.startDate} - ${e.endDate}`
          : (e.startDate || e.endDate || null),
        responsibilities: e.description
          ? [e.description]   // stored as one-item array for consistency
          : [],
      }))
    : [];

  // education → map graduationYear → year
  const education = Array.isArray(p.education)
    ? p.education.slice(0, 5).map(e => ({
        degree:      e.degree          || null,
        institution: e.institution     || null,
        year:        e.graduationYear  || null,
        gpa:         null,
      }))
    : [];

  return {
    // Professional
    skills:             Array.isArray(p.skills) ? p.skills.filter(Boolean) : [],
    desired_salary:     salary,
    headline:           professional.currentHeadline
                          ? String(professional.currentHeadline).slice(0, 255) : null,
    experience_years:   expYears,
    desired_job_title:  professional.desiredJobTitle
                          ? String(professional.desiredJobTitle).slice(0, 255) : null,
    preferred_location: professional.preferredLocation
                          ? String(professional.preferredLocation).slice(0, 255) : null,
    // Personal
    bio:                personal.bio
                          ? String(personal.bio).slice(0, 2000) : null,
    date_of_birth:      personal.dateOfBirth   || null,
    gender:             personal.gender        || null,
    // Contact
    phone_number:       contact.phoneNumber    || null,
    lives_in:           contact.address        || null,
    // Links
    linkedin_url:       links.linkedin         || null,
    github_url:         links.github           || null,
    portfolio_url:      links.portfolio        || null,
    preferred_job_type:  professional.preferredJobType
                          ? String(professional.preferredJobType).toLowerCase().trim() : null,
    preferred_category:  professional.preferredCategory
                          ? String(professional.preferredCategory).trim() : null,
    // Arrays
    experience,
    education,
  };
}

// ── Section splitter ──────────────────────────────────────────────────────────
// Splits raw resume text into named buckets by detecting common headers.
// All extractors below operate on these buckets for higher accuracy.
const splitIntoSections = (text) => {
  const knownHeaders = [
    'summary','objective','profile','about me','about','overview','bio',
    'professional summary','career summary','career objective','professional profile',
    'personal statement','executive summary','professional background',
    'experience','work experience','employment','work history',
    'professional experience','employment history','career history',
    'internship','internships','work experience summary','relevant experience',
    'education','academic background','academic qualifications','qualifications',
    'educational background','educational qualifications','academic history',
    'skills','technical skills','core competencies','competencies',
    'key skills','expertise','technologies','technical expertise',
    'tools','tools & technologies','programming languages','software skills',
    'soft skills','interpersonal skills','other skills','additional skills',
    'certifications','certificates','licenses','accreditations',
    'professional certifications','certification & licenses',
    'projects','personal projects','key projects','notable projects',
    'academic projects','open source','side projects','portfolio',
    'languages','language proficiency','spoken languages','language skills',
    'awards','honors','achievements','accomplishments',
    'honors & awards','recognitions','scholarships',
    'interests','hobbies','personal interests','extracurricular',
    'extracurricular activities','activities','volunteer','volunteering',
    'volunteer experience','community service','social work',
    'publications','papers','research','research experience',
    'patents','inventions','speaking','conferences','talks',
    'courses','training','professional development','online courses',
    'professional affiliations','memberships','associations','affiliations',
    'declaration','references','references available on request',
    'contact','contact information','contact details','personal information',
    'personal details','additional information',
  ];
  const headerRegex = new RegExp(
    `^(${knownHeaders.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*[:\\-]?\\s*$`,
    'im'
  );
  const sections = {};
  let currentKey = 'header';
  let buffer = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (headerRegex.test(trimmed)) {
      sections[currentKey] = buffer.join('\n').trim();
      currentKey = trimmed.toLowerCase().replace(/[:\-\s]+$/, '').trim();
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  sections[currentKey] = buffer.join('\n').trim();
  return sections;
};

// helper: find a section by any matching keyword
const getSection = (sections, ...keywords) => {
  const key = Object.keys(sections).find(k => keywords.some(kw => k.includes(kw)));
  return key ? sections[key] : '';
};

// ── 1. Skills ─────────────────────────────────────────────────────────────────
const SKILL_KEYWORDS = [
  // Languages
  'JavaScript','TypeScript','Python','Java','C++','C#','C','Go','Golang','Rust',
  'Ruby','PHP','Swift','Kotlin','Scala','R','MATLAB','Bash','Shell','Perl',
  'Objective-C','Dart','Elixir','Haskell','Lua','Groovy','Solidity','Julia',
  'PowerShell','VBA','COBOL','Fortran','Assembly','Nim','Zig','Crystal','F#','Clojure',
  'Erlang','OCaml','PureScript','ReasonML','Racket','Prolog','Ada','D','Tcl',
  // Frontend
  'React','Next.js','Vue.js','Nuxt.js','Angular','Svelte','SvelteKit','jQuery',
  'HTML','HTML5','CSS','CSS3','Tailwind CSS','Bootstrap','Material UI','Chakra UI',
  'SASS','SCSS','Less','Redux','Zustand','MobX','Webpack','Vite','Babel','Storybook',
  'Gatsby','Astro','Remix','Ember.js','Backbone.js','Alpine.js','Lit','Web Components',
  'Three.js','D3.js','Chart.js','Leaflet','Mapbox','WebGL','Canvas API',
  'Radix UI','shadcn/ui','Ant Design','Headless UI','Framer Motion','GSAP',
  'React Query','TanStack Query','SWR','Jotai','Recoil','XState','Zod',
  'React Hook Form','Formik','tRPC','Hono','Elysia',
  // Backend
  'Node.js','Express','NestJS','Fastify','Koa','Django','Flask','FastAPI',
  'Spring Boot','Spring','Hibernate','Laravel','Symfony','Rails','ASP.NET',
  'Gin','Echo','Fiber','Phoenix','Ktor','tRPC','Hapi.js','Strapi','Directus',
  'GraphQL','Apollo Server','Prisma','Drizzle ORM','Sequelize','TypeORM','SQLAlchemy',
  'Bun','Deno','Axum','Actix','Rocket','Warp','Tide','Hyper',
  'gRPC','Protobuf','Thrift','Cap\'n Proto',
  // Mobile
  'React Native','Flutter','SwiftUI','Android','iOS','Xamarin','Ionic',
  'Expo','Capacitor','NativeScript','Jetpack Compose','UIKit','Core Data',
  'ARKit','CoreML','HealthKit','WatchKit','tvOS','macOS',
  // Databases
  'SQL','PostgreSQL','MySQL','SQLite','MariaDB','MongoDB','Redis','Elasticsearch',
  'DynamoDB','Cassandra','CouchDB','Firebase','Supabase','Neo4j','InfluxDB',
  'TimescaleDB','CockroachDB','PlanetScale','Fauna','Appwrite','Realm',
  'Mongoose','Prisma','Sequelize','TypeORM','SQLAlchemy','MSSQL','Oracle','DB2',
  'Memcached','RabbitMQ','Apache Kafka','Kafka','Neon','TiDB','SingleStore',
  'Turso','libSQL','ClickHouse','Redshift','BigQuery','Hive','HBase','Druid',
  // Cloud & DevOps
  'AWS','GCP','Azure','Docker','Kubernetes','Terraform','Ansible','Pulumi',
  'Nginx','Apache','CI/CD','GitHub Actions','Jenkins','CircleCI','GitLab CI',
  'ArgoCD','Helm','Vercel','Netlify','Heroku','Railway','Cloudflare','Linux',
  'AWS Lambda','EC2','S3','RDS','ECS','EKS','CloudFormation','CDK','SAM',
  'Azure DevOps','Azure Functions','Google Cloud Run','Cloud Build','Pub/Sub',
  'Prometheus','Grafana','Datadog','New Relic','Sentry','PagerDuty','ELK Stack',
  'Vault','Consul','Istio','Linkerd','Envoy','Traefik','HAProxy',
  'Fly.io','Render','DigitalOcean','Linode','Vultr','OVH','Hetzner',
  'Cloudflare Workers','AWS CloudFront','Fastly','Akamai',
  'Terraform Cloud','Spacelift','Atlantis','Crossplane','Flux','Kustomize',
  'OpenTelemetry','Jaeger','Zipkin','Loki','VictoriaMetrics','Tempo',
  'Packer','Vagrant','Nomad','Rancher','k3s','kind','minikube',
  // AI / ML / Data
  'Machine Learning','Deep Learning','TensorFlow','PyTorch','Keras','Scikit-learn',
  'Pandas','NumPy','SciPy','OpenCV','NLTK','SpaCy','Hugging Face','LangChain',
  'OpenAI','Tableau','Power BI','Looker','Apache Spark','Kafka','Airflow',
  'dbt','Snowflake','BigQuery','Databricks','AI','LLM','NLP','Computer Vision',
  'Reinforcement Learning','RAG','Vector Database','Embeddings','Stable Diffusion',
  'Langchain','LlamaIndex','Pinecone','Weaviate','Qdrant','Chroma','FAISS',
  'XGBoost','LightGBM','CatBoost','AutoML','MLflow','Weights & Biases','Kubeflow',
  'Jupyter','Google Colab','Matplotlib','Seaborn','Plotly','Apache Flink',
  'Gemini','Claude','Anthropic','Vertex AI','SageMaker','Azure ML',
  'Transformers','BERT','GPT','T5','LoRA','PEFT','Quantization',
  'CrewAI','AutoGen','LangGraph','Semantic Kernel','Haystack',
  'Ollama','vLLM','llama.cpp','LM Studio','PrivateGPT',
  'Apache Hadoop','Hive','Pig','Sqoop','Flume','Storm','Flink',
  'Pandas AI','PandasAI','Polars','DuckDB','Arrow','Parquet',
  // APIs & Protocols
  'REST','REST API','GraphQL','gRPC','WebSockets','OAuth','OAuth2','JWT',
  'OpenAPI','Swagger','Postman','API Gateway','Webhooks','SSE','MQTT','AMQP',
  'SOAP','XML','JSON','Protobuf','AsyncAPI','OData',
  // Testing
  'Jest','Vitest','Cypress','Playwright','Selenium','Puppeteer','Mocha',
  'JUnit','pytest','Testing Library','RTL','Jasmine','Karma','Supertest',
  'k6','Locust','JMeter','Gatling','Detox','Appium','XCTest','Espresso',
  'Pact','WireMock','MSW','Faker','Factory Boy','Hypothesis',
  // Security
  'Cybersecurity','Penetration Testing','OWASP','SSL/TLS','HTTPS','Encryption',
  'OAuth2','SAML','SSO','IAM','RBAC','CSRF','XSS','SQL Injection','Burp Suite',
  'Nmap','Wireshark','Metasploit','Kali Linux','SOC','SIEM','Zero Trust',
  'PKI','HSM','WAF','DDoS','DAST','SAST','SCA','Snyk','Checkmarx','Veracode',
  'HashiCorp Vault','AWS KMS','Azure Key Vault','Secrets Manager',
  // Tools & Practices
  'Git','GitHub','GitLab','Bitbucket','Jira','Confluence','Figma','Sketch',
  'Adobe XD','Agile','Scrum','Kanban','TDD','BDD','DDD','Microservices','Serverless',
  'System Design','Design Patterns','SOLID','Clean Architecture','Event Sourcing','CQRS',
  'WebAssembly','PWA','SPA','SSR','SSG','ISR','Edge Computing','CDN',
  'Nx','Turborepo','Lerna','pnpm','yarn','npm','Makefile','Bash scripting',
  'Notion','Slack','Linear','Asana','Trello','Monday.com','ClickUp',
  'Miro','Lucidchart','draw.io','Excalidraw',
  'Husky','ESLint','Prettier','Biome','Oxlint','Rome','SonarQube','SonarCloud',
  // Business / Soft
  'Project Management','Leadership','Communication','Team Management','Excel',
  'Google Sheets','Salesforce','HubSpot','SEO','SEM','Google Analytics','GA4',
  'Marketing','Finance','Accounting','Photoshop','Illustrator','InDesign',
  'UI/UX','User Research','Wireframing','Prototyping','A/B Testing','Analytics',
  'Business Analysis','Data Analysis','Product Management','Stakeholder Management',
  'Technical Writing','Documentation','Mentoring','Code Review','Architecture',
  'CRM','ERP','SAP','Zoho','Zendesk','Freshdesk','Intercom',
  'Microsoft Office','Word','PowerPoint','SharePoint','Teams',
];

function parseSkills(text, sections) {
  // Search skills section first (more precise), then fall back to full text
  const skillsSectionText = getSection(sections, 'skill', 'competenc', 'expertise', 'technolog');
  const searchIn = skillsSectionText.length > 20 ? skillsSectionText + '\n' + text : text;
  return [...new Set(
    SKILL_KEYWORDS.filter(skill =>
      new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(searchIn)
    )
  )];
}

// ── 2. Expected salary ────────────────────────────────────────────────────────
function parseExpectedSalary(text) {
  const patterns = [
    // Explicit label patterns (highest confidence)
    /(?:expected|desired|target|current|ctc|package|offered)\s*(?:salary|ctc|compensation|pay|remuneration)[:\s]*([^\n]{3,60})/i,
    /salary\s*(?:expectation|range|requirement|offered|bracket)[:\s]*([^\n]{3,60})/i,
    /(?:annual|yearly)\s*(?:salary|compensation|ctc|package)[:\s]*([^\n]{3,60})/i,
    /(?:total|fixed|gross|net|in.?hand)\s*(?:ctc|compensation|remuneration|salary)[:\s]*([^\n]{3,60})/i,
    /(?:drawing|drawn|earning|earnings?)[:\s]+(?:INR|₹|Rs\.?|USD|\$)?\s*([^\n]{3,50})/i,
    /(?:package|remuneration)\s*(?:of|:)\s*([^\n]{3,50})/i,
    /(?:current|last)\s*(?:drawn|earned?)\s*(?:salary|ctc|package|compensation)[:\s]*([^\n]{3,60})/i,
    // Indian formats: 8 LPA, 8.5 lakhs p.a., CTC 12L, ₹6,00,000
    /[₹]\s*([\d,]+(?:\.\d+)?)\s*(?:lpa|lakhs?|lac\b|lacs?)?/i,
    /([\d.]+)\s*(?:lpa|lakhs?\s*(?:per\s*annum)?|lac(?:s)?\s*(?:pa)?)/i,
    /ctc[:\s]*(?:INR|₹|Rs\.?)?\s*([\d,]+(?:\.\d+)?)/i,
    /(?:INR|Rs\.?)\s*([\d,]+(?:\.\d+)?)\s*(?:lpa|lakhs?|lac\b)?/i,
    // USD/GBP/EUR/AUD/CAD/SGD formats: $80k, $80,000/yr, €70,000 p.a.
    /[$£€]\s*([\d,]+(?:\.\d+)?[kK]?)\s*(?:\/|per)?\s*(?:year|yr|annum|pa|month|mo)?/,
    /([\d,]+(?:\.\d+)?[kK]?)\s*(?:USD|GBP|EUR|AUD|CAD|SGD|AED|NZD)\s*(?:p\.?a\.?|\/yr|\/year)?/i,
    // Standalone salary number with per-year indicators
    /([\d,]{5,10})\s*(?:per\s*(?:year|annum)|p\.?a\.?|\/yr|\/year)/i,
    // Range: "80k - 100k" → extract lower bound
    /([\d,]+[kK]?)\s*[-–to]+\s*[\d,]+[kK]?\s*(?:USD|GBP|EUR|AUD|CAD|SGD|per\s*(?:year|annum)|p\.?a\.?)?/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (!m) continue;
    const raw = (m[1] || m[0]).replace(/,/g, '').trim();
    // Skip if capture looks like a full sentence rather than a number
    if (raw.length > 20) continue;
    // Convert LPA/lakhs to full number: 8.5 LPA → 850000
    if (/lpa|lakh|lac/i.test(m[0])) {
      const n = parseFloat(raw);
      if (!isNaN(n) && n > 0 && n < 10000) return String(Math.round(n * 100000));
    }
    // Convert k-suffix: 80k → 80000
    if (/k$/i.test(raw)) {
      const n = parseInt(raw);
      if (!isNaN(n) && n > 0) return String(n * 1000);
    }
    const clean = raw.replace(/[^0-9.]/g, '');
    const n = parseFloat(clean);
    // Sanity check: reject implausibly small or huge values
    if (!isNaN(n) && n >= 100 && n <= 99999999) return String(Math.round(n));
  }
  return null;
}

// ── 3. Social / portfolio links ───────────────────────────────────────────────
function parseSocialLinks(text) {
  // Search header area first (most links appear there), then full text
  const searchText = text.slice(0, 4000);

  // LinkedIn — handle /in/, /pub/, trailing slash, www prefix, bare username label
  const liMatch = searchText.match(
    /linkedin\.com\/(?:in|pub)\/([\w\-_%]{3,60})\/?/i
  ) || searchText.match(
    /linkedin[:\s]+(?:https?:\/\/(?:www\.)?linkedin\.com\/in\/)?([\w\-]{3,60})/i
  );

  // GitHub — handle github.com/user and "github: username", exclude non-profile paths
  const ghMatch = searchText.match(
    /github\.com\/([\w\-_%]{2,40})(?!\/(?:issues|pull|blob|tree|commit|releases|actions|wiki|projects|discussions|marketplace|settings|orgs))\/?/i
  ) || searchText.match(
    /(?:github|gh)[:\s]+(?:https?:\/\/(?:www\.)?github\.com\/)?([\w\-]{2,40})/i
  );

  // Known social/email platforms to exclude from portfolio detection
  const EXCLUDE = /linkedin|github|twitter|x\.com|facebook|instagram|youtube|gmail|yahoo|outlook|hotmail|leetcode|hackerrank|codechef|stackoverflow|wa\.me|t\.me|telegram|reddit|discord|twitch|tiktok|snapchat|pinterest/i;

  // Portfolio — any HTTPS URL that isn't a known social/email platform
  const allUrls = [...(searchText.matchAll(/https?:\/\/(?:www\.)?([a-zA-Z0-9\-]+\.[a-zA-Z]{2,})(?:\/[^\s,)"'<>]*)?/gi))].map(m => m[0]);
  const portMatch = allUrls.find(url => !EXCLUDE.test(url));

  // Behance / Dribbble / Medium / dev.to as fallback portfolio signals
  const behanceM  = searchText.match(/behance\.net\/([\w\-]{2,40})/i);
  const dribbbleM = searchText.match(/dribbble\.com\/([\w\-]{2,40})/i);
  const mediumM   = searchText.match(/medium\.com\/@?([\w\-]{2,40})/i);
  const devtoM    = searchText.match(/dev\.to\/([\w\-]{2,40})/i);

  const portfolio_url = portMatch
    || (behanceM  ? `https://behance.net/${behanceM[1]}`   : null)
    || (dribbbleM ? `https://dribbble.com/${dribbbleM[1]}` : null)
    || (mediumM   ? `https://medium.com/@${mediumM[1]}`    : null)
    || (devtoM    ? `https://dev.to/${devtoM[1]}`          : null)
    || null;

  return {
    linkedin_url:  liMatch   ? `https://linkedin.com/in/${liMatch[1].replace(/\/+$/, '')}`  : null,
    github_url:    ghMatch   ? `https://github.com/${ghMatch[1].replace(/\/+$/, '')}`       : null,
    portfolio_url,
  };
}

// ── 4. Headline ───────────────────────────────────────────────────────────────
function parseHeadline(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const rolePattern =
    /engineer|developer|designer|manager|analyst|scientist|architect|consultant|director|lead|head of|specialist|coordinator|executive|officer|intern|administrator|strategist|devops|full.?stack|front.?end|back.?end|data|cloud|security|qa|tester|programmer|researcher|recruiter|product|marketing|sales|finance|accountant|lawyer|teacher|professor|nurse|doctor|pharmacist|journalist|editor|content|writer|copywriter|illustrator|photographer|videographer|seo|growth|operations|hr|talent|procurement|supply chain|logistics|project|scrum master|agile coach|software|web|mobile|platform|site reliability|sre|blockchain|embedded|firmware|systems|network|it\s|information technology|machine learning|artificial intelligence|cybersecurity|infosec|penetration|ethical hacker|ui\/ux|ux|ui|game|animation|cfo|cto|ceo|coo|vp\s|vice president|principal|staff|senior|junior|associate|fresher|graduate|trainee|apprentice/i;

  // Check lines 1–15 (skip line 0 = name)
  for (const line of lines.slice(1, 15)) {
    if (line.length < 4 || line.length > 140) continue;
    if (/\d{4}/.test(line)) continue;              // skip years (dates)
    if (/@/.test(line)) continue;                   // skip email lines
    if (/^[+\d\s()\-–|,]+$/.test(line)) continue;  // skip phone-only lines
    if (/^https?:\/\//i.test(line)) continue;       // skip URLs
    if (/^(?:address|location|city|pin|zip)[:\s]/i.test(line)) continue; // skip address labels

    if (rolePattern.test(line)) {
      // Clean up "Title | Company" or "Title @ Company" → keep just the title part
      const cleaned = line.split(/[|@•·–—]/).map(p => p.trim()).filter(Boolean)[0] || line;
      return cleaned.slice(0, 140);
    }
  }
  return null;
}

// ── 5. Experience years ───────────────────────────────────────────────────────
function parseExperienceYears(text, workEntries = []) {
  const patterns = [
    // "5+ years of experience", "5 years professional experience"
    /(\d+(?:\.\d)?)\+?\s*years?\s*(?:of\s*)?(?:professional\s*|industry\s*|total\s*|work\s*|relevant\s*|hands.on\s*|combined\s*)?experience/i,
    // "experience of 5+ years"
    /experience\s*(?:of\s*)?(\d+(?:\.\d)?)\+?\s*years?/i,
    // "5+ yrs exp", "5 yrs of exp"
    /(\d+(?:\.\d)?)\+?\s*yr[s]?\s*(?:of\s*)?exp(?:erience)?/i,
    // "over 5 years", "more than 5 years", "approximately 5 years"
    /(?:over|more than|approximately|around|~|nearly|almost|about)\s*(\d+(?:\.\d)?)\s*years?/i,
    // "5-year career", "5-year experience"
    /(\d+)[-\s]year\s*(?:career|experience|background|track record|industry)/i,
    // "5 years and 3 months" — take the years part
    /(\d+)\s*years?\s*(?:and\s*)?\d+\s*months?/i,
    // "a decade of experience" → 10
    /(?:a|one)\s+decade\s+(?:of\s+)?experience/i,
    // "half a decade" → 5
    /half\s+a\s+decade\s+(?:of\s+)?experience/i,
    // "10 months experience" → convert to decimal year
    /(\d+)\s*months?\s*(?:of\s*)?experience/i,
  ];

  for (let i = 0; i < patterns.length; i++) {
    const m = text.match(patterns[i]);
    if (!m) continue;
    // Decade shortcuts (no capture group)
    if (i === 6) return 10; // "a decade"
    if (i === 7) return 5;  // "half a decade"
    const n = parseFloat(m[1]);
    if (isNaN(n) || n > 60) continue;
    // Last pattern is months — convert
    if (i === patterns.length - 1) return Math.max(1, Math.round(n / 12));
    return Math.round(n);
  }

  // Fallback: calculate from work history dates
  if (workEntries.length > 0) {
    const currentYear = new Date().getFullYear();
    const allYears = workEntries
      .flatMap(e => (e.duration || '').match(/\d{4}/g) || [])
      .map(Number)
      .filter(y => y >= 1980 && y <= currentYear + 1);
    if (allYears.length >= 2) {
      // Also check for "Present" in duration — use current year
      const hasCurrent = workEntries.some(e =>
        /present|current|now|till date|ongoing|date/i.test(e.duration || '')
      );
      const maxYear = hasCurrent ? currentYear : Math.max(...allYears);
      return Math.max(1, maxYear - Math.min(...allYears));
    }
  }
  return null;
}

// ── 6. Desired job title ──────────────────────────────────────────────────────
function parseDesiredJobTitle(text) {
  const patterns = [
    // Explicit preference statements
    /(?:desired|preferred|target|looking for|seeking|open to)\s+(?:a\s+)?(?:job|position|role|work|opportunity|opening)?\s*(?:as\s+a?n?|:|in|of)?\s*([^\n.]{5,80})/i,
    // Objective section
    /(?:job\s*)?objective[:\s]+(?:to\s+(?:work|join|obtain|secure|pursue)\s+(?:as\s+a?n?\s+)?)?([^\n.]{5,80})/i,
    /(?:career\s*)?objective[:\s]+([^\n.]{5,80})/i,
    // "Position sought", "Role sought", "Post applied for"
    /(?:position|role|post|designation)\s*(?:sought|applied for|desired|preferred|applied)[:\s]*([^\n.]{5,80})/i,
    // "Applying for the role of ..."
    /(?:applying|applied)\s+(?:for|to)\s+(?:the\s+)?(?:role|position|post)\s+of\s+([^\n.]{5,80})/i,
    // "I am a ... seeking ..." → capture what they're seeking
    /seeking\s+(?:a\s+)?(?:full.time|part.time|remote\s+)?(?:role|position|opportunity|job)?\s*(?:as\s+a?n?\s+)?([^\n.,]{5,80})/i,
    // Summary line starting with desired role
    /^\s*(?:to\s+)?(?:obtain|secure|find|get)\s+(?:a\s+)?([^\n.]{5,80})\s*(?:role|position|job)/im,
    // "Role: Software Engineer", "Position: Data Analyst"
    /^(?:role|position|designation|title|post)[:\s]+([^\n]{5,80})$/im,
    // "I am a fresher / recent graduate looking for ..."
    /(?:fresher|fresh graduate|recent graduate|entry.level)\s+(?:looking|seeking|searching)\s+(?:for\s+)?(?:a\s+)?(?:role|position|opportunity|job)?\s*(?:as\s+a?n?\s+)?(?:in\s+)?([^\n.,]{5,80})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const result = m[1].trim()
        .replace(/^(a|an|the)\s+/i, '')
        .replace(/\s+(?:role|position|job|opportunity)\.?$/i, '')
        .trim();
      if (result.length >= 3 && result.length <= 120) return result;
    }
  }
  return null;
}

// ── 7. Preferred location ─────────────────────────────────────────────────────
function parsePreferredLocation(text) {
  const explicit = [
    // Explicit preference labels
    /(?:preferred|desired|preferred work|open to|willing to relocate to|open for relocation)\s+(?:location|city|cities|place|region|countries?)?[:\s]*([^\n.]{3,80})/i,
    /(?:location|work)\s*preference[:\s]*([^\n.]{3,80})/i,
    /(?:relocation|relocate)[:\s]*(?:yes|no|open|willing)?[,\s]*(?:to\s+)?([^\n.]{3,80})/i,
    // Work-mode keywords with optional location
    /(?:work\s+mode|work\s+type|job\s+type|work\s+arrangement)[:\s]*([^\n.]{3,60})/i,
    // Pan-India / flexible indicators (India-specific)
    /\b(pan.?india|anywhere in india|all india|any location|any city|flexible location)\b/i,
    // Standalone work mode
    /\b(remote|fully\s+remote|hybrid|on.?site|in.?office|work\s+from\s+home|wfh|flexible|open to relocation)\b/i,
    // "Available in / at / for [location]"
    /available\s+(?:in|at|for|to\s+work\s+in)\s+([^\n.]{3,60})/i,
    // "Based in [location]" — current location is best proxy
    /(?:based|located|residing|living|currently\s+(?:in|at|located|based))\s+(?:in|at)\s+([^\n.,]{3,60})/i,
    // "Current Location: ..."
    /(?:current|present)\s+location[:\s]+([^\n.]{3,60})/i,
    // "Location: Mumbai, India" header field
    /^location[:\s]+([^\n.]{3,60})$/im,
    // "Address: ..." — first part often city
    /^address[:\s]+([^\n.]{3,80})$/im,
  ];

  for (const p of explicit) {
    const m = text.match(p);
    if (m) {
      const result = (m[1] || m[0]).trim();
      if (result.length >= 2) return result.slice(0, 100);
    }
  }

  // Fallback: find "City, Country" or "City, ST" pattern in header (first 30 lines)
  const headerText = text.split('\n').slice(0, 30).join('\n');
  // Expanded to handle "City, State, Country" and abbreviated states
  const cityCountry = headerText.match(
    /\b([A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)*),\s*([A-Z]{2,3}|[A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)*)\b/
  );
  // Also try "City - State" format (common in Indian resumes)
  const cityState = headerText.match(
    /\b([A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)*)\s*[-–]\s*([A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)*)\b/
  );
  return (cityCountry || cityState) ? (cityCountry || cityState)[0] : null;
}

// ── 8. Bio ────────────────────────────────────────────────────────────────────
function parseBio(text, sections) {
  const bioSection = getSection(sections,
    'summary','objective','profile','about','overview','bio','professional summary','career summary'
  );
  if (bioSection.length > 40) return bioSection.replace(/\n/g, ' ').trim().slice(0, 1000);
  // Fallback: first meaty paragraph
  const paras = text.slice(0, 1500).split(/\n{2,}/)
    .map(p => p.replace(/\n/g, ' ').trim())
    .filter(p => p.length > 80 && !/@/.test(p) && !/^http/i.test(p) && !/^\+?\d/.test(p));
  return paras[0] || null;
}

// ── 9. Work experience — company names + titles + durations ───────────────────
function parseWorkExperience(sections) {
  const expText = getSection(sections,
    'experience','employment','work history','professional experience','career history'
  );
  if (!expText) return [];

  const dateRangePattern =
    // Standard: "Jan 2020 - Dec 2022", "2020 - 2023", "Jan 2020 - Present"
    /(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?\d{4}\s*(?:[-–—]|to)\s*(?:(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?\d{4}|(?:present|current|now|till date|ongoing|date|today))|(?:\d{1,2}[\/]\d{4})\s*[-–—to]+\s*(?:\d{1,2}[\/]\d{4}|(?:present|current|now|till date|ongoing))/i;
  const companyIndicators =
    /(?:inc\.?|ltd\.?|llc\.?|pvt\.?|corp\.?|co\.?|group|technologies|solutions|systems|consulting|services|labs|studio|agency|gmbh|s\.?a\.?|b\.?v\.?|plc|pty|limited|enterprises|ventures|holdings|capital|foundation|university|college|institute|hospital|bank|media|digital|software|tech|it\b|innovations?|networks?|global|international|worldwide|asia|india|research|analytics|management|communications?|interactive|creative|design|engineering|development)\b/i;

  const lines = expText.split('\n').map(l => l.trim()).filter(Boolean);
  const entries = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hasDate = dateRangePattern.test(line);
    const nextLine = lines[i + 1] || '';

    if (hasDate || companyIndicators.test(line)) {
      if (current) entries.push(current);
      const parts = line.split(/[|,·•]/).map(p => p.trim()).filter(Boolean);
      const duration = (line.match(dateRangePattern) || [])[0]?.trim() || null;
      const nonDate  = parts.filter(p => !dateRangePattern.test(p));
      let title = null, company = null;

      if (nonDate.length >= 2) {
        title = nonDate[0]; company = nonDate[1];
      } else if (nonDate.length === 1) {
        if (companyIndicators.test(nonDate[0])) {
          company = nonDate[0];
        } else {
          title = nonDate[0];
          if (nextLine && nextLine.length < 80 && !dateRangePattern.test(nextLine) && !/^[•\-*]/.test(nextLine)) {
            company = nextLine; i++;
          }
        }
      }
      current = { title, company, duration, responsibilities: [] };
    } else if (current && /^[•\-*]/.test(line)) {
      current.responsibilities.push(line.replace(/^[•\-*]\s*/, '').trim());
    } else if (current && !current.company && line.length < 100 && !/^[•\-*]/.test(line)) {
      current.company = line;
    }
  }
  if (current) entries.push(current);

  return entries
    .filter(e => e.company || e.title)
    .map(e => ({
      title:            e.title            || null,
      company:          e.company          || null,
      duration:         e.duration         || null,
      responsibilities: e.responsibilities.slice(0, 5),
    }))
    .slice(0, 10);
}

// ── 10. Education — degrees + institutions ────────────────────────────────────
function parseEducation(sections) {
  const eduText = getSection(sections, 'education', 'academic', 'qualifications');
  if (!eduText) return [];

  const degreePattern =
    /\b(bachelor(?:'s)?(?:\s+of\s+\w+(?:\s+\w+)*)?|master(?:'s)?(?:\s+of\s+\w+(?:\s+\w+)*)?|phd|ph\.d\.?|d\.?phil\.?|doctorate|doctor\s+of|b\.?s\.?c?\.?(?:\s*\(hons?\))?|m\.?s\.?c?\.?|m\.?b\.?a\.?|b\.?e\.?(?!\s*years)|b\.?tech\.?|m\.?tech\.?|b\.?a\.?|m\.?a\.?|b\.?com\.?|m\.?com\.?|b\.?c\.?a\.?|m\.?c\.?a\.?|b\.?b\.?a\.?|mbbs|m\.?b\.?b\.?s\.?|bds|b\.?d\.?s\.?|b\.?sc\.?|m\.?sc\.?|llb|ll\.b\.?|llm|ll\.m\.?|j\.?d\.?|m\.?d\.?|b\.?eng\.?|m\.?eng\.?|associate(?:'s)?|diploma|higher\s*national\s*diploma|hnd|hnc|a-levels?|a\s+levels?|high\s*school|secondary\s*school|g\.?c\.?s\.?e\.?|certificate|post[\s-]?graduate\s+diploma|pg\s*diploma|post[\s-]?graduation|intermediate|class\s*(?:x|xii|10|12)|10th|12th)\b/i;
  const universityPattern =
    /\b(?:university|college|institute(?:\s+of)?|school\s+of|academy|polytechnic|iit|nit|iisc|iim|bits|nift|nid|mit|stanford|harvard|oxford|cambridge|caltech|carnegie|georgia\s+tech|eth\s+zurich|imperial|lse)\b/i;

  const lines = eduText.split('\n').map(l => l.trim()).filter(Boolean);
  const entries = [];
  let current = null;

  for (const line of lines) {
    if (degreePattern.test(line)) {
      if (current) entries.push(current);
      current = {
        degree:      line,
        institution: null,
        year:        (line.match(/(?:19|20)\d{2}/) || [])[0] || null,
        gpa:         (line.match(/(?:gpa|cgpa|grade|percentage|marks)[:\s]*([0-9]+\.?[0-9]*\s*(?:\/\s*[0-9]+\.?[0-9]*|%)?)/i) || [])[1]?.trim() || null,
      };
    } else if (current && !current.institution && (universityPattern.test(line) || line.length < 100)) {
      current.institution = line;
      // Also pick up year and GPA from institution line
      if (!current.year) current.year = (line.match(/(?:19|20)\d{2}/) || [])[0] || null;
      const gpaM = line.match(/(?:gpa|cgpa|grade|percentage|marks)[:\s]*([0-9]+\.?[0-9]*\s*(?:\/\s*[0-9]+\.?[0-9]*|%)?)/i);
      if (gpaM && !current.gpa) current.gpa = gpaM[1].trim();
    } else if (!current && universityPattern.test(line)) {
      current = { degree: null, institution: line, year: (line.match(/(?:19|20)\d{2}/) || [])[0] || null, gpa: null };
    }
  }
  if (current) entries.push(current);
  return entries.filter(e => e.degree || e.institution).slice(0, 5);
}

// ── Worker ────────────────────────────────────────────────────────────────────
const worker = new Worker(
  'resume-parsing',
  async (job) => {
    const { user_id, resume_url, filename } = job.data;
    console.log(`\n📄 Processing resume for user ${user_id}`);

    try {
      // ── Step 1: Parse text from file ────────────────────────────────────────
      let text = '';

      if (resume_url && !resume_url.includes('mock')) {
        const buffer = await fetchBuffer(resume_url);

        if (filename?.toLowerCase().endsWith('.pdf')) {
          try {
            const pdfParse = (await import('pdf-parse')).default;
            const parsed = await pdfParse(buffer);
            text = parsed.text;
          } catch (e) {
            console.warn('  PDF parse error, falling back to raw text:', e.message);
            text = buffer.toString('utf-8', 0, 15000);
          }
        } else if (filename?.toLowerCase().endsWith('.docx')) {
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ buffer });
          text = result.value;
        }
      }

      if (!text || text.length < 50) {
        console.warn(`  Resume text too short (${text.length} chars), skipping`);
        return { status: 'skipped', reason: 'insufficient_text' };
      }

      console.log(`  Extracted ${text.length} chars from resume`);

      // ── Step 2: Extract structured data ─────────────────────────────────────
      // Try Gemini first. If it fails (no key, rate limit, network), fall back to regex.
      let geminiResult = null;
      try {
        console.log('  🤖 Attempting Gemini parsing…');
        geminiResult = sanitiseGeminiOutput(await parseWithGemini(text));
        console.log(`  ✅ Gemini parsed: ${geminiResult.skills.length} skills, ${geminiResult.experience?.length ?? 0} jobs`);
      } catch (geminiErr) {
        console.warn(`  ⚠️  Gemini failed (${geminiErr.message}) — falling back to regex parser`);
      }

      // Regex fallback — runs only if Gemini failed, uses same DB field names
      const sections          = splitIntoSections(text);
      const workEntriesRaw    = parseWorkExperience(sections);
      const skills            = geminiResult?.skills?.length       ? geminiResult.skills       : parseSkills(text, sections);
      const expectedSalary    = geminiResult?.desired_salary       ?? parseExpectedSalary(text);
      const linkedin_url      = geminiResult?.linkedin_url         ?? parseSocialLinks(text).linkedin_url;
      const github_url        = geminiResult?.github_url           ?? parseSocialLinks(text).github_url;
      const portfolio_url     = geminiResult?.portfolio_url        ?? parseSocialLinks(text).portfolio_url;
      const headline          = geminiResult?.headline             ?? parseHeadline(text);
      const experienceYears   = geminiResult?.experience_years     ?? parseExperienceYears(text, workEntriesRaw);
      // If no explicit desired job title found, fall back to the current headline/job title
      const desiredJobTitle   = geminiResult?.desired_job_title    ?? parseDesiredJobTitle(text) ?? headline;
      const preferredLocation = geminiResult?.preferred_location   ?? parsePreferredLocation(text);
      const bio               = geminiResult?.bio                  ?? parseBio(text, sections);
      const educationEntries  = geminiResult?.education?.length    ? geminiResult.education    : parseEducation(sections);
      const workEntries       = geminiResult?.experience?.length   ? geminiResult.experience   : workEntriesRaw;
      // New fields — Gemini primary, regex fallback for phone + salary
      // Normalise any date format Gemini returns → ISO YYYY-MM-DD for Postgres DATE column
      const normaliseDOB = (raw) => {
        if (!raw) return null;
        const s = String(raw).trim();
        // Already ISO: YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY (most common non-ISO from Gemini & Indian formats)
        const dmyDash = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
        if (dmyDash) return `${dmyDash[3]}-${dmyDash[2].padStart(2,'0')}-${dmyDash[1].padStart(2,'0')}`;
        // YYYY/MM/DD or YYYY.MM.DD
        const ymd = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
        if (ymd) return `${ymd[1]}-${ymd[2].padStart(2,'0')}-${ymd[3].padStart(2,'0')}`;
        // DD Month YYYY  e.g. "15 August 1998", "15th August 1998"
        const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
        const wordy  = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})$/);
        if (wordy) {
          const mo = months[wordy[2].slice(0,3).toLowerCase()];
          if (mo) return `${wordy[3]}-${String(mo).padStart(2,'0')}-${wordy[1].padStart(2,'0')}`;
        }
        // Month DD YYYY  e.g. "August 15, 1998", "August 15th 1998"
        const wordy2 = s.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
        if (wordy2) {
          const mo = months[wordy2[1].slice(0,3).toLowerCase()];
          if (mo) return `${wordy2[3]}-${String(mo).padStart(2,'0')}-${wordy2[2].padStart(2,'0')}`;
        }
        // "15-Aug-1998" or "15-Aug-98"
        const shortMonth = s.match(/^(\d{1,2})[-\/\s]([A-Za-z]{3})[-\/\s](\d{2}|\d{4})$/);
        if (shortMonth) {
          const mo = months[shortMonth[2].slice(0,3).toLowerCase()];
          const yr = shortMonth[3].length === 2
            ? (parseInt(shortMonth[3]) > 30 ? `19${shortMonth[3]}` : `20${shortMonth[3]}`)
            : shortMonth[3];
          if (mo) return `${yr}-${String(mo).padStart(2,'0')}-${shortMonth[1].padStart(2,'0')}`;
        }
        // Last resort — let JS parse it and reformat
        const d = new Date(s);
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
        return null; // unparseable — don't crash Postgres
      };

      const date_of_birth = normaliseDOB(geminiResult?.date_of_birth);
      const gender            = geminiResult?.gender            || null;
      const lives_in          = geminiResult?.lives_in          || null;

      // Phone — regex fallback covers international formats
      const phone_number = geminiResult?.phone_number || (() => {
        // 1. Labeled: "Phone:", "Mobile:", "Tel:", "Cell:", "Contact:", "Mob:", "Ph."
        const labeled = text.match(
          /(?:phone|mobile|mob\.?|cell|contact|ph\.?|tel\.?|whatsapp|call|reach\s+(?:me\s+)?(?:at|on))[.:\s#]*([+]?[\d][\d\s()\-–.]{7,17}[\d])/i
        );
        if (labeled) {
          const digits = labeled[1].replace(/[^\d+]/g, '');
          if (digits.length >= 7 && digits.length <= 15) return digits;
        }
        // 2. Indian 10-digit (with or without +91/0): 9876543210, +91-9876543210, 09876543210
        const indian = text.match(/(?<![.\d])(\+?91[-.\s]?|0)?([6-9]\d{9})(?![\d])/);
        if (indian) {
          const prefix = indian[1] ? indian[1].replace(/[^\d+]/g, '') : '';
          return (prefix === '91' || prefix === '+91' ? '+91' : '') + indian[2];
        }
        // 3. US/CA: (555) 123-4567, 555-123-4567, 555.123.4567
        const us = text.match(/(?<![.\d])\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?![\d])/);
        if (us) return us[0].replace(/[^\d+]/g, '');
        // 4. Generic international with country code: +44 7911 123456, +1-800-555-0100
        const intl = text.match(/(?<![.\d])(\+\d{1,3}[-.\s]?\(?\d{2,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{4})(?![\d])/);
        if (intl) {
          const digits = intl[1].replace(/[^\d+]/g, '');
          if (digits.length >= 8 && digits.length <= 15) return intl[1].trim();
        }
        return null;
      })();

      // Salary — extended regex for Indian (LPA/lakhs/CTC) + international formats
      const extractedSalary = geminiResult?.desired_salary ?? (() => {
        const patterns = [
          // Indian formats: 8 LPA, 8.5 lakhs, CTC: 10L, ₹12,00,000
          /(?:ctc|package|salary|compensation|pay|remuneration)[:\s]*(?:INR|₹|Rs\.?)?[\s]?([\d,.]+)\s*(?:l(?:pa|akhs?)|lakh)/i,
          /([\d,.]+)\s*(?:l(?:pa|akhs?)|lakh)/i,
          /(?:INR|₹|Rs\.?)\s*([\d,]+(?:\.\d+)?)[\s]*(?:(?:per|p\.)\s*(?:annum|year|yr|pa))?/i,
          // USD/GBP/EUR/AUD/CAD/SGD formats
          /(?:expected|desired|target|current)?\s*(?:salary|ctc|compensation)[:\s]*\$?([\d,]+(?:k|000)?)/i,
          /[$£€]\s*([\d,]+(?:\.\d+)?[kK]?)\s*(?:\/|per)?\s*(?:year|yr|annum|pa)?/i,
          /([\d,]+(?:\.\d+)?[kK]?)\s*(?:USD|GBP|EUR|AUD|CAD|SGD|AED)\s*(?:p\.?a\.?|\/yr|\/year)?/i,
          // Standalone with per-year indicator
          /([\d,]{5,10})\s*(?:per\s*(?:year|annum)|p\.?a\.?|\/yr|\/year)/i,
        ];
        for (const re of patterns) {
          const m = text.match(re);
          if (m) {
            let raw = m[1].replace(/,/g, '');
            if (raw.length > 15) continue; // skip sentence-length captures
            // Convert "8.5 LPA" → 850000, "80k" → 80000
            if (/l(?:pa|akhs?)|lakh/i.test(m[0])) {
              const n = parseFloat(raw);
              if (!isNaN(n) && n > 0 && n < 10000) return String(Math.round(n * 100000));
            }
            if (/k$/i.test(raw)) {
              const n = parseInt(raw);
              if (!isNaN(n) && n > 0) return String(n * 1000);
            }
            const n = parseFloat(raw);
            if (!isNaN(n) && n >= 100 && n <= 99999999) return String(Math.round(n));
          }
        }
        return null;
      })();

      const usedGemini = geminiResult !== null;
      console.log(`  Parser: ${usedGemini ? 'Gemini ✨' : 'Regex fallback'} | Skills: ${skills.length} | Exp: ${experienceYears ?? 'n/a'} yrs | Jobs: ${workEntries.length} | Education: ${educationEntries.length}`);

      // ── Step 3: Save parsed data to DB ──────────────────────────────────────
      const updates = {
        resume_parsed:       true,
        resume_parsed_at:    new Date().toISOString(),
        resume_parse_failed: false,   // clear any failure flag from a previous attempt
        // Core fields
        ...(skills.length > 0            && { skills }),
        ...((extractedSalary || expectedSalary) && { desired_salary: String(extractedSalary || expectedSalary) }),
        ...(linkedin_url                 && { linkedin_url }),
        ...(github_url                   && { github_url }),
        ...(portfolio_url                && { portfolio_url }),
        ...(headline                     && { headline }),
        ...(experienceYears              && { experience_years: experienceYears }),
        ...(desiredJobTitle              && { desired_job_title: desiredJobTitle }),
        ...(preferredLocation            && { preferred_location: preferredLocation }),
        ...(bio                          && { bio }),
        // Serialise arrays to clean human-readable text before saving to TEXT columns.
        // This prevents raw JSON strings from polluting the embedding later.
        ...(workEntries.length > 0 && {
          experience: workEntries.map(e => {
            const duration = e.duration || [e.startDate, e.endDate].filter(Boolean).join(' – ');
            const header   = [e.title, e.company && `@ ${e.company}`, duration].filter(Boolean).join(' ');
            const bullets  = (e.responsibilities || []).filter(Boolean);
            return bullets.length ? `${header}\n${bullets.map(r => `  • ${r}`).join('\n')}` : header;
          }).join('\n\n'),
        }),
        ...(educationEntries.length > 0 && {
          education: educationEntries.map(e =>
            [e.degree, e.field, e.institution, e.year || e.graduationYear].filter(Boolean).join(', ')
          ).join('\n'),
        }),
        // New fields (Gemini-only)
        ...(date_of_birth                && { date_of_birth }),
        ...(gender                       && { gender }),
        ...(phone_number                 && { phone_number }),
        ...(lives_in                     && { lives_in }),
        ...(geminiResult?.preferred_job_type  && { preferred_job_type: geminiResult.preferred_job_type }),
        ...(geminiResult?.preferred_category  && { preferred_category: geminiResult.preferred_category }),
      };

      const { data: updatedProfile, error: updateErr } = await supabase
        .from('candidate_profiles')
        .update(updates)
        .eq('user_id', user_id)
        .select('*')
        .single();

      if (updateErr) throw updateErr;

      console.log(`✅ Resume fully processed for user ${user_id}`);

      // ── Step 4: Generate embedding + run vector matching ────────────────────
      // Run in a separate try/catch so a failed embedding NEVER rolls back
      // the successful parse above. resume_parsed stays true regardless.
      try {
        console.log('  🧠 Generating AI embedding …');
        await triggerCandidateMatchOnResume(user_id, updatedProfile);
        console.log('  ✅ Embedding + matching complete');
      } catch (embedErr) {
        // Log but don't rethrow — parsing succeeded, embedding is best-effort
        console.error('  ⚠️ Embedding failed (non-fatal):', embedErr.message);
      }

      return { status: 'success', skillsCount: skills.length };

    } catch (err) {
      console.error(`❌ Resume processing failed for ${user_id}:`, err.message);

      try {
        const { data: current } = await supabase
          .from('candidate_profiles')
          .select('resume_parsed, resume_parse_attempts')
          .eq('user_id', user_id)
          .single();

        if (!current?.resume_parsed) {
          // Mark as failed in DB — frontend polls this to stop spinning
          await supabase
            .from('candidate_profiles')
            .update({
              resume_parsed:         false,
              resume_parse_failed:   true,
              resume_parse_attempts: (current?.resume_parse_attempts ?? 0) + 1,
            })
            .eq('user_id', user_id);
        }
      } catch {
        // ignore cleanup errors
      }

      throw err; // BullMQ will mark job as failed (and retry if attempts remain)
    }
  },
  {
    connection: redis,
    concurrency: 2,           // limit parallel jobs — embedding is CPU-heavy
    limiter: { max: 5, duration: 60_000 }, // max 5 per minute
  }
);

worker.on('completed', (job) =>
  console.log(`✅ BullMQ job ${job.id} completed`)
);
worker.on('failed', (job, err) =>
  console.error(`❌ BullMQ job ${job?.id} failed:`, err.message)
);
worker.on('error', (err) =>
  console.error('Worker error:', err.message)
);

console.log('🚀 Resume worker started (with AI embedding)');
export default worker;