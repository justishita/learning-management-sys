import { useState, useEffect, useRef } from "react"
import { useParams, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

export default function QuizTaker() {
  const { id: quizId } = useParams()

  const [quiz, setQuiz] = useState(null)
  const [attempt, setAttempt] = useState(null)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [saveStatus, setSaveStatus] = useState("idle") // "idle" | "saving" | "saved" | "error"
  const [timeLeft, setTimeLeft] = useState(null)
  const [error, setError] = useState("")

  const autosaveTimeoutRef = useRef(null)

  const fetchQuiz = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/quizzes/${quizId}`, { credentials: "include" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to load quiz")
      }
      const data = await res.json()
      setQuiz(data.quiz)
      setAttempt(data.attempt)
      if (data.attempt?.answers) {
        setAnswers(data.attempt.answers)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuiz()
  }, [quizId])

  // Display countdown timer (Server is the authority)
  useEffect(() => {
    if (!attempt || attempt.submittedAt || !attempt.expiresAt) return

    const calculateRemaining = () => {
      const remainingSec = Math.max(
        0,
        Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000)
      )
      setTimeLeft(remainingSec)

      // When local display hits 0, trigger submit to trigger server lazy grade
      if (remainingSec <= 0 && !submitting) {
        handleSubmit(true)
      }
    }

    calculateRemaining()
    const timer = setInterval(calculateRemaining, 1000)
    return () => clearInterval(timer)
  }, [attempt, submitting])

  const handleStartQuiz = async () => {
    try {
      setSubmitting(true)
      const res = await fetch(`/api/quizzes/${quizId}/start`, {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to start quiz")
      }
      const data = await res.json()
      setAttempt(data.attempt)
      setQuiz((prev) => ({ ...prev, questions: data.questions }))
      if (data.attempt?.answers) {
        setAnswers(data.attempt.answers)
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Autosave via PATCH /api/quizzes/:id/answers
  const triggerAutosave = (newAnswers) => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }

    setSaveStatus("saving")

    autosaveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/quizzes/${quizId}/answers`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ answers: newAnswers }),
        })

        const data = await res.json()

        // If the server detected expiration during save
        if (data.isExpired && data.attempt) {
          setAttempt(data.attempt)
          if (data.questions) {
            setQuiz((prev) => ({ ...prev, questions: data.questions }))
          }
          setSaveStatus("idle")
          return
        }

        if (res.ok) {
          setSaveStatus("saved")
        } else {
          setSaveStatus("error")
        }
      } catch (err) {
        console.error("Autosave error:", err)
        setSaveStatus("error")
      }
    }, 400)
  }

  const handleSelectOption = (questionId, optionIdx) => {
    if (attempt?.submittedAt) return

    const updated = { ...answers, [questionId]: optionIdx }
    setAnswers(updated)
    triggerAutosave(updated)
  }

  const handleSubmit = async (isAuto = false) => {
    if (submitting) return
    if (!isAuto && !window.confirm("Submit your answers now? This will complete your single attempt.")) {
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch(`/api/quizzes/${quizId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ answers }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Submission failed")
      }

      const data = await res.json()
      setAttempt(data.attempt)
      setQuiz((prev) => ({ ...prev, questions: data.questions }))
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const formatTimer = (seconds) => {
    if (seconds === null) return "--:--"
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading quiz details...</p>
      </div>
    )
  }

  if (error || !quiz) {
    return (
      <div className="container mx-auto p-6 max-w-xl text-center space-y-4">
        <p className="text-destructive">{error || "Quiz not found"}</p>
        <Link to="/courses">
          <Button variant="outline">Return to Courses</Button>
        </Link>
      </div>
    )
  }

  const isSubmitted = Boolean(attempt?.submittedAt)
  const passMark = quiz.passMark ?? 70
  const isPassed = attempt?.score !== null && attempt?.score >= passMark

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-4 gap-3">
        <div>
          <Link
            to={`/courses/${quiz.courseId}`}
            className="text-xs text-muted-foreground hover:underline"
          >
            ← {quiz.courseTitle}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight mt-1">{quiz.title}</h1>
        </div>

        {attempt && !isSubmitted && (
          <div className="flex items-center gap-3 self-end sm:self-auto">
            {/* Autosave status indicator */}
            <span className="text-xs text-muted-foreground">
              {saveStatus === "saving" && "Saving answers..."}
              {saveStatus === "saved" && "✓ Answers saved"}
              {saveStatus === "error" && "Error saving"}
            </span>

            {/* Server-authoritative timer display */}
            <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md font-mono text-sm font-semibold">
              <span className="text-muted-foreground text-xs">Time Left:</span>
              <span className={timeLeft !== null && timeLeft < 60 ? "text-destructive font-bold animate-pulse" : ""}>
                {formatTimer(timeLeft)}
              </span>
            </div>
          </div>
        )}
      </div>

      {!attempt ? (
        // Start Attempt Screen
        <Card className="text-center p-8 space-y-4">
          <CardHeader>
            <CardTitle className="text-xl">Begin Module Assessment</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              This quiz consists of {quiz.questions.length} multiple-choice questions. You have exactly{" "}
              <strong>one attempt</strong>. Answers will autosave as you work.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-w-sm mx-auto">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="rounded-md border p-3 bg-muted/30">
                <span className="text-muted-foreground block mb-0.5">Time Limit</span>
                <span className="text-base font-semibold">{quiz.timeLimitMin || 10} min</span>
              </div>
              <div className="rounded-md border p-3 bg-muted/30">
                <span className="text-muted-foreground block mb-0.5">Pass Mark</span>
                <span className="text-base font-semibold">{passMark}%</span>
              </div>
            </div>

            <Button size="lg" onClick={handleStartQuiz} disabled={submitting} className="w-full">
              {submitting ? "Starting..." : "Start Quiz Attempt"}
            </Button>
          </CardContent>
        </Card>
      ) : isSubmitted ? (
        // Graded Result & Comprehensive Review Screen
        <div className="space-y-6">
          <Card
            className={`border ${
              isPassed
                ? "border-emerald-600/30 bg-emerald-500/5"
                : "border-destructive/30 bg-destructive/5"
            }`}
          >
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-2">
                <Badge
                  variant={isPassed ? "success" : "destructive"}
                  className="text-xs px-3 py-0.5"
                >
                  {isPassed ? "PASSED" : "DID NOT PASS"}
                </Badge>
              </div>
              <CardTitle
                className={`text-4xl font-extrabold ${
                  isPassed ? "text-emerald-600" : "text-destructive"
                }`}
              >
                {attempt.score}%
              </CardTitle>
              <CardDescription className="mt-1">
                Pass Mark Requirement: {passMark}% • Completed on{" "}
                {new Date(attempt.submittedAt).toLocaleTimeString()}
              </CardDescription>
            </CardHeader>

            <CardFooter className="justify-center pt-2">
              <Link to={`/courses/${quiz.courseId}`}>
                <Button variant="outline" size="sm">
                  Return to Course Overview
                </Button>
              </Link>
            </CardFooter>
          </Card>

          {/* Question Review Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">Answers & Explanations</h2>
              <span className="text-xs text-muted-foreground">
                {quiz.questions.length} Questions Reviewed
              </span>
            </div>

            {quiz.questions.map((q, idx) => {
              const studentAnswer = attempt.answers?.[q.id]
              const isCorrect = studentAnswer !== undefined && studentAnswer === q.correctIndex

              return (
                <Card
                  key={q.id}
                  className={`border ${
                    isCorrect ? "border-emerald-500/30" : "border-destructive/30"
                  }`}
                >
                  <CardHeader className="py-3 px-4 bg-muted/20">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">
                        Question {idx + 1}
                      </span>
                      <Badge variant={isCorrect ? "success" : "destructive"} className="text-xs">
                        {isCorrect ? "Correct" : "Incorrect"}
                      </Badge>
                    </div>
                    <CardTitle className="text-base mt-1">{q.prompt}</CardTitle>
                  </CardHeader>

                  <CardContent className="p-4 space-y-2">
                    {q.options.map((opt, optIdx) => {
                      const isChosen = studentAnswer === optIdx
                      const isRight = q.correctIndex === optIdx

                      return (
                        <div
                          key={optIdx}
                          className={`p-3 rounded-md text-sm border flex items-center justify-between transition-colors ${
                            isRight
                              ? "bg-emerald-500/15 border-emerald-500/60 font-medium text-foreground"
                              : isChosen
                              ? "bg-destructive/15 border-destructive/50 text-destructive"
                              : "bg-card text-muted-foreground opacity-80"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-xs font-mono font-bold">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span>{opt}</span>
                          </div>

                          <span className="text-xs font-semibold">
                            {isRight && "✓ Correct"}
                            {isChosen && !isRight && "✗ Your Pick"}
                          </span>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ) : (
        // Active Quiz Taker (Timer Running, Autosaving)
        <div className="space-y-6">
          {quiz.questions.map((q, idx) => (
            <Card key={q.id} className="border">
              <CardHeader className="py-3 px-4 bg-muted/20">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Question {idx + 1} of {quiz.questions.length}
                </span>
                <CardTitle className="text-base mt-1">{q.prompt}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2.5">
                {q.options.map((opt, optIdx) => {
                  const isSelected = answers[q.id] === optIdx
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectOption(q.id, optIdx)}
                      className={`w-full text-left p-3 rounded-md border text-sm transition-all flex items-center gap-3 ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-card hover:bg-muted/40 text-foreground"
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full border flex items-center justify-center text-xs font-mono font-bold">
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <span className="flex-1">{opt}</span>
                      {isSelected && <span className="text-xs">Selected</span>}
                    </button>
                  )
                })}
              </CardContent>
            </Card>
          ))}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
            <span className="text-xs text-muted-foreground">
              {Object.keys(answers).length} of {quiz.questions.length} answered • Answers autosaved
            </span>

            <Button
              size="lg"
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              {submitting ? "Submitting..." : "Submit Quiz"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
