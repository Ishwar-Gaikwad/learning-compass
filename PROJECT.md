# Learning Compass

**Learning Compass** is an AI-powered diagnostic learning platform designed to identify conceptual weaknesses, diagnose student misconceptions, and generate personalized learning pathways to achieve targeted mastery.

---

## 👥 Core User Roles
- **Teacher**: Creates curriculum content, uploads materials, and generates AI-assisted assessments.
- **Student**: Completes diagnostic assessments, reviews detailed diagnostic reports, and follows personalized learning paths.
- **Admin**: Manages user accounts, platform configurations, and overall system health.

---

## 🔄 Core Product Flow

```
[Teacher] 
   └─► Creates Course
   └─► Creates Topic
   └─► Uploads Learning Material
   └─► Generates Assessment
         │
[Student]◄┘
   └─► Receives & Takes Assessment
   └─► Submits Answers
         │
[System] ◄┘
   └─► Evaluates Responses
   └─► Identifies Conceptual Weaknesses & Misconceptions
   └─► Generates Diagnostic Report
   └─► Generates Personalized Learning Path
         │
[Student]◄┘
   └─► Follows Targeted Practice
   └─► Takes Reassessment
   └─► Progress is Measured & Tracked
```

> **Priority Note**: The v1 MVP prioritizes completing this end-to-end diagnostic flow over secondary features.

---

## 🛠️ Technology Constraints & Stack

| Layer | Specification |
| :--- | :--- |
| **Language** | Pure JavaScript (ES Modules, strictly no TypeScript) |
| **Frontend** | React + Vite + JavaScript |
| **Backend** | Node.js + Express + JavaScript (REST API) |
| **Database** | MongoDB (Persistence) |
| **AI Integration** | Provider-agnostic abstraction layer (pluggable AI service) |
| **Deployment** | Production-ready deployment setup |

---

## 🎯 MVP Scope & Focus
- **Phase 1 Focus**: Complete execution of the core diagnostic loop (Course Setup ➔ Assessment Generation ➔ Evaluation ➔ Diagnostic Report ➔ Personalized Learning Path ➔ Targeted Reassessment).
- **Architecture Integrity**: Strict separation of concerns (Controllers, Services, Routes, Models, Middleware, Utils) with an isolated AI Provider Abstraction.
