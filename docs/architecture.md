# Learning Compass — System Architecture

This document details the software architecture, design patterns, data flows, service boundaries, security models, and performance strategies for **Learning Compass**, an AI-powered diagnostic learning platform.

---

## 1. High-Level Architecture Overview

Learning Compass follows a clean, decoupled **Client-Server Architecture** with a pluggable **Provider-Independent AI System Layer**, an asynchronous **Document Processing Pipeline**, and an integrated **MongoDB Atlas Vector Search RAG Layer**.

```
+-----------------------------------------------------------------------------------------------+
|                                Client Layer (Single Page App)                                 |
|               React (v18+) + Vite + Vanilla CSS/Modules + React Router v6 + Context           |
+-----------------------------------------------+-----------------------------------------------+
                                                | HTTPS / REST API
                                                v
+-----------------------------------------------------------------------------------------------+
|                              API Gateway & Security Middleware                                |
|          Express Rate Limiter, Helmet Security Headers, CORS, JWT Auth, RBAC Middleware         |
+-----------------------------------------------+-----------------------------------------------+
                                                |
                                                v
+-----------------------------------------------------------------------------------------------+
|                              Backend Application (Node.js + Express)                          |
|                                                                                               |
|   +--------------+      +-------------------+      +-----------------+      +--------------+  |
|   | Routes Layer |----->| Controllers Layer |----->| Services Layer  |----->| Models Layer |  |
|   +--------------+      +-------------------+      +--------+--------+      +------+-------+  |
+-------------------------------------------------------------+----------------------+----------+
                                                              |                      |
                   +------------------------------------------+---------------+      |
                   v                                                          v      v
+---------------------------------------+                    +----------------------------------+
|        AI & Data Services             |                    |     Storage & Data Stores        |
|                                       |                    |                                  |
| +-----------------------------------+ |                    | +------------------------------+ |
| | services/documents/               | |                    | | MongoDB Atlas Database       | |
| | (Ingestion, Extraction, OCR, Chunk)| |                    | | (Mongoose ODM + Collections) | |
| +-----------------+-----------------+ |                    | +--------------+---------------+ |
|                   v                   |                    |                |                 |
| +-----------------------------------+ |                    | +--------------v---------------+ |
| | services/rag/                     | |                    | | MongoDB Atlas Vector Search  | |
| | (Embedding, Vector Search, Top-K) | |                    | | (DocumentChunk Vector Index) | |
| +-----------------+-----------------+ |                    | +--------------+---------------+ |
|                   v                   |                    |                                  |
| +-----------------------------------+ |                    | +------------------------------+ |
| | services/ai/                      | |                    | | Object Storage Service       | |
| | (Pluggable Provider Adapters)     | |                    | | (AWS S3 / Cloudflare R2)     | |
| +-----------------+-----------------+ |                    | +--------------+---------------+ |
+-------------------+-------------------+                    +----------------------------------+
                    |
   +----------------+----------------+----------------+
   v                v                v                v
+--------------+ +--------------+ +--------------+ +--------------+
| LLM Provider | | LLM Provider | | Embedding    | | OCR Provider |
| Adapter      | | Adapter      | | Provider     | | Adapter      |
| (OpenAI/Gem) | | (Anthropic)  | | Adapter      | | (Tesseract)  |
+--------------+ +--------------+ +--------------+ +--------------+
```

### Core Architecture Capabilities
- **Supported Material Formats**: PDF (`.pdf`), Word (`.docx`), PowerPoint (`.pptx`), and Images/Scanned Documents (`.png`, `.jpg`, `.jpeg`, `.tiff`, `.webp`).
- **Decoupled Document Chunks Storage**: Chunks and dense vector embeddings are stored in a dedicated `DocumentChunk` collection separate from the parent `Material` metadata document to maximize vector search efficiency.
- **Conditional OCR**: Text extraction uses native format parsing first. OCR runs **only** when normal extraction produces empty, unreadable, or insufficient usable text.
- **MongoDB Atlas Vector Search RAG**: Fully integrated retrieval pipeline using dense vector embeddings and tenant-bound metadata filters (`topicId`, `teacherId`).

