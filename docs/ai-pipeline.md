# Learning Compass — Pluggable AI & Vector Search Pipeline

This document defines the AI pipeline, structured JSON schemas, validation protocols, resilience strategies, and pluggable provider architecture for **Learning Compass**.

---

## 1. AI Provider Abstraction Architecture

To fulfill technology constraints requiring an **abstracted AI provider** (allowing seamless switching between OpenAI, Google Gemini, Anthropic, or local LLMs without modifying application logic), the system implements an **Adapter / Factory Pattern**.

```
                           +---------------------------+
                           |   AIServiceAdapter (Interface)
                           +-------------+-------------+
                                         |
        +--------------------------------+--------------------------------+
        v                                v                                v
+-----------------+             +-----------------+             +-----------------+
| OpenAIProvider  |             | GeminiProvider  |             | MockAIProvider  |
| (GPT-4o/o3-mini)|             | (Gemini 1.5 Pro)|             | (Local Dev/Test)|
+-----------------+             +-----------------+             +-----------------+
```

---

## 2. Core AI & RAG Pipeline Stages

### Stage 1: Document Processing Pipeline
Uploaded learning materials follow an asynchronous preprocessing and indexing flow:
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

#### Rules & Specifications:
- **Supported File Types**: PDF (`.pdf`), Word (`.docx`), PowerPoint (`.pptx`), and Images/Scanned Documents (`.png`, `.jpg`, `.jpeg`, `.tiff`, `.webp`).
- **Conditional OCR Execution**: Text extraction performs native document parsing first. **OCR runs ONLY when normal extraction produces empty, unreadable, or insufficient usable text** (e.g., below minimum character density threshold).
- **Chunk & Embedding Persistence**: Extracted text chunks and 1536-dimensional vector embeddings are persisted to the `DocumentChunk` collection, separate from the parent `Material` metadata document.

---

### Stage 2: Assessment Generation & RAG Pipeline
When a teacher requests diagnostic assessment generation, context is retrieved from the vector search index:
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

#### Retrieval Steps:
1. **Query & Query Embedding**: Converts user assessment generation request into a search query and generates a dense query vector.
2. **MongoDB Atlas Vector Search**: Queries the `documentchunks` collection using the `document_chunks_vector_index` cosine similarity index.
3. **Tenant & Authorization Pre-Filtering**: Applies tenant boundary filters (`topicId`, `teacherId`) to restrict chunk retrieval strictly to authorized materials.
4. **Context Construction**: Assembles top-K retrieved chunk contents with source citations (`pageNumber`, `chunkIndex`) into a prompt context window.
5. **LLM Generation**: Instructs the selected LLM provider to generate structured JSON diagnostic assessment items.
6. **Schema Validation & Repair Loop**: Validates LLM output against Zod/Ajv JSON schemas with up to 3 automatic repair retry cycles.
7. **Database Persistence**: Stores validated assessments and questions in MongoDB.

---

### Stage 3: Student Response Evaluation Pipeline
1. **Deterministic Filter**: MCQs evaluated instantly by comparing `studentAnswer` to `correctAnswer` (0 AI tokens consumed).
2. **LLM Evaluation**: Short answer / open-ended questions passed to AI provider with rubric and expected concepts.
3. **Misconception Tagging**: Evaluator identifies whether incorrect answers match known distractor misconceptions or represent novel conceptual gaps.

---

### Stage 4: Diagnostic Analysis Pipeline
1. **Aggregation**: Collects scored responses, error types, and concept breakdown for an `Attempt`.
2. **AI Diagnostic Synthesis**: Model synthesizes overall performance across bloom levels and pinpoints root misconceptions.
3. **Output Generation**: Produces `overallMasteryScore`, `masteryLevel`, `strengths`, and prioritized `identifiedMisconceptions`.

---

### Stage 5: Personalized Learning-Path Generation Pipeline
1. **Input Mapping**: Takes diagnosed misconceptions from `DiagnosticReport`.
2. **Dynamic Pathway Synthesis**: Model generates a sequence of remediation nodes (`remedial_reading`, `concept_video`, `practice_exercise`, `checkpoint_quiz`) specifically addressing the diagnosed gaps.
3. **Content Generation**: Generates contextual explanations customized to the student's current proficiency level.

