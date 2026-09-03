# Learning Compass

**Learning Compass** is an AI-powered diagnostic learning platform designed to identify conceptual weaknesses, diagnose student misconceptions, ground assessment generation in teacher materials via RAG, and generate personalized learning pathways to achieve targeted mastery.

---

## 👥 Core User Roles
- **Teacher**: Creates course structures, uploads learning materials (PDF, DOCX, PPTX, scanned images), manages AI-generated assessments grounded in course content, and reviews class diagnostics.
- **Student**: Completes diagnostic assessments, receives multi-dimensional feedback, reviews diagnostic reports, follows personalized learning paths, and takes targeted reassessments.
- **Admin**: Manages user accounts, platform configurations, system logs, and infrastructure parameters.

---

## 🔄 Core Product Flow

```
[Teacher] 
   │
   ├─► 1. Creates Course & Topics
   ├─► 2. Uploads Learning Material (PDF, DOCX, PPTX, Images)
   │     │
   │     ▼ (Async Pipeline)
   │     [Storage Service] ──► [Document Ingestion Service]
   │                             │ (Text Extraction / Conditional OCR)
   │                             ▼
   │                         [Chunking & Cleaning Service]
   │                             │
   │                             ▼
   │                         [Embedding Service] ──► [MongoDB Atlas Vector Search]
   │
   └─► 3. Generates Grounded Assessment
         │ (Topic + Requirements + RAG Vector Search Context + Instructions)
         ▼
[Student]
   │
   ├─► 4. Takes Assessment & Submits Responses
   │     │
   │     ▼
   │  [Evaluation Service] ──► Evaluates per response (Correctness, Concepts, Misconceptions, Fluency, Evidence)
   │     │
   │     ▼
   │  [Diagnostic Engine]  ──► Aggregates findings ➔ Diagnostic Report (Strengths, Weaknesses, Evidence)
   │     │
   │     ▼
   │  [Learning Path Service] ──► Generates Remedial Path (Explanation ➔ Practice ➔ Checkpoints)
   │
   ├─► 5. Completes Remedial Practice
   │
   └─► 6. Takes Targeted Reassessment ──► [Closed Feedback Loop] ──► New Diagnosis & Measured Progress
```

> **Priority Note**: The v1 MVP prioritizes executing this complete, closed-loop diagnostic feedback cycle (Upload Material ➔ Vector Embeddings ➔ RAG Assessment ➔ Response Evaluation ➔ Diagnosis ➔ Learning Path ➔ Reassessment).

---

## 🛠️ Technology Constraints & Stack

| Layer | Specification |
| :--- | :--- |
| **Language** | Pure JavaScript (ES Modules strictly, no TypeScript) |
| **Frontend** | React + Vite + JavaScript (Single Page Application) |
| **Backend** | Node.js + Express + JavaScript (REST API) |
| **Database** | MongoDB Atlas (Persistence & Vector Search) |
| **Vector Search** | MongoDB Atlas Vector Search (Integrated vector similarity search) |
| **File Storage** | Supabase Storage via S3-compatible API (Object Storage for materials) |
| **AI Integration** | Provider-independent AI Service Layer (LLM, Embedding, and OCR adapters) |
| **Deployment** | Production-ready deployment setup with strict environment separation |

---

## 🎯 MVP Scope & Focus
- **Phase 1 Focus**: Complete execution of the core diagnostic loop (Course Setup ➔ Material Vector Processing ➔ RAG Assessment Generation ➔ Multi-Dimensional Evaluation ➔ Diagnostic Report ➔ Personalized Learning Path ➔ Targeted Reassessment).
- **Architecture Integrity**: Strict separation of concerns (Controllers, Services, Routes, Models, Middleware, Utils) with isolated abstractions for AI completion, embedding generation, OCR processing, and vector search.