---

## 2. Frontend Architecture (React + Vite)

The frontend is a single-page application (SPA) built using **React** with **Vite** as the build tool and bundler.

### Component & Folder Layout
```
frontend/
├── public/
├── src/
│   ├── assets/              # Static images, icons, global styles
│   ├── components/          # Shared reusable UI elements
│   │   ├── common/          # Buttons, Inputs, Modals, Cards, Loaders
│   │   ├── layout/          # Navbar, Sidebar, Footer, Page Containers
│   │   └── feedback/        # Alerts, Toast notifications, Progress bars
│   ├── context/             # Global React Contexts (AuthContext, ThemeContext)
│   ├── features/            # Feature-based modular components
│   │   ├── auth/            # Login, Register, ProtectedRoute
│   │   ├── courses/         # Course List, Course Form, Topic List
│   │   ├── materials/       # Material Upload, Ingestion Status Viewer
│   │   ├── assessments/     # RAG Assessment Generator, Quiz Player
│   │   ├── diagnostics/     # Multi-Dimensional Diagnostic Dashboard
│   │   └── learningPaths/   # Interactive Learning Path Viewer & Reassessment
│   ├── hooks/               # Custom React Hooks (useAuth, useFetch, useRAG)
│   ├── services/            # Axios API Client & Endpoint Wrappers
│   ├── utils/               # Formatting, Helpers, Validators
│   ├── App.jsx              # Main Application Component & Router Configuration
│   └── main.jsx             # React Application Mount Point
├── index.html
├── package.json
└── vite.config.js
```

---

## 3. Backend Architecture (Node.js + Express)

The backend follows a layered MVC-Service architecture, maintaining clear separation of concerns across controllers, domain services, AI adapters, and database models.

### Directory Structure
```
server/
├── src/
│   ├── config/              # DB connection, Environment validation, Logger
│   ├── controllers/         # Express Controller Handlers
│   │   ├── authController.js
│   │   ├── courseController.js
│   │   ├── materialController.js
│   │   ├── assessmentController.js
│   │   ├── evaluationController.js
│   │   ├── diagnosticController.js
│   │   └── learningPathController.js
│   ├── middleware/          # Security, Auth, Upload, Error Handling
│   │   ├── auth.middleware.js
│   │   ├── rbac.middleware.js
│   │   ├── upload.middleware.js
│   │   └── error.middleware.js
│   ├── models/              # Mongoose Data Models
│   │   ├── User.js
│   │   ├── Course.js
│   │   ├── Topic.js
│   │   ├── Material.js
│   │   ├── DocumentChunk.js # Primary Vector Search Chunk Storage Model
│   │   ├── Assessment.js
│   │   ├── Question.js
│   │   ├── Attempt.js
│   │   ├── Response.js
│   │   ├── DiagnosticReport.js
│   │   └── LearningPath.js
│   ├── services/            # Domain Services & Business Logic
│   │   ├── ai/              # Provider-Independent AI Architecture
│   │   │   ├── AIProviderFactory.js
│   │   │   ├── BaseAIProvider.js
│   │   │   ├── OpenAIProvider.js
│   │   │   ├── GeminiProvider.js
│   │   │   ├── BaseEmbeddingProvider.js
│   │   │   ├── OpenAIEmbeddingProvider.js
│   │   │   ├── BaseOCRProvider.js
│   │   │   └── LocalOCRProvider.js
│   │   ├── documents/       # Document Ingestion Pipeline
│   │   │   ├── documentIngestionService.js
│   │   │   ├── textExtractor.js
│   │   │   ├── conditionalOCRService.js
│   │   │   └── chunkingService.js
│   │   ├── rag/             # RAG Layer & Vector Search
│   │   │   ├── vectorSearchService.js
│   │   │   ├── queryGenerator.js
│   │   │   └── contextBuilder.js
│   │   ├── storage/         # Object Storage Layer (S3 / R2)
│   │   │   ├── BaseStorageProvider.js
│   │   │   └── S3StorageProvider.js
│   │   ├── authService.js
│   │   ├── courseService.js
│   │   ├── assessmentService.js
│   │   ├── evaluationService.js
│   │   ├── diagnosticService.js
│   │   └── learningPathService.js
│   ├── utils/               # Async Handlers, Custom AppError, Logger, Schema Validators
│   ├── app.js               # Express Application Assembly
│   └── server.js            # HTTP Server Listener
├── tests/
├── .env.example
└── package.json
```

