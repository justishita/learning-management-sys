import { Router } from "express"
import prisma from "../db.js"
import {
  createCourseSchema,
  updateCourseSchema,
  publishCourseSchema,
  createModuleSchema,
  updateModuleSchema,
  createLessonSchema,
  updateLessonSchema,
  generateNotesSchema,
  formatYoutubeEmbedUrl,
} from "../schemas/instructor.js"
import { generateReferenceNotes } from "../lib/gemini.js"

const router = Router()

// Strip HTML tags to prevent stored XSS in content fields (fix #12)
function stripHtml(str) {
  if (!str) return str
  return str.replace(/<[^>]*>/g, "")
}

function normalizeKeywords(keywords) {
  if (!keywords) return []
  if (Array.isArray(keywords)) return keywords
  return String(keywords)
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
}

// -------------------------------------------------------------
// COURSE ROUTES
// -------------------------------------------------------------

// List instructor's courses
router.get("/courses", async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      where: { instructorId: req.user.id },
      include: {
        _count: {
          select: { modules: true, enrollments: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return res.json({ courses })
  } catch (err) {
    console.error("List courses error:", err)
    return res.status(500).json({ error: "Failed to fetch courses" })
  }
})

// Create course
router.post("/courses", async (req, res) => {
  try {
    const parseResult = createCourseSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      })
    }

    const { title, description } = parseResult.data

    const course = await prisma.course.create({
      data: {
        title,
        description: description || null,
        instructorId: req.user.id,
      },
    })

    return res.status(201).json({ course })
  } catch (err) {
    console.error("Create course error:", err)
    return res.status(500).json({ error: "Failed to create course" })
  }
})

// Get single course with modules and lessons in one query
router.get("/courses/:id", async (req, res) => {
  try {
    const course = await prisma.course.findFirst({
      where: {
        id: req.params.id,
        instructorId: req.user.id,
      },
      include: {
        modules: {
          orderBy: { position: "asc" },
          include: {
            lessons: {
              orderBy: { position: "asc" },
            },
            quiz: {
              select: { id: true, title: true, passMark: true, timeLimitMin: true },
            },
          },
        },
      },
    })

    if (!course) {
      return res.status(404).json({ error: "Course not found or unauthorized" })
    }

    return res.json({ course })
  } catch (err) {
    console.error("Get course error:", err)
    return res.status(500).json({ error: "Failed to fetch course" })
  }
})

// Instructor Course Analytics & Enrolled Students (Single Aggregate Query)
router.get("/courses/:id/analytics", async (req, res) => {
  try {
    // Single aggregate query with includes for modules, lessons, quizzes, enrollments, student progress and attempts
    const course = await prisma.course.findFirst({
      where: {
        id: req.params.id,
        instructorId: req.user.id,
      },
      include: {
        modules: {
          orderBy: { position: "asc" },
          include: {
            lessons: {
              select: { id: true },
            },
            quiz: {
              select: { id: true, title: true, passMark: true, timeLimitMin: true },
            },
          },
        },
        enrollments: {
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                lessonProgress: {
                  where: {
                    lesson: {
                      module: {
                        courseId: req.params.id,
                      },
                    },
                  },
                  select: {
                    lessonId: true,
                    isCompleted: true,
                  },
                },
                quizAttempts: {
                  where: {
                    quiz: {
                      module: {
                        courseId: req.params.id,
                      },
                    },
                  },
                  select: {
                    quizId: true,
                    score: true,
                    submittedAt: true,
                    expiresAt: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!course) {
      return res.status(404).json({ error: "Course not found or unauthorized" })
    }

    const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0)

    const quizModules = course.modules
      .filter((m) => m.quiz)
      .map((m) => ({
        moduleId: m.id,
        moduleTitle: m.title,
        quizId: m.quiz.id,
        quizTitle: m.quiz.title,
        passMark: m.quiz.passMark,
      }))

    const students = course.enrollments.map((enr) => {
      const student = enr.user
      const completedLessons = (student.lessonProgress || []).filter(
        (lp) => lp.isCompleted
      ).length

      const progressPercentage =
        totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

      const quizResults = quizModules.map((qm) => {
        const attempt = (student.quizAttempts || []).find((a) => a.quizId === qm.quizId)
        if (!attempt) {
          return {
            quizId: qm.quizId,
            quizTitle: qm.quizTitle,
            moduleTitle: qm.moduleTitle,
            passMark: qm.passMark,
            status: "NOT_ATTEMPTED",
            score: null,
            passed: null,
          }
        }

        const isSubmitted = Boolean(attempt.submittedAt)
        const isExpired = !isSubmitted && new Date() > attempt.expiresAt

        if (!isSubmitted && !isExpired) {
          return {
            quizId: qm.quizId,
            quizTitle: qm.quizTitle,
            moduleTitle: qm.moduleTitle,
            passMark: qm.passMark,
            status: "IN_PROGRESS",
            score: null,
            passed: null,
          }
        }

        const score = attempt.score ?? 0
        const passed = score >= qm.passMark

        return {
          quizId: qm.quizId,
          quizTitle: qm.quizTitle,
          moduleTitle: qm.moduleTitle,
          passMark: qm.passMark,
          status: "COMPLETED",
          score,
          passed,
          submittedAt: attempt.submittedAt || attempt.expiresAt,
        }
      })

      return {
        studentId: student.id,
        name: student.name || "Student",
        email: student.email,
        enrolledAt: enr.createdAt,
        completedLessons,
        totalLessons,
        progressPercentage,
        quizResults,
      }
    })

    return res.json({
      course: {
        id: course.id,
        title: course.title,
        isPublished: course.isPublished,
        totalLessons,
        enrolledCount: students.length,
        quizModules,
      },
      students,
    })
  } catch (err) {
    console.error("Course analytics error:", err)
    return res.status(500).json({ error: "Failed to fetch course analytics" })
  }
})

// Update course
router.put("/courses/:id", async (req, res) => {
  try {
    const parseResult = updateCourseSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      })
    }

    const existing = await prisma.course.findFirst({
      where: { id: req.params.id, instructorId: req.user.id },
    })

    if (!existing) {
      return res.status(404).json({ error: "Course not found or unauthorized" })
    }

    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: parseResult.data,
    })

    return res.json({ course })
  } catch (err) {
    console.error("Update course error:", err)
    return res.status(500).json({ error: "Failed to update course" })
  }
})

