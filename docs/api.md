# Learning Compass — REST API Specifications

This document defines the RESTful HTTP API contracts, endpoints, request payloads, response structures, and status codes for **Learning Compass**.

---

## 1. Global API Conventions

- **Base URL**: `/api/v1` (also supports `/api`)
- **Data Format**: All request and response bodies use standard `application/json` unless uploading files (`multipart/form-data`).
- **Supported File Upload Formats**: PDF (`.pdf`), Word (`.docx`), PowerPoint (`.pptx`), and Images/Scanned Documents (`.png`, `.jpg`, `.jpeg`, `.tiff`, `.webp`). Maximum upload size: 10MB.
- **Authentication Header**: `Authorization: Bearer <JWT_ACCESS_TOKEN>`
- **Standard Success Response Envelope**:
```json
{
  "success": true,
  "data": { ... }
}
```
- **Standard Error Response Envelope**:
```json
{
  "success": false,
  "status": "fail",
  "code": "ERROR_CODE_STRING",
  "message": "Human readable error description"
}
```

---

## 2. Authentication Endpoints (`/api/v1/auth`)

### `POST /auth/register`
- **Description**: Registers a new system user (Teacher, Student, Admin).
- **Access**: Public
- **Request Body**:
```json
{
  "name": "Jane Teacher",
  "email": "jane.teacher@school.edu",
  "password": "securePassword123",
  "role": "teacher"
}
```

### `POST /auth/login`
- **Description**: Authenticates user and returns JWT token.
- **Access**: Public

### `GET /auth/me`
- **Description**: Retrieves current authenticated user profile.
- **Access**: Authenticated User (`Bearer Token`)

---

## 3. Courses Endpoints (`/api/v1/courses`)

### `POST /courses`
- **Description**: Creates a new course owned by the authenticated teacher.
- **Access**: Teacher
- **Request Body**:
```json
{
  "title": "Algebra I",
  "description": "Foundational algebra and linear functions",
  "code": "MATH-ALG1",
  "subject": "Mathematics",
  "gradeLevel": "9th Grade",
  "status": "draft"
}
```

### `GET /courses`
- **Description**: Retrieves all courses owned by the authenticated teacher.
- **Access**: Teacher

### `GET /courses/:id`
- **Description**: Retrieves course details by ID (enforces teacher ownership).
- **Access**: Teacher (Course Owner)

### `PATCH /courses/:id`
- **Description**: Updates course details.
- **Access**: Teacher (Course Owner)

### `DELETE /courses/:id`
- **Description**: Deletes course and all associated topics.
- **Access**: Teacher (Course Owner)

---

## 4. Topics Endpoints (`/api/v1/courses/:courseId/topics` & `/api/v1/topics`)

### `POST /courses/:courseId/topics`
- **Description**: Creates a new topic within an existing course owned by the teacher.
- **Access**: Teacher (Course Owner)
- **Request Body**:
```json
{
  "title": "Polynomial Operations",
  "description": "Addition, subtraction, and synthetic division",
  "order": 1,
  "learningObjectives": ["Understand synthetic division", "Identify polynomial degree"]
}
```

### `GET /courses/:courseId/topics`
- **Description**: Retrieves all topics for a course ordered by display sequence.
- **Access**: Teacher (Course Owner)

### `GET /topics/:id`
- **Description**: Retrieves topic details by topic ID.
- **Access**: Teacher (Course Owner)

### `PATCH /topics/:id`
- **Description**: Updates topic title, description, order, or learning objectives.
- **Access**: Teacher (Course Owner)

### `DELETE /topics/:id`
- **Description**: Deletes a topic.
- **Access**: Teacher (Course Owner)

---

## 5. Materials Endpoints (`/api/v1/materials`)

### `POST /courses/:courseId/topics/:topicId/materials`
- **Description**: Uploads learning material (PDF, DOCX, PPTX, or Image/Scanned Document) for a topic and enqueues asynchronous ingestion processing.
- **Access**: Teacher (Course Owner)

### `GET /materials/:id/status`
- **Description**: Checks ingestion processing status for an uploaded material (`uploaded` -> `processing` -> `processed` -> `embedding` -> `completed` / `failed`).
- **Access**: Teacher
