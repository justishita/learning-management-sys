import { z } from "zod"

export const questionSchema = z.object({
  id: z.string().optional(),
  prompt: z.string().trim().min(1, "Question prompt is required"),
  options: z
    .array(z.string().trim().min(1, "Option text is required"))
    .length(4, "Question must have exactly 4 options"),
  correctIndex: z
    .number()
    .int()
    .min(0, "Invalid correct index")
    .max(3, "Correct index must be between 0 and 3"),
})

export const createQuizSchema = z.object({
  title: z.string().trim().min(1, "Quiz title is required"),
  passMark: z.number().int().min(1, "Pass mark must be at least 1").max(100, "Pass mark max is 100").default(70),
  timeLimitMin: z.number().int().min(1, "Time limit must be at least 1 minute").max(180, "Time limit max is 180 minutes").default(10),
  questions: z.array(questionSchema).min(1, "Quiz must contain at least 1 question"),
})

export const autosaveAnswersSchema = z.object({
  answers: z.record(z.string(), z.number().int().min(0).max(3)),
})

export const submitQuizSchema = z.object({
  answers: z.record(z.string(), z.number().int().min(0).max(3)).optional(),
})
