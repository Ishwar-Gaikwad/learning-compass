# Learning Compass — Database Schema & Data Modeling Specification

This document details the database architecture, entity schemas, indexes, relationships, and MongoDB Atlas Vector Search configuration for **Learning Compass**.

---

## Data Models Summary

| Entity | Purpose | Key Indexes |
| :--- | :--- | :--- |
| **User** | System user account (Student, Teacher, Admin) | `email` (Unique), `role` |
| **Course** | Educational course created by a teacher | `teacherId`, `code` (Unique) |
| **Topic** | Sub-unit within a course curriculum | `courseId`, `order` |
| **Material** | Learning material upload metadata & status | `topicId`, `status` |
| **DocumentChunk** | Primary vector search store for text chunks & embeddings | `topicId + teacherId`, `materialId + chunkIndex`, Atlas Vector Index |
| **Assessment** | Diagnostic test / quiz definition | `topicId + status`, `teacherId` |
| **Question** | Assessment item with distractors & misconceptions | `assessmentId + order` |
| **Attempt** | Student assessment submission session | `studentId + assessmentId`, `status` |
| **Response** | Student answer & AI evaluation for a question | `attemptId + questionId` (Unique) |
| **DiagnosticReport** | Executive diagnostic analysis of student attempt | `attemptId` (Unique), `studentId + topicId` |
| **LearningPath** | Personalized remediation pathway for diagnosed gaps | `diagnosticReportId` (Unique), `studentId + status` |

---

## Detailed Model Specifications

### 1. User
- **Purpose**: Accounts for teachers, students, and administrators.
- **Important Fields**:
  - `_id`: ObjectId
  - `name`: String, required
  - `email`: String, required, unique, lowercased
  - `password`: String, required (Bcrypt hash)
  - `role`: String, enum: `['student', 'teacher', 'admin']`, default: `'student'`
  - `avatarUrl`: String
  - `createdAt`: Date
  - `updatedAt`: Date
- **Indexes**:
  - `{ email: 1 }` (Unique Index)
  - `{ role: 1 }`

---

### 2. Course
- **Purpose**: Represents an educational course created by a teacher.
- **Important Fields**:
  - `_id`: ObjectId
  - `title`: String, required, trimmed
  - `description`: String, required
  - `code`: String, required, unique (e.g., "MATH-101")
  - `teacherId`: ObjectId, ref: `'User'`, required
  - `subject`: String, required
  - `gradeLevel`: String, required
  - `status`: String, enum: `['draft', 'published', 'archived']`, default: `'draft'`
  - `createdAt`: Date
  - `updatedAt`: Date
- **Relationships**:
  - Belongs to `User` (Teacher).
  - Has many `Topic` entities.
- **Indexes**:
  - `{ teacherId: 1 }`
  - `{ code: 1 }` (Unique)

---

### 3. Topic
- **Purpose**: Organizes curriculum into distinct learning units within a Course.
- **Important Fields**:
  - `_id`: ObjectId
  - `courseId`: ObjectId, ref: `'Course'`, required
  - `title`: String, required
  - `description`: String
  - `order`: Number, required (ordering within course)
  - `learningObjectives`: Array of Strings (e.g. ["Understand polynomial division"])
  - `createdAt`: Date
  - `updatedAt`: Date
- **Relationships**:
  - Belongs to `Course`.
  - Has many `Material` entities.
  - Has many `Assessment` entities.
- **Indexes**:
  - `{ courseId: 1, order: 1 }` (Compound Index)

---

### 4. Material
- **Purpose**: Learning resources uploaded by teachers for a topic (tracks document metadata, file storage URL, and ingestion status).
- **Supported File Types**: `'pdf'`, `'docx'`, `'pptx'`, `'image'` (images/scanned documents).
- **Important Fields**:
  - `_id`: ObjectId
  - `topicId`: ObjectId, ref: `'Topic'`, required
  - `teacherId`: ObjectId, ref: `'User'`, required
  - `title`: String, required
  - `fileUrl`: String, required (S3/R2 storage URL)
  - `fileType`: String, enum: `['pdf', 'docx', 'pptx', 'image']`, required
  - `fileSizeBytes`: Number
  - `ocrExecuted`: Boolean, default: `false` (Indicates whether Conditional OCR was triggered)
  - `totalChunksCount`: Number, default: `0`
  - `status`: String, enum: `['uploaded', 'processing', 'processed', 'embedding', 'completed', 'failed']`, default: `'uploaded'`
  - `createdAt`: Date
  - `updatedAt`: Date
