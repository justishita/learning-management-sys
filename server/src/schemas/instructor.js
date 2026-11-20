import { z } from "zod"

export function formatYoutubeEmbedUrl(url) {
  if (!url) return null
  const trimmed = String(url).trim()
  if (!trimmed) return null
  if (trimmed.includes("youtube.com/embed/")) {
    return trimmed
  }
  const match = trimmed.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
  )
  if (match && match[1]) {
    return `https://www.youtube.com/embed/${match[1]}`
  }
  return trimmed
}

export const createCourseSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional().nullable(),
})

export const updateCourseSchema = z.object({
  title: z.string().trim().min(1, "Title cannot be empty").optional(),
  description: z.string().trim().optional().nullable(),
  isPublished: z.boolean().optional(),
})

export const publishCourseSchema = z.object({
  isPublished: z.boolean().optional(),
})

export const createModuleSchema = z.object({
  title: z.string().trim().min(1, "Module title is required"),
  position: z.number().int().min(0).optional(),
})

export const updateModuleSchema = z.object({
  title: z.string().trim().min(1, "Module title cannot be empty").optional(),
  position: z.number().int().min(0).optional(),
})

export const createLessonSchema = z
  .object({
    title: z.string().trim().min(1, "Lesson title is required"),
    type: z.enum(["TEXT", "VIDEO"], {
      errorMap: () => ({ message: "Type must be TEXT or VIDEO" }),
    }),
    content: z.string().optional().nullable(),
    videoUrl: z.string().trim().optional().nullable(),
    level: z.string().trim().optional().nullable(),
    keywords: z.union([z.array(z.string()), z.string()]).optional().nullable(),
    aiContext: z.string().optional().nullable(),
    position: z.number().int().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "VIDEO" && !data.videoUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["videoUrl"],
        message: "videoUrl is required for VIDEO lessons",
      })
    }
  })

export const updateLessonSchema = z.object({
  title: z.string().trim().min(1, "Lesson title cannot be empty").optional(),
  type: z.enum(["TEXT", "VIDEO"]).optional(),
  content: z.string().optional().nullable(),
  videoUrl: z.string().trim().optional().nullable(),
  level: z.string().trim().optional().nullable(),
  keywords: z.union([z.array(z.string()), z.string()]).optional().nullable(),
  aiContext: z.string().optional().nullable(),
  position: z.number().int().min(0).optional(),
})
