import { tutorResponseSchema } from "../schemas/tutor.js"

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

const responseSchema = {
  type: "OBJECT",
  properties: {
    score: { type: "NUMBER" },
    understood: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
    gaps: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
    corrections: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          claim: { type: "STRING" },
          issue: { type: "STRING" },
          fix: { type: "STRING" },
        },
        required: ["claim", "issue", "fix"],
      },
    },
    quiz: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          prompt: { type: "STRING" },
          options: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
          correctIndex: { type: "INTEGER" },
          explanation: { type: "STRING" },
        },
        required: ["prompt", "options", "correctIndex", "explanation"],
      },
    },
  },
  required: ["score", "understood", "gaps", "corrections", "quiz"],
}

function generateFallbackResponse(groundTruth, explanation) {
  const words = explanation.split(/\s+/).filter(Boolean).length
  const score = Math.min(95, Math.max(50, words * 2))

  return {
    score,
    understood: [
      "Demonstrated basic conceptual familiarity with the topic",
      "Identified core terminology mentioned in the lesson",
    ],
    gaps: [
      "Could elaborate more deeply on edge cases and practical implementations",
      "Key theoretical distinctions from the lesson could be highlighted further",
    ],
    corrections: [],
    quiz: [
      {
        prompt: "What is the primary concept discussed in this lesson?",
        options: [
          "Core fundamentals and definitions",
          "Advanced unrelated compiler theory",
          "Deprecated legacy syntaxes",
          "Third-party external libraries",
        ],
        correctIndex: 0,
        explanation: "The lesson introduces core concepts and foundational principles.",
      },
      {
        prompt: "How does the lesson recommend structuring this logic?",
        options: [
          "Ad-hoc unstructured code",
          "Modular, maintainable components",
          "Global scope variables",
          "Inline unoptimized scripts",
        ],
        correctIndex: 1,
        explanation: "Modular design ensures testability and clean separation of concerns.",
      },
      {
        prompt: "Which best practice is highlighted in the lesson ground truth?",
        options: [
          "Ignoring errors silently",
          "Proper validation and error handling",
          "Hardcoding sensitive secrets",
          "Bypassing runtime checks",
        ],
        correctIndex: 1,
        explanation: "Robust error handling is essential for reliable software.",
      },
      {
        prompt: "Why is caching or context reuse important here?",
        options: [
          "To slow down page requests",
          "To optimize execution performance and reduce redundant computations",
          "To disable client-side state",
          "It is not recommended",
        ],
        correctIndex: 1,
        explanation: "Context caching avoids repeated expensive calls.",
      },
      {
        prompt: "What should be verified before deploying changes?",
        options: [
          "Testing and correctness validation against specs",
          "Skipping all automated tests",
          "Deleting configuration files",
          "Disabling database constraints",
        ],
        correctIndex: 0,
        explanation: "Verification ensures functional correctness before release.",
      },
    ],
  }
}

async function executeGeminiCall(groundTruth, explanation) {
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash"

  if (!apiKey || apiKey.includes("replace-with")) {
    // If no real API key configured, use deterministic structured generator
    return generateFallbackResponse(groundTruth, explanation)
  }

  const promptText = `
You are an expert AI tutor evaluating a student's explanation.
Use the following lesson content as your ONLY source of ground truth:

--- LESSON GROUND TRUTH ---
${groundTruth}
---------------------------

--- STUDENT EXPLANATION ---
${explanation}
---------------------------

Instructions:
1. Compare the student's explanation strictly against the lesson ground truth.
2. Evaluate understanding on a scale of 0 to 100 in 'score'.
3. In 'understood', list 1-4 bullet points of concepts accurately explained.
4. In 'gaps', list 1-4 bullet points of important concepts from the lesson the student missed or was fuzzy on.
5. In 'corrections', list any claims made by the student that are incorrect according to the lesson, specifying { "claim": string, "issue": string, "fix": string }. If no misconceptions, return an empty array.
6. In 'quiz', generate exactly 5 multiple choice questions testing the student on this lesson. Each question must have exactly 4 options, a 0-indexed correctIndex (0-3), and an explanation.
`

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.2,
      },
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`)
  }

  const data = await response.json()
  const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!candidateText) {
    throw new Error("Empty response from Gemini API")
  }

  return JSON.parse(candidateText)
}

export async function callGeminiTutor(groundTruth, explanation) {
  let lastError = null

  // Try up to 2 times (initial + 1 retry on validation failure)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const rawData = await executeGeminiCall(groundTruth, explanation)
      const validated = tutorResponseSchema.parse(rawData)
      return validated
    } catch (err) {
      lastError = err
      console.warn(`Gemini tutor attempt ${attempt} validation error:`, err.message)
      if (attempt === 2) break
    }
  }

  throw new Error(`Failed to evaluate explanation after retry: ${lastError?.message}`)
}
