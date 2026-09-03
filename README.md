# Learning Compass 🧭
### AI-Powered Diagnostic Learning Platform

Learning Compass helps identify **what students understand, where they struggle, and what they should learn next** — turning assessment into a continuous feedback loop:

**Learning Material → AI Assessment → Student Response → Diagnostic Analysis → Personalized Learning → Reassessment → Improvement Analysis**

---

## 🚀 Live Demo
**[Launch Learning Compass](https://learning-compass-1.onrender.com)**

> Deployed using Render, MongoDB Atlas, Supabase Storage, and Google Gemini.

---

## 🎯 The Problem
Most learning platforms deliver content, generate quizzes, and track scores — but a score doesn't explain **why** a student is struggling. They might lack conceptual understanding, make a procedural mistake, fail to apply a concept to a new problem, hold a misconception, or simply need more practice. Learning Compass focuses on the *reason* behind performance, not just the result.

## 💡 The Solution
Teachers upload learning material, which grounds AI-generated assessments. After a student completes one, the system diagnoses gaps and misconceptions, builds a personalized learning path, and generates targeted reassessments to measure real improvement.

```
Learning Material → Document Processing → RAG Retrieval → AI Assessment
      → Student Attempt → Diagnostic Analysis → Personalized Learning Path
      → Reassessment → Improvement Analysis → (loop continues)
```

---

## ✨ Key Features

**Teachers** can create courses/topics, upload learning materials (PDFs), generate grounded assessments via RAG, and review diagnostic reports on student strengths, weaknesses, and patterns.

**Students** complete AI-generated assessments, receive diagnostic feedback, get a personalized learning path, take targeted reassessments, and see concept-level improvement comparisons.

**RAG Pipeline:** PDF → Extraction/OCR → Chunking → Embeddings → Vector Search → Topic/Material Filtering → Gemini AI → Structured Assessment. Retrieval is scoped by teacher, course, topic, and material, so unrelated content never leaks into generation.

---

## 🤖 AI & Reliability
Google Gemini powers assessment generation, diagnostics, learning-path generation, improvement analysis, and OCR — all validated as structured outputs. The pipeline includes timeout protection, retry with backoff, model fallback, error classification, correlation IDs, and observability (latency, token usage, cost, error category).

## 🏗️ Architecture
```
React Client → REST API → Node.js + Express
                              │
                 ┌────────────┼────────────┐
             MongoDB Atlas  Supabase    Gemini AI
             (data+vectors)  Storage   (gen/analysis/OCR)
```

## 🛠️ Tech Stack
- **Frontend:** React, Vite, JavaScript, CSS
- **Backend:** Node.js, Express, Mongoose
- **Database:** MongoDB Atlas + Vector Search
- **AI:** Google Gemini, RAG, Embeddings
- **Storage:** Supabase Storage (S3-compatible)
- **Deployment:** Render, MongoDB Atlas, Supabase

## 🔐 Security
JWT authentication, role-based authorization, teacher/student data isolation, tenant-aware queries, input & file-upload validation, CORS, security headers, and environment-based secret management.

## 🧪 Testing
Automated tests cover auth, course/topic CRUD, the full assessment lifecycle, diagnostics, learning paths, reassessments, RAG topic isolation, OCR integrity, and AI reliability.

---

## 🚀 Getting Started

**Prerequisites:** Node.js 18+, npm, MongoDB Atlas, Google Gemini API key, Supabase project with storage bucket.

```bash
git clone https://github.com/Ishwar-Gaikwad/learning-compass.git
cd learning-compass

# Backend
cd server
npm install
# create server/.env from server/.env.example, then:
npm run dev   # runs on http://localhost:5000

# Frontend (in a new terminal)
cd client
npm install
# create client/.env with VITE_API_BASE_URL=http://localhost:5000/api/v1
npm run dev   # runs on http://localhost:5173
```

Key environment variables: `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `STORAGE_PROVIDER`, `AWS_S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_ENDPOINT`. Never commit real credentials.

---

## ☁️ Deployment
GitHub → Render (Frontend as Static Site, Backend as Web Service) → MongoDB Atlas + Supabase Storage + Gemini AI.

## 📚 Documentation
See `docs/` for architecture, AI pipeline, API, database, and deployment details.

## 🔮 Future Improvements
Richer multimodal material support, additional question types, improved misconception classification, granular mastery tracking, teacher cohort analytics, and multi-provider AI routing.

## 🏆 Highlights
Learning Compass demonstrates a full-stack, production-minded implementation of RAG, vector search, adaptive learning, document processing/OCR, multi-tenant auth, and AI observability — going beyond a simple LLM wrapper to build a complete **Grounded Generation → Diagnosis → Personalization → Reassessment → Improvement** loop.

---

## 👤 Author
**Ishwar Gaikwad** — [GitHub](https://github.com/Ishwar-Gaikwad)

## 📄 License
This project is currently presented as a portfolio and educational project.