---

## 4. Document-Processing Flow

Uploaded learning materials undergo an asynchronous ingestion pipeline to prepare text chunks and dense vector embeddings for retrieval:

```
Teacher Upload
→ Object Storage
→ Material DB record
→ Text Extraction
→ Conditional OCR
→ Text Cleaning
→ Chunking
→ Embedding Generation
→ Store chunks + embeddings
→ MongoDB Atlas Vector Search index
→ Processing completed
```

### Detailed Pipeline Stage Breakdown:

1. **Teacher Upload**: The teacher submits a file (PDF, DOCX, PPTX, or Image/Scanned Document) via the multipart upload API endpoint.
2. **Object Storage**: The backend streams the raw file to AWS S3 / Cloudflare R2 object storage and generates a durable storage URL.
3. **Material DB Record**: A `Material` database record is created in MongoDB with state `uploaded` containing material metadata (`topicId`, `teacherId`, `title`, `fileUrl`, `fileType`).
4. **Text Extraction**: The system executes format-specific native text extraction:
   - **PDF**: Native stream text parsing.
   - **DOCX**: Word XML text extraction.
   - **PPTX**: Presentation slide frame text extraction.
   - **Images / Scanned Docs**: Direct pass-through to Conditional OCR evaluation.
5. **Conditional OCR**: The pipeline inspects extracted text usability. **OCR runs ONLY when normal extraction produces empty, unreadable, or insufficient usable text** (e.g., below character count or word density thresholds).
6. **Text Cleaning**: Sanitizes extracted text, strips non-printable control characters, removes formatting noise, and normalizes whitespaces.
7. **Chunking**: Splits cleaned text into semantic overlapping chunks (~500–1000 tokens per chunk with 100–150 token overlap), preserving page numbers where available.
8. **Embedding Generation**: Sends chunk text strings to the abstracted AI embedding provider (e.g., OpenAI `text-embedding-3-small` / Gemini) to produce 1536-dimensional dense vector embeddings.
9. **Store Chunks + Embeddings**: Creates individual `DocumentChunk` records in MongoDB (`documentchunks` collection) containing `materialId`, `topicId`, `teacherId`, `content`, `pageNumber`, `chunkIndex`, `embedding`, `tokenCount`, and `metadata`. *Note: The parent Material document is NOT the primary storage location for chunk vector search content.*
10. **MongoDB Atlas Vector Search Index**: The created `DocumentChunk` documents are indexed automatically by the MongoDB Atlas Vector Search engine on the `embedding` field alongside pre-filter indexing for `topicId` and `teacherId`.
11. **Processing Completed**: The parent `Material` record status is updated to `completed` (or `failed` if errors occur).

---

## 5. Retrieval-Augmented Generation (RAG) Architecture

The RAG pipeline retrieves relevant document chunks from the `DocumentChunk` collection to ground assessment generation in actual course content:

```
Assessment generation request
→ query
→ query embedding
→ MongoDB Atlas Vector Search
→ top-K relevant chunks
→ authorization/tenant filtering
→ context builder
→ LLM
→ structured assessment
→ schema validation
→ database
```

### Detailed RAG Stage Breakdown:

