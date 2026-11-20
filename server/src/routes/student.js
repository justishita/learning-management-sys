import { Router } from "express"
import prisma from "../db.js"
import { requireAuth } from "../middleware/auth.js"

const router = Router()

// -------------------------------------------------------------
// CATALOG & ENROLLMENT
// -------------------------------------------------------------

// Get all published courses
router.get("/courses", async (req, res) => {
  try {
    const userId = req.user?.id

    const courses = await prisma.course.findMany({
      where: { isPublished: true },
      include: {
        instructor: {
          select: { id: true, name: true, email: true },
        },
        modules: {
          orderBy: { position: "asc" },
          include: {
            _count: { select: { lessons: true } },
          },
        },
        enrollments: userId
          ? {
              where: { userId },
              select: { id: true },
            }
          : false,
      },
      orderBy: { createdAt: "desc" },
    })

    const formatted = courses.map((course) => {
      const totalLessons = course.modules.reduce(
        (acc, m) => acc + (m._count?.lessons || 0),
        0
      )
      return {
        id: course.id,
        title: course.title,
        description: course.description,
        isPublished: course.isPublished,
        instructor: course.instructor,
        modulesCount: course.modules.length,
        totalLessons,
        isEnrolled: Boolean(course.enrollments?.length > 0),
      }
    })

    return res.json({ courses: formatted })
  } catch (err) {
    console.error("Fetch published courses error:", err)
    return res.status(500).json({ error: "Failed to fetch courses" })
  }
})

// Enroll in a course (idempotent)
router.post("/courses/:id/enroll", requireAuth, async (req, res) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
    })

    if (!course) {
      return res.status(404).json({ error: "Course not found" })
    }

    if (!course.isPublished) {
      return res.status(400).json({ error: "Cannot enroll in an unpublished course" })
    }

    const enrollment = await prisma.enrollment.upsert({
      where: {
        userId_courseId: {
          userId: req.user.id,
          courseId: course.id,
        },
      },
      update: {},
      create: {
        userId: req.user.id,
        courseId: course.id,
      },
    })

    return res.status(201).json({ enrollment })
  } catch (err) {
    console.error("Enrollment error:", err)
    return res.status(500).json({ error: "Failed to enroll in course" })
  }
})

