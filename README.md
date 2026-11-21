# Full-Stack LMS Platform

A robust, production-ready Learning Management System (LMS) built with plain JavaScript, React, Tailwind CSS, Express, Prisma, and PostgreSQL. It features role-based access control, course and curriculum authoring, server-authoritative timed quizzes, single-aggregate analytics, AI-powered tutoring with grounded evaluation, and a flat lesson discussion board.

---

## Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Test Accounts](#test-accounts)
- [Architecture Decisions](#architecture-decisions)
- [Known Limitations](#known-limitations)
- [AI Chat History](#ai-chat-history)

---

## Overview

The platform provides a unified environment for instructors to create structured courses and for students to learn interactively:
- **Instructors** can manage published/draft courses, structure chapters and lessons (text articles and embedded YouTube videos), generate reference notes via Google Gemini, construct module quizzes, and view comprehensive student progress and quiz performance via a single aggregate query.
- **Students** can browse published courses, enroll, track completion progress, take timed module quizzes with lazy grading, ask the AI Tutor to evaluate their conceptual understanding, and post comments on lessons.

---

## Key Features

1. **Role-Based Auth & Access Control**:
   - Secure authentication with bcrypt password hashing and JWT stored in an `httpOnly` cookie.
   - Public signup defaults strictly to `STUDENT`. Instructor signup requires a secret invite code (`INSTRUCTOR_INVITE_CODE`).
   - Students only see published courses. Unpublishing safely hides courses without deleting progress or enrollments.

2. **Curriculum & Lesson Builder**:
   - Course modules and lessons with position-based ordering.
   - Mixed media: rich text articles and YouTube video embeds (automatically normalized to embed URLs).
   - Video lessons support instructor fields: `topic`, `keywords`, and `level`.

3. **Server-Authoritative Quiz Engine**:
   - One quiz per module with configurable pass mark (`passMark`) and time limit (`timeLimitMin`).
   - Exactly 4 options per question with single correct index.
   - `correctIndex` is strictly stripped on the server and never sent to the client until after submission.
   - Resuming returns the existing attempt (single attempt per student enforced via unique constraint).
   - Autosave answers via `PATCH /api/quizzes/:id/answers`.
   - Lazy grading: if an attempt passes `expiresAt` without submission, it is automatically graded using saved answers upon any subsequent access.

4. **Instructor Analytics Dashboard**:
   - Single aggregate query computes student progress %, lesson completions, enrollment timestamps, and module quiz pass/fail statuses without N+1 overhead.

5. **AI Tutor ("Explain It Back")**:
   - `POST /api/lessons/:id/tutor` accepts student explanations (up to 1,500 characters).
   - Uses Google Gemini in JSON mode with strict Zod validation and structured response schema (`score`, `understood`, `gaps`, `corrections`, `quiz`).
   - Uses the lesson content (or `lesson.aiContext` for video lessons) as the **only ground truth**.
   - For video lessons without reference notes, access is blocked with a clear instruction message.
   - Strictly sends zero personal student data to Gemini.
   - Enforces a rate limit of 10 calls per user per day.
   - Generates an interactive 5-question practice quiz based on the student's evaluation.

6. **Flat Lesson Comments**:
   - Paginated comment thread (newest first) under each lesson.
   - Plain text only (HTML tags sanitized on ingestion and rendered with `whitespace-pre-wrap` to prevent XSS).
   - Authors can delete their own comments; the course instructor can delete any comment on their course.

---

## Local Setup

### Prerequisites
- **Node.js**: v18+ (tested on Node v20/v24)
- **PostgreSQL**: Local PostgreSQL instance (or Neon / cloud PostgreSQL database)
- **Git**

### 1. Clone & Install Dependencies
The repository is structured as an npm workspaces monorepo:
```bash
git clone <repo-url>
cd leverage_assignment

# Install dependencies across root, server, and client
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the root (or under `/server`):
```bash
cp .env.example .env
```
Update your PostgreSQL connection string, JWT secret, and Gemini API key (see [Environment Variables](#environment-variables)).

### 3. Run Database Migrations & Seed
Deploy Prisma migrations and run the idempotent seed script:
```bash
cd server

# Run migrations
npx prisma migrate deploy

# Seed database with courses, modules, lessons, quizzes, and test users
npx prisma db seed

cd ..
```

### 4. Run Development Servers
Run both client (Vite on port `5173`) and server (Express on port `5000`) concurrently:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Production Build & Run (Single Deploy)
To build the React client and serve it directly from the Express server:
```bash
# Build the client SPA
npm run build

# Start the unified Express server
npm start
```
The application will be served at [http://localhost:5000](http://localhost:5000).

---

## Environment Variables

| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | Port for the Express backend server | `5000` |
| `NODE_ENV` | Environment mode | `development` / `production` |
| `DATABASE_URL` | PostgreSQL connection URL (supports local and Neon) | `postgresql://postgres:postgres@localhost:5432/lms_db?schema=public` |
| `JWT_SECRET` | Secret key for signing and verifying JSON Web Tokens | `your-secure-jwt-secret-here` |
| `INSTRUCTOR_INVITE_CODE` | Required invite code for registering an `INSTRUCTOR` account | `instructor-invite-secret` |
| `GEMINI_API_KEY` | Google Gemini API key for AI Tutor & reference notes | `AIzaSy...` (falls back to deterministic generator if omitted) |
| `GEMINI_MODEL` | Gemini model name | `gemini-2.5-flash` |
| `CLIENT_URL` | Origin URL for CORS configuration during local development | `http://localhost:5173` |

---

## Test Accounts

The seed script creates the following accounts (all seeded with idempotent upserts):

| Role | Email | Password | Access & Capabilities |
|---|---|---|---|
| **Instructor** | `instructor@lms.test` | `instructor@123` | Full course editor, quiz builder, note generation, course publishing, aggregate analytics dashboard |
| **Student** | `student@lms.test` | `student@123` | Course catalog, lesson viewer, quiz taking with timer, AI Tutor practice, lesson discussions |

---

## Architecture Decisions

### 1. Why JWT in httpOnly Cookie
- **Security against XSS**: Tokens stored in `localStorage` or `sessionStorage` are accessible to client-side scripts. By storing the JWT in an `httpOnly`, `SameSite=lax` cookie, tokens cannot be read by JavaScript.
- **Stateless Verification**: The JWT carries verified claims (`userId`, `email`, `role`, `name`), allowing authentication middleware to authenticate requests without hitting the database on every single route call.

### 2. Why PostgreSQL
- **Relational Integrity**: Enforces strict cascading deletes, foreign keys, and compound uniqueness rules:
  - `@@unique([userId, quizId])` ensures exactly one quiz attempt per student per quiz.
  - `@@unique([instructorId, title])` ensures clean course namespaces.
  - `@@index([courseId, position])` and `@@index([moduleId, position])` ensure fast deterministic curriculum ordering.
- **Transactions & Concurrency**: Atomic operations via `prisma.$transaction` prevent race conditions during quiz question updates, enrollments, and grading.

### 3. Lazy Quiz Grading
- Rather than running fragile cron jobs, external task workers, or long-lived server timers to track when quizzes expire, grading is **server-authoritative and lazy**:
  - The attempt records `expiresAt = startedAt + timeLimitMin`.
  - When the student visits `GET /quizzes/:id` or saves answers via `PATCH /quizzes/:id/answers`, the server checks `if (now > attempt.expiresAt)`.
  - If expired, it immediately calculates the score, stamps `submittedAt = expiresAt`, and persists the result.
  - The client timer is strictly a visual aid; the server remains the sole grading authority.

### 4. Cached aiContext for Video Lessons
- Video lessons lack readable text on the server. Scraping external transcripts is fragile and prone to rate limits or missing captions.
- Instructors use the "Generate Notes" button to invoke Gemini once with `topic`, `keywords`, and `level` to draft comprehensive reference notes.
- The instructor reviews and edits the notes, and approves them by saving to `lesson.aiContext`.
- The AI Tutor uses `aiContext` as its ground truth. If `aiContext` is empty, evaluation is blocked immediately with a clear explanatory error.

### 5. Single Deploy Architecture
- The Express server serves both the REST API under `/api` and the compiled React SPA from `client/dist` using an SPA catch-all fallback.
- Eliminates CORS issues in production, removes the need for multiple hosting services, and runs cleanly on a single Render web service or Docker container.

### 6. Plain JavaScript with Zod Runtime Validation
- Monorepo uses standard ES Modules (`type: "module"`) without TypeScript transpilation steps, keeping builds fast and developer workflow straightforward.
- Strict runtime boundaries are enforced with **Zod** on all incoming payloads (course creation, quiz submissions, progress toggles, AI prompts, comments) and outbound AI responses (`tutorResponseSchema`), preventing invalid or malformed data from reaching the database or frontend.

---

## Known Limitations

1. **Stateless JWT Revocation**:
   - Because JWTs are stateless, an issued token remains valid until its expiration (7 days) unless a token blacklist or revocation timestamp is added to Redis or the database.
2. **Render Free-Tier Cold Starts**:
   - When hosted on Render's free tier, the web service spins down after 15 minutes of inactivity, resulting in a 30–50 second cold start delay on the first incoming request.
3. **YouTube Transcripts Not Auto-Fetched**:
   - The application does not automatically scrape or transcribe YouTube audio via third-party APIs; it relies on instructor-generated or manual `aiContext` notes for video lessons.

---

## AI Chat History

All session prompts, iterative plans, review findings, and assistant outputs for this project are recorded in the [`ai-chat-history/`](file:///C:/Users/ishit/OneDrive/Desktop/projects/leverage_assignment/ai-chat-history) directory:
- [Session History Transcript](file:///C:/Users/ishit/OneDrive/Desktop/projects/leverage_assignment/ai-chat-history/session-history.md) — complete turn-by-turn history of design choices, code diffs, and verification steps.