- **Relationships**:
  - Belongs to `Topic` and `User` (Teacher).
  - Has many `DocumentChunk` entities.
- **Indexes**:
  - `{ topicId: 1 }`
  - `{ teacherId: 1 }`
  - `{ status: 1 }`

*Note: The Material document is NOT the primary storage location for chunk vector search data. All text chunk contents and vector embeddings are persisted in the `DocumentChunk` model.*

---

### 5. DocumentChunk
- **Purpose**: Primary data model for document text chunks and dense vector embeddings used by MongoDB Atlas Vector Search for grounded RAG context generation.
- **Important Fields**:
  - `_id`: ObjectId
  - `materialId`: ObjectId, ref: `'Material'`, required
  - `topicId`: ObjectId, ref: `'Topic'`, required
  - `teacherId`: ObjectId, ref: `'User'`, required
  - `content`: String, required (Text content of chunk)
  - `pageNumber`: Number (Optional page index where available)
  - `chunkIndex`: Number, required (Sequential order index within document)
  - `embedding`: Array of Numbers, required (1536-dimensional dense vector float array)
  - `tokenCount`: Number, required (Token length of content string)
  - `metadata`: Object (Flexible dictionary containing fileName, mimeType, sectionHeader)
  - `createdAt`: Date, default: `Date.now`
- **Relationships**:
  - Belongs to `Material`, `Topic`, and `User` (Teacher).
- **Indexes**:
  - `{ topicId: 1, teacherId: 1 }` (Tenant isolation index)
  - `{ materialId: 1, chunkIndex: 1 }` (Document sequential index)
  - **MongoDB Atlas Vector Search Index** (on `embedding` field with `topicId`, `teacherId`, `materialId` filter paths)

---

### 6. Assessment
- **Purpose**: A diagnostic quiz generated by AI or assembled by a teacher for a specific topic.
- **Important Fields**:
  - `_id`: ObjectId
  - `topicId`: ObjectId, ref: `'Topic'`, required
  - `teacherId`: ObjectId, ref: `'User'`, required
  - `title`: String, required
  - `description`: String
  - `type`: String, enum: `['initial_diagnostic', 'reassessment']`, default: `'initial_diagnostic'`
  - `timeLimitMinutes`: Number, default: `30`
  - `totalPoints`: Number, default: `100`
  - `passingScore`: Number, default: `70`
  - `status`: String, enum: `['draft', 'published', 'archived']`, default: `'draft'`
  - `aiMetadata`: Object (Generation prompt used, model name, generationTimestamp, contextChunkIds)
  - `createdAt`: Date
  - `updatedAt`: Date
- **Relationships**:
  - Belongs to `Topic` and `User` (Teacher).
  - Has many `Question` entities.
- **Indexes**:
  - `{ topicId: 1, status: 1 }`
  - `{ teacherId: 1 }`

---

### 7. Question
- **Purpose**: Individual assessment items containing question prompts, answer choices/rubrics, and targeted misconception tags.
- **Important Fields**:
  - `_id`: ObjectId
  - `assessmentId`: ObjectId, ref: `'Assessment'`, required
  - `order`: Number, required
  - `type`: String, enum: `['multiple_choice', 'short_answer', 'open_ended']`, required
  - `prompt`: String, required
  - `options`: Array of Objects (For MCQs):
    - `optionId`: String (e.g. "A", "B", "C", "D")
    - `text`: String
    - `isCorrect`: Boolean
    - `associatedMisconception`: String (Misconception ID if option chosen)
  - `correctAnswer`: String (For short answer / reference solution)
  - `rubric`: String (Grading rubric for open-ended questions)
  - `conceptTested`: String, required (e.g. "Adding fractions with unlike denominators")
  - `misconceptions`: Array of Objects:
    - `code`: String (e.g. "MIS_ADD_DENOMINATORS")
    - `description`: String (e.g. "Student added denominators directly")
  - `points`: Number, default: `10`
  - `bloomsTaxonomyLevel`: String, enum: `['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']`
- **Relationships**:
  - Belongs to `Assessment`.
- **Indexes**:
  - `{ assessmentId: 1, order: 1 }`

---