// My enrolled courses with progress % computed in one query
router.get("/student/enrolled", requireAuth, async (req, res) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: req.user.id },
      include: {
        course: {
          include: {
            instructor: {
              select: { id: true, name: true, email: true },
            },
            modules: {
              orderBy: { position: "asc" },
              include: {
                lessons: {
                  orderBy: { position: "asc" },
                  include: {
                    lessonProgress: {
                      where: { userId: req.user.id },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const enrolledCourses = enrollments.map((enr) => {
      const course = enr.course
      let totalLessons = 0
      let completedLessons = 0
      let firstIncompleteLessonId = null

      for (const mod of course.modules) {
        for (const lesson of mod.lessons) {
          totalLessons++
          const isCompleted = lesson.lessonProgress?.[0]?.isCompleted || false
          if (isCompleted) {
            completedLessons++
          } else if (!firstIncompleteLessonId) {
            firstIncompleteLessonId = lesson.id
          }
        }
      }

      const nextLessonId =
        firstIncompleteLessonId || course.modules[0]?.lessons[0]?.id || null

      const progressPercentage =
        totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

      return {
        enrollmentId: enr.id,
        enrolledAt: enr.createdAt,
        id: course.id,
        title: course.title,
        description: course.description,
        isPublished: course.isPublished,
        isTemporarilyUnavailable: !course.isPublished,
        instructor: course.instructor,
        totalLessons,
        completedLessons,
        progressPercentage,
        nextLessonId,
      }
    })

    return res.json({ enrolledCourses })
  } catch (err) {
    console.error("Fetch enrolled courses error:", err)
    return res.status(500).json({ error: "Failed to fetch enrolled courses" })
  }
})

// Course detail endpoint with per-lesson progress state
router.get("/courses/:id", async (req, res) => {
  try {
    const userId = req.user?.id

    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: {
        instructor: {
          select: { id: true, name: true, email: true },
        },
        modules: {
          orderBy: { position: "asc" },
          include: {
            lessons: {
              orderBy: { position: "asc" },
              include: userId
                ? {
                    lessonProgress: {
                      where: { userId },
                    },
                  }
                : false,
            },
            quiz: {
              select: { id: true, title: true },
            },
          },
        },
        enrollments: userId
          ? {
              where: { userId },
              select: { id: true },
            }
          : false,
      },
    })

    if (!course) {
      return res.status(404).json({ error: "Course not found" })
    }

    const isEnrolled = Boolean(course.enrollments?.length > 0)
    const isOwner = userId && course.instructorId === userId

    // Students only see published courses unless they are already enrolled
    if (!course.isPublished && !isEnrolled && !isOwner) {
      return res.status(404).json({ error: "Course is currently unavailable" })
    }

    let totalLessons = 0
    let completedLessons = 0
    let firstIncompleteLessonId = null

    const modulesWithProgress = course.modules.map((mod) => {
      const lessons = mod.lessons.map((lesson) => {
        totalLessons++
        const isCompleted = lesson.lessonProgress?.[0]?.isCompleted || false
        if (isCompleted) {
          completedLessons++
        } else if (!firstIncompleteLessonId) {
          firstIncompleteLessonId = lesson.id
        }

        return {
          id: lesson.id,
          title: lesson.title,
          type: lesson.type,
          level: lesson.level,
          position: lesson.position,
          isCompleted,
        }
      })

      return {
        id: mod.id,
        title: mod.title,
        position: mod.position,
        lessons,
        quiz: mod.quiz,
      }
    })

    const progressPercentage =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

    const nextLessonId =
      firstIncompleteLessonId || course.modules[0]?.lessons[0]?.id || null

    return res.json({
      course: {
        id: course.id,
        title: course.title,
        description: course.description,
        isPublished: course.isPublished,
        isTemporarilyUnavailable: !course.isPublished && isEnrolled,
        instructor: course.instructor,
        isEnrolled,
        totalLessons,
        completedLessons,
        progressPercentage,
        nextLessonId,
        modules: modulesWithProgress,
      },
    })
  } catch (err) {
    console.error("Fetch course detail error:", err)
    return res.status(500).json({ error: "Failed to fetch course details" })
  }
})

// -------------------------------------------------------------
// LESSON VIEWER & PROGRESS
// -------------------------------------------------------------

// Get single lesson details with navigation links & completion state
router.get("/lessons/:id", requireAuth, async (req, res) => {
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.id },
      include: {
        module: {
          include: {
            course: {
              include: {
                modules: {
                  orderBy: { position: "asc" },
                  include: {
                    lessons: {
                      orderBy: { position: "asc" },
                      select: {
                        id: true,
                        title: true,
                        type: true,
                        position: true,
                        lessonProgress: {
                          where: { userId: req.user.id },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        lessonProgress: {
          where: { userId: req.user.id },
        },
      },
    })

    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" })
    }

    const course = lesson.module.course

    // Check enrollment
    const isEnrolled = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: req.user.id,
          courseId: course.id,
        },
      },
    })

    const isOwner = course.instructorId === req.user.id
    if (!isEnrolled && !isOwner) {
      return res.status(403).json({ error: "Must be enrolled to access lesson" })
    }

    // Flatten all course lessons to compute prev/next
    const allLessons = []
    for (const m of course.modules) {
      for (const l of m.lessons) {
        allLessons.push(l)
      }
    }

    const currentIndex = allLessons.findIndex((l) => l.id === lesson.id)
    const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null
    const nextLesson =
      currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null

    const isCompleted = lesson.lessonProgress?.[0]?.isCompleted || false

    return res.json({
      lesson: {
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        content: lesson.content,
        videoUrl: lesson.videoUrl,
        level: lesson.level,
        keywords: lesson.keywords,
        position: lesson.position,
        isCompleted,
        moduleId: lesson.moduleId,
        courseId: course.id,
        courseTitle: course.title,
        isCoursePublished: course.isPublished,
        prevLessonId: prevLesson ? prevLesson.id : null,
        nextLessonId: nextLesson ? nextLesson.id : null,
      },
      courseModules: course.modules.map((m) => ({
        id: m.id,
        title: m.title,
        lessons: m.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          type: l.type,
          isCompleted: Boolean(l.lessonProgress?.[0]?.isCompleted),
        })),
      })),
    })
  } catch (err) {
    console.error("Fetch lesson error:", err)
    return res.status(500).json({ error: "Failed to fetch lesson" })
  }
})

// Toggle or set lesson completion (idempotent)
router.post("/lessons/:id/progress", requireAuth, async (req, res) => {
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.id },
      include: {
        module: {
          select: { courseId: true },
        },
      },
    })

    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" })
    }

    const isEnrolled = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: req.user.id,
          courseId: lesson.module.courseId,
        },
      },
    })

    if (!isEnrolled) {
      return res.status(403).json({ error: "Must be enrolled to mark progress" })
    }

    const current = await prisma.lessonProgress.findUnique({
      where: {
        userId_lessonId: {
          userId: req.user.id,
          lessonId: lesson.id,
        },
      },
    })

    const isCompleted =
      req.body.isCompleted !== undefined
        ? Boolean(req.body.isCompleted)
        : current
        ? !current.isCompleted
        : true

    const progress = await prisma.lessonProgress.upsert({
      where: {
        userId_lessonId: {
          userId: req.user.id,
          lessonId: lesson.id,
        },
      },
      update: {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
      create: {
        userId: req.user.id,
        lessonId: lesson.id,
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
    })

    return res.json({ progress })
  } catch (err) {
    console.error("Update progress error:", err)
    return res.status(500).json({ error: "Failed to update lesson progress" })
  }
})

export default router
