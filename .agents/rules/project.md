# Learning Compass — Project Rules & Guidelines

## Tech Stack & Language Guidelines
- **JavaScript Only**: Write all code in pure JavaScript. Do NOT create TypeScript files (`.ts`, `.tsx`).
- **Frontend Stack**: React + Vite + JavaScript.
- **Backend Stack**: Node.js + Express + JavaScript.
- **Module System**: Use ES modules (`import` / `export`) consistently across both frontend and backend.
- **Database**: Use MongoDB for data persistence.
- **Architecture Separation**: Keep frontend and backend clean and strictly separated.

## Backend Architecture
- **Layered Structure**: Organize backend into `controllers`, `services`, `routes`, `models`, `middleware`, and `utils`.
- **Controller Responsibilities**: Controllers must handle HTTP request/response parsing and status codes. Controllers must NOT contain heavy business logic.
- **Service Responsibilities**: All core business logic belongs in services.
- **AI Service Abstraction**: Keep AI provider integrations behind a dedicated AI service abstraction interface.

## Security & Validation
- **Secret Protection**: Never expose AI API keys, database connection strings, or credentials to the frontend.
- **Environment Files**: Never commit `.env` files or secrets to version control.
- **Input Validation**: Strictly validate all external inputs entering the system.
- **AI Output Validation**: Validate all AI-generated structured output (e.g., JSON schemas) before saving to MongoDB or returning to client.

## Workflow & Development Practices
- **Production-Oriented Code**: Write maintainable, clean, production-ready code.
- **Dependency Management**: Do not install new dependencies without explaining why they are needed.
- **Focused Scoping**: Do not rewrite unrelated files when implementing a feature.
- **No Premature Feature Creep**: Do not build future features unless explicitly requested.
- **Incremental Progress**: Prefer small, incremental changes over generating the entire application at once.
- **Verification Requirement**: After implementation, always run the relevant build/test commands. Do not claim a feature works without empirical verification.
