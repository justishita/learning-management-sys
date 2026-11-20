import { useState, useEffect } from "react"
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
  const [timeLeft, setTimeLeft] = useState(null)
  const [error, setError] = useState("")

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

  // Timer countdown
  useEffect(() => {
    if (!attempt || attempt.submittedAt || !attempt.expiresAt) return

    const calculateRemaining = () => {
      const remainingSec = Math.max(
        0,
        Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000)
      )
      setTimeLeft(remainingSec)

      if (remainingSec <= 0) {
        // Auto submit on time expiry
        handleSubmit(true)
      }
    }

    calculateRemaining()
    const timer = setInterval(calculateRemaining, 1000)
    return () => clearInterval(timer)
  }, [attempt])

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
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSelectOption = (questionId, optionIdx) => {
    if (attempt?.submittedAt) return
    setAnswers((prev) => ({ ...prev, [questionId]: optionIdx }))
  }

  const handleSubmit = async (isAuto = false) => {
    if (submitting) return
    if (!isAuto && !window.confirm("Submit your answers now? You only have one attempt.")) {
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

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b pb-4">
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
          <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md font-mono text-sm font-semibold">
            <span className="text-muted-foreground text-xs">Time Left:</span>
            <span className={timeLeft < 60 ? "text-destructive font-bold" : ""}>
              {formatTimer(timeLeft)}
            </span>
          </div>
        )}
      </div>

      {!attempt ? (
        // Start Attempt View
        <Card className="text-center p-8 space-y-4">
          <CardHeader>
            <CardTitle className="text-xl">Ready for this Quiz?</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              This module assessment has {quiz.questions.length} questions. You only get{" "}
              <strong>one attempt</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-w-sm mx-auto">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="rounded-md border p-3 bg-muted/30">
                <span className="text-muted-foreground block mb-0.5">Time Limit</span>
                <span className="text-base font-semibold">{quiz.timeLimitMin || 10} min</span>
              </div>
              <div className="rounded-md border p-3 bg-muted/30">
                <span className="text-muted-foreground block mb-0.5">Passing Mark</span>
                <span className="text-base font-semibold">{quiz.passMark || 70}%</span>
              </div>
            </div>

            <Button size="lg" onClick={handleStartQuiz} disabled={submitting} className="w-full">
              {submitting ? "Starting..." : "Begin Quiz Attempt"}
            </Button>
          </CardContent>
        </Card>
      ) : isSubmitted ? (
        // Result Summary & Review View
        <div className="space-y-6">
          <Card
            className={`border ${
              attempt.score >= (quiz.passMark || 70)
                ? "border-emerald-600/30 bg-emerald-500/5"
                : "border-destructive/30 bg-destructive/5"
            }`}
          >
            <CardHeader className="text-center pb-2">
              <Badge
                variant={attempt.score >= (quiz.passMark || 70) ? "success" : "destructive"}
                className="mx-auto mb-2 text-xs"
              >
                {attempt.score >= (quiz.passMark || 70) ? "Passed" : "Did Not Pass"}
              </Badge>
              <CardTitle
                className={`text-3xl font-bold ${
                  attempt.score >= (quiz.passMark || 70)
                    ? "text-emerald-600"
                    : "text-destructive"
                }`}
              >
                Score: {attempt.score}%
              </CardTitle>
              <CardDescription>
                Pass Mark: {quiz.passMark || 70}% • Submitted on{" "}
                {new Date(attempt.submittedAt).toLocaleTimeString()}
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center pt-2">
              <Link to={`/courses/${quiz.courseId}`}>
                <Button variant="outline" size="sm">
                  Return to Course
                </Button>
              </Link>
            </CardFooter>
          </Card>

          {/* Question Review with correct answers revealed */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Question Review</h2>
            {quiz.questions.map((q, idx) => {
              const studentAnswer = attempt.answers?.[q.id]
              const isCorrect = studentAnswer === q.correctIndex

              return (
                <Card
                  key={q.id}
                  className={`border ${
                    isCorrect ? "border-emerald-500/30" : "border-destructive/30"
                  }`}
                >
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">
                        Question {idx + 1}
                      </span>
                      <Badge variant={isCorrect ? "success" : "destructive"}>
                        {isCorrect ? "Correct" : "Incorrect"}
                      </Badge>
                    </div>
                    <CardTitle className="text-base mt-1">{q.prompt}</CardTitle>
                  </CardHeader>

                  <CardContent className="px-4 pb-4 space-y-2">
                    {q.options.map((opt, optIdx) => {
                      const isChosen = studentAnswer === optIdx
                      const isRightOption = q.correctIndex === optIdx

                      return (
                        <div
                          key={optIdx}
                          className={`p-2.5 rounded-md text-sm border flex items-center justify-between ${
                            isRightOption
                              ? "bg-emerald-500/15 border-emerald-500/50 font-medium"
                              : isChosen
                              ? "bg-destructive/15 border-destructive/50"
                              : "bg-card text-muted-foreground"
                          }`}
                        >
                          <span>{opt}</span>
                          <span className="text-xs">
                            {isRightOption && "✓ Correct Answer"}
                            {isChosen && !isRightOption && "✗ Your Answer"}
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
        // Active Attempt Taker View
        <div className="space-y-6">
          {quiz.questions.map((q, idx) => (
            <Card key={q.id}>
              <CardHeader className="py-3 px-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Question {idx + 1} of {quiz.questions.length}
                </span>
                <CardTitle className="text-base mt-1">{q.prompt}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {q.options.map((opt, optIdx) => {
                  const isSelected = answers[q.id] === optIdx
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectOption(q.id, optIdx)}
                      className={`w-full text-left p-3 rounded-md border text-sm transition-all flex items-center gap-3 ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card hover:bg-muted/50"
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full border flex items-center justify-center text-xs">
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <span>{opt}</span>
                    </button>
                  )
                })}
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-end pt-4">
            <Button
              size="lg"
              onClick={() => handleSubmit(false)}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Quiz"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
