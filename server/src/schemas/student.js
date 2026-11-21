import { z } from "zod"

export const updateProgressSchema = z.object({
  isCompleted: z.boolean({
    required_error: "isCompleted is required",
    invalid_type_error: "isCompleted must be a boolean",
  }).optional(),
})