### 8. Attempt
- **Purpose**: Tracks a student's session completing an assessment.
- **Important Fields**:
  - `_id`: ObjectId
  - `assessmentId`: ObjectId, ref: `'Assessment'`, required
  - `studentId`: ObjectId, ref: `'User'`, required
  - `status`: String, enum: `['in_progress', 'submitted', 'evaluated']`, default: `'in_progress'`
  - `scoreObtained`: Number, default: `0`
  - `totalPossibleScore`: Number, default: `100`
  - `percentage`: Number, default: `0`
  - `startedAt`: Date, default: `Date.now`
  - `submittedAt`: Date
  - `evaluatedAt`: Date
- **Relationships**:
  - Belongs to `Assessment` and `User` (Student).
  - Has many `Response` entities.
  - Has one `DiagnosticReport`.
- **Indexes**:
  - `{ studentId: 1, assessmentId: 1 }`
  - `{ status: 1 }`

---

### 9. Response
- **Purpose**: Stores student's submitted answer for a specific question along with AI evaluation results.
- **Important Fields**:
  - `_id`: ObjectId
  - `attemptId`: ObjectId, ref: `'Attempt'`, required
  - `questionId`: ObjectId, ref: `'Question'`, required
  - `studentAnswer`: String, required
  - `isCorrect`: Boolean
  - `scoreGiven`: Number
  - `feedback`: String (Detailed feedback for student)
  - `detectedMisconception`: Object:
    - `code`: String
    - `description`: String
    - `confidence`: Number (0.0 to 1.0)
  - `evaluatedBy`: String, enum: `['deterministic', 'ai_evaluator']`
- **Relationships**:
  - Belongs to `Attempt` and `Question`.
- **Indexes**:
  - `{ attemptId: 1, questionId: 1 }` (Unique)

---

### 10. DiagnosticReport
- **Purpose**: Comprehensive diagnostic analysis generated by AI after an attempt is evaluated, identifying specific conceptual strengths, weaknesses, and misconceptions.
- **Important Fields**:
  - `_id`: ObjectId
  - `attemptId`: ObjectId, ref: `'Attempt'`, required, unique
  - `studentId`: ObjectId, ref: `'User'`, required
  - `topicId`: ObjectId, ref: `'Topic'`, required
  - `overallMasteryScore`: Number (0 - 100)
  - `masteryLevel`: String, enum: `['novice', 'developing', 'proficient', 'mastered']`
  - `strengths`: Array of Strings
  - `identifiedMisconceptions`: Array of Objects:
    - `misconceptionCode`: String
    - `title`: String
    - `explanation`: String
    - `severity`: String, enum: `['low', 'medium', 'high']`
    - `evidenceQuestions`: Array of ObjectIds (ref: `'Question'`)
  - `aiSummary`: String (Executive summary for student and teacher)
  - `createdAt`: Date, default: `Date.now`
- **Relationships**:
  - Belongs to `Attempt`, `User` (Student), and `Topic`.
  - Linked to `LearningPath`.
- **Indexes**:
  - `{ attemptId: 1 }` (Unique)
  - `{ studentId: 1, topicId: 1 }`

---

### 11. LearningPath
- **Purpose**: A customized sequence of learning tasks, explanations, and targeted practice activities generated by AI to resolve diagnosed misconceptions.
- **Important Fields**:
  - `_id`: ObjectId
  - `diagnosticReportId`: ObjectId, ref: `'DiagnosticReport'`, required, unique
  - `studentId`: ObjectId, ref: `'User'`, required
  - `topicId`: ObjectId, ref: `'Topic'`, required
  - `title`: String, required
  - `status`: String, enum: `['active', 'completed', 'superseded']`, default: `'active'`
  - `nodes`: Array of Objects:
    - `nodeId`: String, required
    - `title`: String, required
    - `type`: String, enum: `['remedial_reading', 'practice_exercise', 'concept_video', 'checkpoint_quiz']`
    - `targetMisconception`: String
    - `content`: String (Instructional content / explanation)
    - `isCompleted`: Boolean, default: `false`
    - `completedAt`: Date
  - `overallProgressPercentage`: Number, default: `0`
  - `createdAt`: Date
  - `updatedAt`: Date
- **Relationships**:
  - Belongs to `DiagnosticReport`, `User` (Student), and `Topic`.
- **Indexes**:
  - `{ diagnosticReportId: 1 }` (Unique)
  - `{ studentId: 1, status: 1 }`

---

## MongoDB Atlas Vector Search Index Conceptual Configuration

Index definition created on the `documentchunks` collection:

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
