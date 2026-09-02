# Learning Compass — Production Deployment & Infrastructure Specifications

This document outlines the deployment architecture, service boundaries, environment configurations, and security requirements for **Learning Compass**.

---

## 1. System Communication Flow

### Development Environment Architecture Flow
```
[Frontend (Vite Dev Server: 5173)]
   │
   ▼ (HTTP / API Calls)
[Backend (Express Node Server: 5000)]
   │
   ├─► [MongoDB Atlas (or Local In-Memory Fallback)]
   └─► [Local Disk File Storage (server/uploads/)]
```

### Production Environment Architecture Flow
```
[Frontend Hosting (Vercel / Netlify / CDN)]
   │
   ▼ (HTTPS API Requests)
[Backend Hosting (Render / AWS ECS Container)]
   │
   ├──► [MongoDB Atlas (Managed Database & Vector Search Index)] (External Service)
   ├──► [Object Storage (AWS S3 / Cloudflare R2)]               (External Service)
   ├──► [AI Provider (OpenAI / Pluggable LLM)]                  (External Service)
   ├──► [Embedding Provider (OpenAI Vector Embeddings)]          (External Service)
   └──► [OCR Provider (Vision OCR Engine)]                      (External Service)
```

---

## 2. Infrastructure & Service Classifications

| Service Component | Environment | Service Category | Hosting / Provider |
| :--- | :--- | :--- | :--- |
| **Frontend SPA** | Production | Web Application | Vercel / Netlify / AWS CloudFront |
| **Backend API** | Production | Application Server | Render / AWS ECS / DigitalOcean |
| **Database & Vector Search** | Production | External Managed DB | MongoDB Atlas (M10+ Replica Set) |
| **Object File Storage** | Production | External Storage | AWS S3 / Cloudflare R2 |
| **AI LLM Engine** | Production | External API | OpenAI API (`gpt-4o-mini`) / Pluggable |
| **Embedding Engine** | Production | External API | OpenAI API (`text-embedding-3-small`) |
| **OCR Vision Engine** | Production | External API | OpenAI Vision API / Tesseract OCR |

---

## 3. Environment Variables & Secret Classification

> ⚠️ **CRITICAL SECURITY RULE**: Secrets (Database Credentials, JWT Keys, AWS Keys, AI API Keys) MUST ONLY reside on the **Backend Application Server**. They MUST NEVER be committed to source control or exposed to the client bundle.

### A. Backend Required Environment Variables (`server/.env`)

| Variable Name | Required in Prod? | Secret? | Belongs to | Description / Sample Value |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | **REQUIRED** | No | Backend | `production` \| `development` |
| `PORT` | Optional | No | Backend | HTTP Port (Default: `5000`) |
| `MONGODB_URI` | **REQUIRED** | **SECRET** | Backend | MongoDB Atlas Connection String (`mongodb+srv://...`) |
| `JWT_SECRET` | **REQUIRED** | **SECRET** | Backend | Secret string (Min 32 characters in production) |
| `JWT_EXPIRES_IN` | Optional | No | Backend | Token expiration duration (Default: `7d`) |
| `FRONTEND_URL` / `CLIENT_URL` | **REQUIRED** | No | Backend | Allowed CORS origins (`https://app.learningcompass.com`) |
| `STORAGE_PROVIDER` | Optional | No | Backend | Storage adapter (`local` \| `s3`) |
| `AWS_S3_BUCKET_NAME` | Required if s3 | No | Backend | Target S3 bucket name |
| `AWS_ACCESS_KEY_ID` | Required if s3 | **SECRET** | Backend | AWS IAM access key ID |
| `AWS_SECRET_ACCESS_KEY` | Required if s3 | **SECRET** | Backend | AWS IAM secret access key |
| `AWS_REGION` | Required if s3 | No | Backend | AWS S3 region (Default: `us-east-1`) |
| `LLM_PROVIDER` | Optional | No | Backend | LLM provider adapter (`local` \| `openai`) |
| `OPENAI_API_KEY` | Required if openai | **SECRET** | Backend | OpenAI Developer API Key (`sk-proj-...`) |
| `LLM_MODEL` | Optional | No | Backend | Model name (`gpt-4o-mini`) |
| `EMBEDDING_PROVIDER` | Optional | No | Backend | Embedding provider (`local` \| `openai`) |
| `EMBEDDING_MODEL` | Optional | No | Backend | Embedding model name (`text-embedding-3-small`) |
| `EMBEDDING_DIMENSIONS` | Optional | No | Backend | Vector length (`1536`) |
| `OCR_PROVIDER` | Optional | No | Backend | OCR vision provider (`local` \| `openai`) |
| `OCR_MODEL` | Optional | No | Backend | Vision model name (`gpt-4o-mini`) |
| `VECTOR_INDEX_NAME` | Optional | No | Backend | MongoDB Atlas vector index name (`document_chunks_vector_index`) |
| `VECTOR_SEARCH_PATH` | Optional | No | Backend | Vector field path (`embedding`) |

### B. Frontend Environment Variables (`client/.env`)

| Variable Name | Required in Prod? | Secret? | Belongs to | Description / Sample Value |
| :--- | :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | **REQUIRED** | No | Frontend | Backend API base endpoint (`https://api.learningcompass.com/api/v1`) |

---

## 4. Production Storage Configuration

In production (`STORAGE_PROVIDER=s3`), learning materials are stored in AWS S3 or Cloudflare R2 object storage:
- Files uploaded by teachers are saved to S3 bucket keys: `materials/<teacherId>/<filename>`.
- The storage abstraction in `server/src/services/storage/storageService.js` routes all calls through `S3StorageProvider` without altering document extraction, chunking, or embedding business logic.
- Upload size is enforced by `MAX_FILE_SIZE_MB=10`.
- Private access is secured via backend-authenticated stream proxying or short-lived presigned URLs.

---

## 5. Security & Pre-Deployment Checklist

1. **Environment Validation**: Server validates environment variables on boot via `validateEnv()` in `server/src/config/env.config.js` and fails fast if production secrets are missing.
2. **CORS Restrictions**: `app.use(cors(corsOptions))` strictly locks origins to `FRONTEND_URL` in production mode.
3. **Atlas Production Safety**: Database connection uses connection pooling (`maxPoolSize: 50`) and disables in-memory database fallback when `NODE_ENV === 'production'`.
4. **Git Security**: `.env` files and `uploads/` are strictly ignored by `.gitignore`.
