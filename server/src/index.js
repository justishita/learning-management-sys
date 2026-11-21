import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"
import authRouter from "./routes/auth.js"
import instructorRouter from "./routes/instructor.js"
import studentRouter from "./routes/student.js"
import quizRouter from "./routes/quiz.js"
import commentsRouter from "./routes/comments.js"
import { requireAuth, requireRole, optionalAuth } from "./middleware/auth.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()
dotenv.config({ path: path.resolve(__dirname, "../../.env") })

const app = express()
const PORT = process.env.PORT || 5000

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
)
app.use(express.json())
app.use(cookieParser())

// API routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user })
})

app.use("/api/auth", authRouter)
app.use("/api/instructor", requireAuth, requireRole("INSTRUCTOR"), instructorRouter)
app.use("/api", optionalAuth, studentRouter)
app.use("/api", quizRouter)
app.use("/api", commentsRouter)

// Serve client/dist with SPA fallback in production
const clientDistPath = path.resolve(__dirname, "../../client/dist")
app.use(express.static(clientDistPath))

// SPA Fallback for client-side routing
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API route not found" })
  }
  res.sendFile(path.join(clientDistPath, "index.html"), (err) => {
    if (err) {
      next()
    }
  })
})

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err)
  if (res.headersSent) {
    return next(err)
  }
  return res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  })
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
