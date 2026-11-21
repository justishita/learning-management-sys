import { Router } from "express"
import prisma from "../db.js"
import { requireAuth } from "../middleware/auth.js"
import { createCommentSchema } from "../schemas/comment.js"
import { z } from "zod"

const router = Router()

// Issue #6: Zod schema for pagination query params
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

// Issue #11: strip HTML tags to prevent stored XSS even if frontend rendering changes
function stripHtml(str) {
  return str.replace(/<[^>]*>/g, "")
}

// Issue #9: single query that checks lesson + enrollment in one round-trip
async function getLessonWithAccess(lessonId, userId) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: {
        select: {
          courseId: true,
          course: {
            select: {
              instructorId: true,
              isPublished: true,
              enrollments: {
                where: { userId },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  })

  if (!lesson) return { lesson: null, hasAccess: false }

  const course = lesson.module.course
  const isInstructor = course.instructorId === userId
  const isEnrolled = course.enrollments.length > 0

  return { lesson, course, hasAccess: isInstructor || isEnrolled, isInstructor }
}

// List comments for a lesson (paginated, newest first)
router.get("/lessons/:id/comments", requireAuth, async (req, res) => {
  try {
    // Fix #6: validate query params with Zod
    const paginationResult = paginationSchema.safeParse(req.query)
    if (!paginationResult.success) {
      return res.status(400).json({
        error: "Invalid pagination params",
        details: paginationResult.error.flatten().fieldErrors,
      })
    }

    const { page, limit } = paginationResult.data
    const skip = (page - 1) * limit

    // Fix #9: single query for lesson + access check
    const { lesson, course, hasAccess } = await getLessonWithAccess(
      req.params.id,
      req.user.id
    )

    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" })
    }

    if (!hasAccess) {
      return res.status(403).json({ error: "Must be enrolled to view comments" })
    }

    const [total, comments] = await Promise.all([
      prisma.comment.count({
        where: { lessonId: req.params.id },
      }),
      prisma.comment.findMany({
        where: { lessonId: req.params.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, role: true },
          },
        },
      }),
    ])

    return res.json({
      comments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      courseInstructorId: course.instructorId,
    })
  } catch (err) {
    console.error("List comments error:", err)
    return res.status(500).json({ error: "Failed to fetch comments" })
  }
})

// Post a comment on a lesson
router.post("/lessons/:id/comments", requireAuth, async (req, res) => {
  try {
    const parseResult = createCommentSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      })
    }

    // Fix #9: single query for lesson + access check
    const { lesson, hasAccess } = await getLessonWithAccess(
      req.params.id,
      req.user.id
    )

    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" })
    }

    if (!hasAccess) {
      return res.status(403).json({ error: "Must be enrolled to post comments" })
    }

    // Fix #11: strip HTML tags before storing
    const sanitisedContent = stripHtml(parseResult.data.content)
    if (!sanitisedContent.trim()) {
      return res.status(400).json({ error: "Comment content cannot be empty after sanitisation" })
    }

    const comment = await prisma.comment.create({
      data: {
        content: sanitisedContent,
        userId: req.user.id,
        lessonId: lesson.id,
      },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    })

    return res.status(201).json({ comment })
  } catch (err) {
    console.error("Post comment error:", err)
    return res.status(500).json({ error: "Failed to post comment" })
  }
})

// Delete a comment (author or course instructor)
router.delete("/comments/:id", requireAuth, async (req, res) => {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: req.params.id },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                course: {
                  select: { instructorId: true },
                },
              },
            },
          },
        },
      },
    })

    if (!comment) {
      return res.status(404).json({ error: "Comment not found" })
    }

    const isAuthor = comment.userId === req.user.id
    const isCourseInstructor =
      comment.lesson?.module?.course?.instructorId === req.user.id

    if (!isAuthor && !isCourseInstructor) {
      return res.status(403).json({
        error: "You are not authorized to delete this comment",
      })
    }

    await prisma.comment.delete({
      where: { id: req.params.id },
    })

    return res.json({
      message: "Comment deleted successfully",
      commentId: req.params.id,
    })
  } catch (err) {
    console.error("Delete comment error:", err)
    return res.status(500).json({ error: "Failed to delete comment" })
  }
})

export default router
