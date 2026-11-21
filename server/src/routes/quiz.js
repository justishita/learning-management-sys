import { Router } from "express"
import prisma from "../db.js"
import { requireAuth, requireRole } from "../middleware/auth.js"
import {
  createQuizSchema,
  submitQuizSchema,
  autosaveAnswersSchema,
} from "../schemas/quiz.js"

const router = Router()

// Helper: Calculate score and update attempt
async function gradeAttempt(attempt, questions, answers, submittedTime) {
  let correctCount = 0
  const total = questions.length

  const finalAnswers = answers || attempt.answers || {}

  for (const q of questions) {
    const studentAnswer = finalAnswers[q.id]
    if (studentAnswer !== undefined && studentAnswer === q.correctIndex) {
      correctCount++
    }
  }

  const score = total > 0 ? Math.round((correctCount / total) * 100 * 10) / 10 : 0

  return prisma.quizAttempt.update({
    where: { id: attempt.id },
    data: {
      score,
      answers: finalAnswers,
      submittedAt: submittedTime,
    },
  })
}

// -------------------------------------------------------------
// INSTRUCTOR ROUTES
// -------------------------------------------------------------

// Create or update quiz on a module (moduleId unique)
router.post(
  "/instructor/modules/:moduleId/quiz",
  requireAuth,
  requireRole("INSTRUCTOR"),
  async (req, res) => {
    try {
      const parseResult = createQuizSchema.safeParse(req.body)
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { title, passMark, timeLimitMin, questions } = parseResult.data

      // Check module ownership
      const moduleRecord = await prisma.module.findFirst({
        where: {
          id: req.params.moduleId,
          course: { instructorId: req.user.id },
        },
      })

      if (!moduleRecord) {
        return res.status(404).json({ error: "Module not found or unauthorized" })
      }

      // Upsert quiz on module
      const quiz = await prisma.$transaction(async (tx) => {
        let q = await tx.quiz.findUnique({
          where: { moduleId: moduleRecord.id },
        })

        if (q) {
          q = await tx.quiz.update({
            where: { id: q.id },
            data: {
              title,
              passMark,
              timeLimitMin,
            },
          })
          await tx.question.deleteMany({
            where: { quizId: q.id },
          })
        } else {
          q = await tx.quiz.create({
            data: {
              title,
              passMark,
              timeLimitMin,
              moduleId: moduleRecord.id,
            },
          })
        }

        // Create 4-option questions
        await tx.question.createMany({
          data: questions.map((item, idx) => ({
            quizId: q.id,
            prompt: item.prompt,
            options: item.options,
            correctIndex: item.correctIndex,
            position: idx,
          })),
        })

        return tx.quiz.findUnique({
          where: { id: q.id },
          include: {
            questions: {
              orderBy: { position: "asc" },
            },
          },
        })
      })

      return res.status(201).json({ quiz })
    } catch (err) {
      console.error("Create quiz error:", err)
      return res.status(500).json({ error: "Failed to save quiz" })
    }
  }
)

// Get quiz for instructor
router.get(
  "/instructor/modules/:moduleId/quiz",
  requireAuth,
  requireRole("INSTRUCTOR"),
  async (req, res) => {
    try {
      const moduleRecord = await prisma.module.findFirst({
        where: {
          id: req.params.moduleId,
          course: { instructorId: req.user.id },
        },
      })

      if (!moduleRecord) {
        return res.status(404).json({ error: "Module not found or unauthorized" })
      }

      const quiz = await prisma.quiz.findUnique({
        where: { moduleId: moduleRecord.id },
        include: {
          questions: {
            orderBy: { position: "asc" },
          },
        },
      })

      return res.json({ quiz })
    } catch (err) {
      console.error("Get instructor quiz error:", err)
      return res.status(500).json({ error: "Failed to fetch quiz" })
    }
  }
)

// Delete quiz
router.delete(
  "/instructor/quizzes/:id",
  requireAuth,
  requireRole("INSTRUCTOR"),
  async (req, res) => {
    try {
      const quiz = await prisma.quiz.findFirst({
        where: {
          id: req.params.id,
          module: { course: { instructorId: req.user.id } },
        },
      })

      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found or unauthorized" })
      }

      await prisma.quiz.delete({
        where: { id: quiz.id },
      })

      return res.json({ message: "Quiz deleted successfully" })
    } catch (err) {
      console.error("Delete quiz error:", err)
      return res.status(500).json({ error: "Failed to delete quiz" })
    }
  }
)

// -------------------------------------------------------------
// STUDENT ROUTES
// -------------------------------------------------------------