---

## 3. MongoDB Atlas Vector Search Index Conceptual Definition

The conceptual definition of the vector search index configured in MongoDB Atlas for document chunk retrieval:

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

## 4. Document Chunk Data Model Schema

```json
{
  "_id": "ObjectId",
  "materialId": "ObjectId (ref: Material)",
  "topicId": "ObjectId (ref: Topic)",
  "teacherId": "ObjectId (ref: User)",
  "content": "String (Text chunk content)",
  "pageNumber": "Number (Optional page index)",
  "chunkIndex": "Number (Sequential chunk index)",
  "embedding": "Array of 1536 Floats (Vector embedding)",
  "tokenCount": "Number",
  "metadata": "Object (FileName, MimeType, Header)",
  "createdAt": "Date"
}
```

---

## 5. Structured AI Output JSON Schemas

### A. Assessment Generation Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["questions"],
  "properties": {
    "questions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["order", "type", "prompt", "options", "conceptTested", "bloomsTaxonomyLevel"],
        "properties": {
          "order": { "type": "number" },
          "type": { "type": "string", "enum": ["multiple_choice", "short_answer", "open_ended"] },
          "prompt": { "type": "string" },
          "options": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["optionId", "text", "isCorrect"],
              "properties": {
                "optionId": { "type": "string" },
                "text": { "type": "string" },
                "isCorrect": { "type": "boolean" },
                "associatedMisconception": { "type": "string" }
              }
            }
          },
          "conceptTested": { "type": "string" },
          "bloomsTaxonomyLevel": { "type": "string", "enum": ["remember", "understand", "apply", "analyze", "evaluate", "create"] }
        }
      }
    }
  }
}
```

### B. Diagnostic Report Schema
```json
{
  "type": "object",
  "required": ["overallMasteryScore", "masteryLevel", "strengths", "identifiedMisconceptions", "aiSummary"],
  "properties": {
    "overallMasteryScore": { "type": "number", "minimum": 0, "maximum": 100 },
    "masteryLevel": { "type": "string", "enum": ["novice", "developing", "proficient", "mastered"] },
    "strengths": { "type": "array", "items": { "type": "string" } },
    "identifiedMisconceptions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["misconceptionCode", "title", "explanation", "severity"],
        "properties": {
          "misconceptionCode": { "type": "string" },
          "title": { "type": "string" },
          "explanation": { "type": "string" },
          "severity": { "type": "string", "enum": ["low", "medium", "high"] }
        }
      }
    },
    "aiSummary": { "type": "string" }
  }
}
```

---

## 6. Output Validation & Self-Healing Pipeline

All AI outputs must pass strict runtime schema validation before database storage:

```
[Raw AI Response String]
       │
       ▼
[JSON Parse Check] ──► (Invalid JSON?) ──► [Initiate Self-Healing Repair Request]
       │                                            │
       ▼ (Valid JSON)                               ▼
[Runtime Schema Validation (Zod / Ajv)] ────► [Retry with Error Trace in Prompt]
       │                                            │
       ▼ (Valid against Schema)                     ▼ (Exceeded Max Retries = 3)
[Save to DB & Return to Controller]         [Trigger Failover Provider or Log Alert]
```

---

## 7. Resilience & Failure Handling Strategies

1. **Rate Limit Management**: Token bucket queue for AI requests prevents reaching provider RPM/TPM rate limits.
2. **Exponential Backoff**: Transient HTTP 429/503 errors retried using jittered exponential backoff (`1s`, `2s`, `4s`, `8s`).
3. **Provider Failover**: If primary provider (e.g. OpenAI) returns persistent 5xx errors or times out (>30s), system automatically fails over to secondary provider (e.g. Gemini).
4. **Offline Mock Fallback**: In non-production test/development environments, `MockAIProvider` serves deterministic structured responses without consuming API credits.
