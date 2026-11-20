import { z } from "zod"

export const tutorRequestSchema = z.object({
  explanation: z
    .string()
    .trim()
    .min(1, "Explanation cannot be empty")
    .max(1500, "Explanation cannot exceed 1500 characters"),
})

export const tutorCorrectionSchema = z.object({
  claim: z.string().trim(),
  issue: z.string().trim(),
  fix: z.string().trim(),
})

export const tutorQuizQuestionSchema = z.object({
  prompt: z.string().trim(),
  options: z.array(z.string().trim()).min(2),
  correctIndex: z.number().int().min(0),
  explanation: z.string().trim(),
})

export const tutorResponseSchema = z.object({
  score: z.number().min(0).max(100),
  understood: z.array(z.string().trim()),
  gaps: z.array(z.string().trim()),
  corrections: z.array(tutorCorrectionSchema),
  quiz: z.array(tutorQuizQuestionSchema).length(5, "Quiz must contain exactly 5 questions"),
})