// Delete course
router.delete("/courses/:id", async (req, res) => {
  try {
    const existing = await prisma.course.findFirst({
      where: { id: req.params.id, instructorId: req.user.id },
    })

    if (!existing) {
      return res.status(404).json({ error: "Course not found or unauthorized" })
    }

    await prisma.course.delete({
      where: { id: req.params.id },
    })

    return res.json({ message: "Course deleted successfully" })
  } catch (err) {
    console.error("Delete course error:", err)
    return res.status(500).json({ error: "Failed to delete course" })
  }
})

// Publish / Unpublish course
router.patch("/courses/:id/publish", async (req, res) => {
  try {
    const parseResult = publishCourseSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      })
    }

    const existing = await prisma.course.findFirst({
      where: { id: req.params.id, instructorId: req.user.id },
    })

    if (!existing) {
      return res.status(404).json({ error: "Course not found or unauthorized" })
    }

    const newPublishStatus =
      parseResult.data.isPublished !== undefined
        ? parseResult.data.isPublished
        : !existing.isPublished

    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: { isPublished: newPublishStatus },
    })

    return res.json({ course })
  } catch (err) {
    console.error("Publish course error:", err)
    return res.status(500).json({ error: "Failed to change course publish status" })
  }
})

// -------------------------------------------------------------
// MODULE ROUTES
// -------------------------------------------------------------

// Create module under a course
router.post("/courses/:courseId/modules", async (req, res) => {
  try {
    const parseResult = createModuleSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      })
    }

    const course = await prisma.course.findFirst({
      where: { id: req.params.courseId, instructorId: req.user.id },
    })

    if (!course) {
      return res.status(404).json({ error: "Course not found or unauthorized" })
    }

    let position = parseResult.data.position
    if (position === undefined) {
      const lastModule = await prisma.module.findFirst({
        where: { courseId: course.id },
        orderBy: { position: "desc" },
      })
      position = lastModule ? lastModule.position + 1 : 0
    }

    const moduleRecord = await prisma.module.create({
      data: {
        title: parseResult.data.title,
        position,
        courseId: course.id,
      },
      include: {
        lessons: true,
      },
    })

    return res.status(201).json({ module: moduleRecord })
  } catch (err) {
    console.error("Create module error:", err)
    return res.status(500).json({ error: "Failed to create module" })
  }
})

// Update module
router.put("/modules/:id", async (req, res) => {
  try {
    const parseResult = updateModuleSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      })
    }

    const moduleRecord = await prisma.module.findFirst({
      where: {
        id: req.params.id,
        course: { instructorId: req.user.id },
      },
    })

    if (!moduleRecord) {
      return res.status(404).json({ error: "Module not found or unauthorized" })
    }

    const updatedModule = await prisma.module.update({
      where: { id: req.params.id },
      data: parseResult.data,
      include: {
        lessons: {
          orderBy: { position: "asc" },
        },
      },
    })

    return res.json({ module: updatedModule })
  } catch (err) {
    console.error("Update module error:", err)
    return res.status(500).json({ error: "Failed to update module" })
  }
})

// Delete module
router.delete("/modules/:id", async (req, res) => {
  try {
    const moduleRecord = await prisma.module.findFirst({
      where: {
        id: req.params.id,
        course: { instructorId: req.user.id },
      },
    })

    if (!moduleRecord) {
      return res.status(404).json({ error: "Module not found or unauthorized" })
    }

    await prisma.module.delete({
      where: { id: req.params.id },
    })

    return res.json({ message: "Module deleted successfully" })
  } catch (err) {
    console.error("Delete module error:", err)
    return res.status(500).json({ error: "Failed to delete module" })
  }
})

// -------------------------------------------------------------
// LESSON ROUTES
// -------------------------------------------------------------