// Get quiz for student (lazily grades if expired, never sends correctIndex before submittedAt)
router.get("/quizzes/:id", requireAuth, async (req, res) => {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
      include: {
        module: {
          include: {
            course: true,
          },
        },
        questions: {
          orderBy: { position: "asc" },
        },
      },
    })

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" })
    }

    const course = quiz.module.course

    // Check enrollment
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: req.user.id,
          courseId: course.id,
        },
      },
    })

    const isOwner = course.instructorId === req.user.id
    if (!enrollment && !isOwner) {
      return res.status(403).json({ error: "Must be enrolled to access quiz" })
    }

    // Instructor view
    if (isOwner) {
      return res.json({
        quiz: {
          id: quiz.id,
          title: quiz.title,
          passMark: quiz.passMark,
          timeLimitMin: quiz.timeLimitMin,
          moduleId: quiz.moduleId,
          courseId: course.id,
          courseTitle: course.title,
          questions: quiz.questions,
        },
      })
    }

    // Check student's attempt (UNIQUE userId + quizId)
    let attempt = await prisma.quizAttempt.findUnique({
      where: {
        userId_quizId: {
          userId: req.user.id,
          quizId: quiz.id,
        },
      },
    })

    // Lazy grading if timer expired and not yet marked submitted
    if (attempt && !attempt.submittedAt && new Date() > attempt.expiresAt) {
      attempt = await gradeAttempt(
        attempt,
        quiz.questions,
        attempt.answers,
        attempt.expiresAt
      )
    }

    const isSubmitted = Boolean(attempt?.submittedAt)

    // Redact correctIndex if not yet submitted
    const questionsForStudent = quiz.questions.map((q) => {
      const item = {
        id: q.id,
        prompt: q.prompt,
        options: q.options,
        position: q.position,
      }
      if (isSubmitted) {
        item.correctIndex = q.correctIndex
      }
      return item
    })

    return res.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        passMark: quiz.passMark,
        timeLimitMin: quiz.timeLimitMin,
        moduleId: quiz.moduleId,
        courseId: course.id,
        courseTitle: course.title,
        questions: questionsForStudent,
      },
      attempt: attempt
        ? {
            id: attempt.id,
            startedAt: attempt.startedAt,
            expiresAt: attempt.expiresAt,
            submittedAt: attempt.submittedAt,
            score: attempt.score,
            passed: attempt.score !== null ? attempt.score >= quiz.passMark : null,
            answers: attempt.answers || {},
          }
        : null,
    })
  } catch (err) {
    console.error("Get quiz error:", err)
    return res.status(500).json({ error: "Failed to fetch quiz" })
  }
})

// Start quiz attempt:
// Creates attempt with expiresAt = now + timeLimit and returns questions without correctIndex.
// Starting again after an attempt exists returns the existing attempt, never a new one.
router.post("/quizzes/:id/start", requireAuth, async (req, res) => {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
      include: {
        module: {
          select: { courseId: true },
        },
        questions: {
          orderBy: { position: "asc" },
        },
      },
    })

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" })
    }

    // Check enrollment
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: req.user.id,
          courseId: quiz.module.courseId,
        },
      },
    })

    if (!enrollment) {
      return res.status(403).json({ error: "Must be enrolled to take this quiz" })
    }

    // Check if attempt already exists
    let attempt = await prisma.quizAttempt.findUnique({
      where: {
        userId_quizId: {
          userId: req.user.id,
          quizId: quiz.id,
        },
      },
    })

    // If attempt exists, return it (never create a new one)
    if (attempt) {
      // Lazy grading check if expired
      if (!attempt.submittedAt && new Date() > attempt.expiresAt) {
        attempt = await gradeAttempt(
          attempt,
          quiz.questions,
          attempt.answers,
          attempt.expiresAt
        )
      }

      const isSubmitted = Boolean(attempt.submittedAt)
      const questionsForStudent = quiz.questions.map((q) => {
        const item = {
          id: q.id,
          prompt: q.prompt,
          options: q.options,
          position: q.position,
        }
        if (isSubmitted) {
          item.correctIndex = q.correctIndex
        }
        return item
      })

      return res.json({
        attempt: {
          id: attempt.id,
          startedAt: attempt.startedAt,
          expiresAt: attempt.expiresAt,
          submittedAt: attempt.submittedAt,
          score: attempt.score,
          passed: attempt.score !== null ? attempt.score >= quiz.passMark : null,
          answers: attempt.answers || {},
        },
        questions: questionsForStudent,
      })
    }

    // Create fresh attempt: expiresAt = now + timeLimitMin * 60s
    const durationMinutes = quiz.timeLimitMin || 10
    const startedAt = new Date()
    const expiresAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000)

    attempt = await prisma.quizAttempt.create({
      data: {
        userId: req.user.id,
        quizId: quiz.id,
        startedAt,
        expiresAt,
        answers: {},
      },
    })

    // Questions without correctIndex
    const questionsWithoutAnswers = quiz.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
      position: q.position,
    }))

    return res.status(201).json({
      attempt: {
        id: attempt.id,
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        submittedAt: attempt.submittedAt,
        score: attempt.score,
        passed: null,
        answers: {},
      },
      questions: questionsWithoutAnswers,
    })
  } catch (err) {
    console.error("Start quiz error:", err)
    return res.status(500).json({ error: "Failed to start quiz attempt" })
  }
})

