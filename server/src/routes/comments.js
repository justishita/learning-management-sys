import { Router } from "express"
import prisma from "../db.js"
import { requireAuth } from "../middleware/auth.js"
import { createCommentSchema } from "../schemas/comment.js"

const router = Router()

// List comments for a lesson (paginated, newest first)
router.get("/lessons/:id/comments", requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10))
    const skip = (page - 1) * limit

    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.id },
      include: {
        module: {
          select: {
            courseId: true,
            course: {
              select: { instructorId: true, isPublished: true },
            },
          },
        },
      },
    })

    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" })
    }

    const course = lesson.module.course
    const isInstructor = course.instructorId === req.user.id

    if (!isInstructor) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: req.user.id,
            courseId: lesson.module.courseId,
          },
        },
      })
      if (!enrollment) {
        return res.status(403).json({ error: "Must be enrolled to view comments" })
      }
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

    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.id },
      include: {
        module: {
          select: {
            courseId: true,
            course: {
              select: { instructorId: true },
            },
          },
        },
      },
    })

    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" })
    }

    const course = lesson.module.course
    const isInstructor = course.instructorId === req.user.id

    if (!isInstructor) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: req.user.id,
            courseId: lesson.module.courseId,
          },
        },
      })
      if (!enrollment) {
        return res.status(403).json({ error: "Must be enrolled to post comments" })
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content: parseResult.data.content,
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