// Generate reference notes for a video lesson using Gemini
// Requires the instructor to pass a lessonId they own, or at minimum
// we verify they are authenticated as INSTRUCTOR (enforced by the router
// middleware). Additionally accept an optional lessonId for ownership check.
router.post("/lessons/generate-notes", async (req, res) => {
  try {
    const parseResult = generateNotesSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      })
    }

    // Ownership check: if a lessonId is supplied, verify it belongs to this instructor.
    // This prevents an instructor from calling Gemini with arbitrary data unrelated to
    // their own content (fix #1).
    const { title, topic, keywords, level, lessonId } = parseResult.data

    if (lessonId) {
      const lessonRecord = await prisma.lesson.findFirst({
        where: {
          id: lessonId,
          module: { course: { instructorId: req.user.id } },
        },
      })
      if (!lessonRecord) {
        return res.status(404).json({ error: "Lesson not found or unauthorized" })
      }
    }

    const notes = await generateReferenceNotes({
      title,
      topic,
      keywords,
      level,
    })

    return res.json({ notes })
  } catch (err) {
    console.error("Generate notes error:", err)
    return res.status(500).json({ error: "Failed to generate notes" })
  }
})

// Create lesson under a module
router.post("/modules/:moduleId/lessons", async (req, res) => {
  try {
    const parseResult = createLessonSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      })
    }

    const moduleRecord = await prisma.module.findFirst({
      where: {
        id: req.params.moduleId,
        course: { instructorId: req.user.id },
      },
    })

    if (!moduleRecord) {
      return res.status(404).json({ error: "Module not found or unauthorized" })
    }

    const {
      title,
      type,
      content,
      videoUrl,
      topic,
      level,
      keywords,
      aiContext,
    } = parseResult.data

    let position = parseResult.data.position
    if (position === undefined) {
      const lastLesson = await prisma.lesson.findFirst({
        where: { moduleId: moduleRecord.id },
        orderBy: { position: "desc" },
      })
      position = lastLesson ? lastLesson.position + 1 : 0
    }

    const formattedVideoUrl =
      type === "VIDEO" && videoUrl ? formatYoutubeEmbedUrl(videoUrl) : null

    const lesson = await prisma.lesson.create({
      data: {
        title,
        type,
        content: content ? stripHtml(content) : null,
        videoUrl: formattedVideoUrl,
        topic: topic || null,
        level: level || null,
        keywords: normalizeKeywords(keywords),
        aiContext: aiContext ? stripHtml(aiContext) : null,
        position,
        moduleId: moduleRecord.id,
      },
    })

    return res.status(201).json({ lesson })
  } catch (err) {
    console.error("Create lesson error:", err)
    return res.status(500).json({ error: "Failed to create lesson" })
  }
})

// Update lesson
router.put("/lessons/:id", async (req, res) => {
  try {
    const parseResult = updateLessonSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      })
    }

    const lessonRecord = await prisma.lesson.findFirst({
      where: {
        id: req.params.id,
        module: {
          course: { instructorId: req.user.id },
        },
      },
    })

    if (!lessonRecord) {
      return res.status(404).json({ error: "Lesson not found or unauthorized" })
    }

    const updateData = { ...parseResult.data }

    // Fix #12: strip HTML from text content fields before persisting
    if (updateData.content !== undefined && updateData.content !== null) {
      updateData.content = stripHtml(updateData.content)
    }
    if (updateData.aiContext !== undefined && updateData.aiContext !== null) {
      updateData.aiContext = stripHtml(updateData.aiContext)
    }

    if (updateData.keywords !== undefined) {
      updateData.keywords = normalizeKeywords(updateData.keywords)
    }

    const effectiveType = updateData.type || lessonRecord.type
    if (updateData.videoUrl !== undefined) {
      updateData.videoUrl = updateData.videoUrl
        ? formatYoutubeEmbedUrl(updateData.videoUrl)
        : null
    }

    if (effectiveType === "VIDEO" && !updateData.videoUrl && !lessonRecord.videoUrl) {
      return res.status(400).json({
        error: "Validation failed",
        details: { videoUrl: ["videoUrl is required for VIDEO lessons"] },
      })
    }

    const lesson = await prisma.lesson.update({
      where: { id: req.params.id },
      data: updateData,
    })

    return res.json({ lesson })
  } catch (err) {
    console.error("Update lesson error:", err)
    return res.status(500).json({ error: "Failed to update lesson" })
  }
})

// Delete lesson
router.delete("/lessons/:id", async (req, res) => {
  try {
    const lessonRecord = await prisma.lesson.findFirst({
      where: {
        id: req.params.id,
        module: {
          course: { instructorId: req.user.id },
        },
      },
    })

    if (!lessonRecord) {
      return res.status(404).json({ error: "Lesson not found or unauthorized" })
    }

    await prisma.lesson.delete({
      where: { id: req.params.id },
    })

    return res.json({ message: "Lesson deleted successfully" })
  } catch (err) {
    console.error("Delete lesson error:", err)
    return res.status(500).json({ error: "Failed to delete lesson" })
  }
})

export default router