1. **Assessment Generation Request**: Teacher requests an AI-generated assessment for a specific topic, specifying learning objectives, target Bloom levels, and question count.
2. **Query**: The `queryGenerator` service synthesizes a semantic search query from topic objectives and assessment parameters.
3. **Query Embedding**: The RAG layer passes the search query string to the embedding provider adapter to generate a query vector.
4. **MongoDB Atlas Vector Search**: Executes an aggregation pipeline `$vectorSearch` query against the `documentchunks` collection utilizing cosine vector similarity.
5. **Top-K Relevant Chunks**: Atlas Vector Search returns the top K (e.g., K = 5 to 10) candidate chunk documents with highest vector similarity scores.
6. **Authorization / Tenant Filtering**: Pre-filtering and post-query verification enforce strict authorization boundaries (`topicId`, `teacherId`) ensuring teachers can only retrieve chunks belonging to materials they own or are authorized to access.
7. **Context Builder**: Formats and concatenates retrieved chunk contents with source metadata citations (`pageNumber`, `chunkIndex`, `materialId`) into a structured context window.
8. **LLM**: Context and system prompt instructions are passed to the abstracted LLM provider (OpenAI / Gemini / Anthropic).
9. **Structured Assessment**: The LLM generates a structured JSON assessment payload containing diagnostic questions, distractors, distractor-to-misconception mappings, and rubrics.
10. **Schema Validation**: The raw output is validated against the JSON schema (using Zod/Ajv). On schema mismatch, an automatic self-healing repair loop attempts prompt correction (up to 3 retries).
11. **Database**: The validated assessment and question entities are persisted to MongoDB in the `Assessment` and `Question` collections.

---

## 6. MongoDB Atlas Vector Search Index Definition (Conceptual)

The vector search index is defined on the `documentchunks` collection in MongoDB Atlas:

```json
{
  "name": "document_chunks_vector_index",
  "searchAnalyzer": "lucene.standard",
  "analyzer": "lucene.standard",
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "topicId"
    },
    {
      "type": "filter",
      "path": "teacherId"
    },
    {
      "type": "filter",
      "path": "materialId"
    }
  ]
}
```

---

## 7. Document Chunk Data Model Specification

The primary entity for document retrieval in vector search is the `DocumentChunk` model:

- `_id`: ObjectId (Primary key)
- `materialId`: ObjectId (ref: 'Material', required)
- `topicId`: ObjectId (ref: 'Topic', required)
- `teacherId`: ObjectId (ref: 'User', required)
- `content`: String (Extracted text string, required)
- `pageNumber`: Number (Source page index, optional / where available)
- `chunkIndex`: Number (Sequential chunk index in document, required)
- `embedding`: Array of Numbers (Vector of 1536 floats, required)
- `tokenCount`: Number (Token count of `content`, required)
- `metadata`: Object (Flexible metadata dictionary e.g., `{ fileName, mimeType, sectionHeader }`)
- `createdAt`: Date

---

## 8. Error-Handling Architecture

The backend implements a centralized, production-ready error-handling system.

### Custom Error Hierarchy
- **`AppError`**: Base class extending standard JavaScript `Error`, adding `statusCode`, `isOperational`, and `errorCode`.
- **Subclasses**:
  - `ValidationError` (400 Bad Request)
  - `AuthenticationError` (401 Unauthorized)
  - `ForbiddenError` (403 Forbidden)
  - `NotFoundError` (404 Not Found)
  - `AIServiceError` (502 Bad Gateway / 503 Service Unavailable)

### Centralized Error Middleware (`errorMiddleware.js`)
- **Operational Errors**: Expected errors (e.g., invalid input, expired token). Returned to client with informative message and specific error code.
- **Programmer / System Errors**: Unexpected crashes. Logged with full stack trace; client receives generic "Internal Server Error" message to prevent leak of sensitive stack details.

### Standardized Error Payload:
```json
{
  "status": "fail",
  "code": "INVALID_INPUT_DATA",
  "message": "Validation failed for student assessment submission",
  "errors": [
    {
      "field": "responses[0].answer",
      "message": "Answer cannot be empty"
    }
  ]
}
```
