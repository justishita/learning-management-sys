# LMS: project rules (read this before every task)
Stack: monorepo. /client = React+Vite (JS, .jsx) + Tailwind + shadcn/ui (JS mode).
/server = Node + Express (ESM, "type":"module") + Prisma + Postgres (Neon).
Express serves the built client. One deploy on Render. No server build step.
Auth: email+password (bcrypt), JWT in httpOnly cookie, role in token. Zod on all inputs.
Rules:
- Signup = STUDENT only. Instructor needs INSTRUCTOR_INVITE_CODE env.
- Students only see PUBLISHED courses. Unpublish hides from everyone; never delete enrolments/progress.
- Instructors only touch their own courses/students.
- Progress % = completed lessons / total lessons, computed on read. Soft lesson ordering.
- Quiz: one attempt per student (UNIQUE userId+quizId). Server-side timer: expiresAt; grade lazily if expired. Never send correctIndex before submittedAt.
- Comments: flat, plain text, author or course instructor can delete.
- AI: Gemini JSON mode, one call, no chat history. Max 1500 chars input, 10 calls/user/day. Video lessons use cached Lesson.aiContext.
- Avoid N+1. Instructor dashboard = one aggregate query.
Working style: show a short plan (max 8 lines), wait for "go". Output only changed files/diffs. Keep answers short.