// Autosave answers via PATCH
router.patch("/quizzes/:id/answers", requireAuth, async (req, res) => {
  try {
    const parseResult = autosaveAnswersSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      })
    }

    const { answers } = parseResult.data

    // Only fetch what we need — no questions, no correctIndex
    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        passMark: true,
        timeLimitMin: true,
        moduleId: true,
        module: { select: { courseId: true } },
      },
    })

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" })
    }

    // Enrollment check (fix #2)
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: req.user.id,
          courseId: quiz.module.courseId,
        },
      },
    })
    if (!enrollment) {
      return res.status(403).json({ error: "Must be enrolled to save quiz answers" })
    }

    let attempt = await prisma.quizAttempt.findUnique({
      where: {
        userId_quizId: {
          userId: req.user.id,
          quizId: quiz.id,
        },
      },
    })

    if (!attempt) {
      return res.status(400).json({ error: "No active attempt found" })
    }

    // If already submitted, cannot modify
    if (attempt.submittedAt) {
      return res.status(400).json({
        error: "Attempt is already submitted",
      })
    }

    const now = new Date()

    // Lazy grading if expired — load questions only here, and DO NOT return correctIndex
    if (now > attempt.expiresAt) {
      const questions = await prisma.question.findMany({
        where: { quizId: quiz.id },
      })
      const mergedAnswers = { ...(attempt.answers || {}), ...answers }
      const graded = await gradeAttempt(attempt, questions, mergedAnswers, attempt.expiresAt)
      return res.json({
        isExpired: true,
        attempt: {
          id: graded.id,
          startedAt: graded.startedAt,
          expiresAt: graded.expiresAt,
          submittedAt: graded.submittedAt,
          score: graded.score,
          passed: graded.score >= quiz.passMark,
          answers: graded.answers,
        },
        // correctIndex intentionally omitted — use GET /quizzes/:id after submission for review
      })
    }

    // Not expired: save answers
    const mergedAnswers = { ...(attempt.answers || {}), ...answers }
    const updated = await prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: { answers: mergedAnswers },
    })

    return res.json({
      success: true,
      answers: updated.answers,
    })
  } catch (err) {
    console.error("Autosave answers error:", err)
    return res.status(500).json({ error: "Failed to autosave answers" })
  }
})

// Submit quiz answers
router.post("/quizzes/:id/submit", requireAuth, async (req, res) => {
  try {
    const parseResult = submitQuizSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      })
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
      include: {
        module: { select: { courseId: true } },
        questions: {
          orderBy: { position: "asc" },
        },
      },
    })

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" })
    }

    // Enrollment check (fix #2)
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: req.user.id,
          courseId: quiz.module.courseId,
        },
      },
    })
    if (!enrollment) {
      return res.status(403).json({ error: "Must be enrolled to submit this quiz" })
    }

    let attempt = await prisma.quizAttempt.findUnique({
      where: {
        userId_quizId: {
          userId: req.user.id,
          quizId: quiz.id,
        },
      },
    })

    if (!attempt) {
      return res.status(400).json({ error: "No active attempt found. Start the quiz first." })
    }

    // If already submitted, return graded attempt + correctIndex for review
    if (attempt.submittedAt) {
      return res.json({
        attempt: {
          id: attempt.id,
          startedAt: attempt.startedAt,
          expiresAt: attempt.expiresAt,
          submittedAt: attempt.submittedAt,
          score: attempt.score,
          answers: attempt.answers,
          passed: attempt.score !== null ? attempt.score >= quiz.passMark : null,
        },
        questions: quiz.questions, // correctIndex included post-submission
      })
    }

    const now = new Date()
    const isExpired = now > attempt.expiresAt
    const submissionTime = isExpired ? attempt.expiresAt : now

    const submittedAnswers = parseResult.data.answers
      ? { ...(attempt.answers || {}), ...parseResult.data.answers }
      : attempt.answers || {}

    const updatedAttempt = await gradeAttempt(
      attempt,
      quiz.questions,
      submittedAnswers,
      submissionTime
    )

    return res.json({
      attempt: {
        id: updatedAttempt.id,
        startedAt: updatedAttempt.startedAt,
        expiresAt: updatedAttempt.expiresAt,
        submittedAt: updatedAttempt.submittedAt,
        score: updatedAttempt.score,
        answers: updatedAttempt.answers,
        passed: updatedAttempt.score >= quiz.passMark,
      },
      isExpired,
      questions: quiz.questions, // correctIndex included — this is the review response
    })
  } catch (err) {
    console.error("Submit quiz error:", err)
    return res.status(500).json({ error: "Failed to submit quiz" })
  }
})

export default router
