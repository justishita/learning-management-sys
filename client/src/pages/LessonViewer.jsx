import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

export default function LessonViewer() {
  const { id: courseId, lessonId } = useParams()

  const [lesson, setLesson] = useState(null)
  const [courseModules, setCourseModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)
  const [error, setError] = useState("")

  // AI Tutor State
  const [explanation, setExplanation] = useState("")
  const [tutorLoading, setTutorLoading] = useState(false)
  const [tutorFeedback, setTutorFeedback] = useState(null)
  const [remainingCalls, setRemainingCalls] = useState(10)
  const [tutorError, setTutorError] = useState("")
  const [practiceAnswers, setPracticeAnswers] = useState({})

  const fetchLesson = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/lessons/${lessonId}`, {
        credentials: "include",
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Failed to load lesson")
      }

      const data = await res.json()
      setLesson(data.lesson)
      setCourseModules(data.courseModules || [])

      // Fetch AI tutor daily quota
      try {
        const quotaRes = await fetch(`/api/lessons/${lessonId}/tutor/quota`, {
          credentials: "include",
        })
        if (quotaRes.ok) {
          const quotaData = await quotaRes.json()
          setRemainingCalls(quotaData.remainingCalls ?? 10)
        }
      } catch (e) {
        console.error("Quota fetch error:", e)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLesson()
    setTutorFeedback(null)
    setExplanation("")
    setPracticeAnswers({})
    setTutorError("")
  }, [lessonId])

  const handleToggleComplete = async () => {
    if (!lesson) return
    try {
      setMarking(true)
      const res = await fetch(`/api/lessons/${lesson.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isCompleted: !lesson.isCompleted }),
      })

      if (!res.ok) throw new Error("Failed to update progress")
      const data = await res.json()

      setLesson((prev) => ({
        ...prev,
        isCompleted: data.progress.isCompleted,
      }))

      setCourseModules((prev) =>
        prev.map((mod) => ({
          ...mod,
          lessons: mod.lessons.map((l) =>
            l.id === lesson.id ? { ...l, isCompleted: data.progress.isCompleted } : l
          ),
        }))
      )
    } catch (err) {
      alert(err.message)
    } finally {
      setMarking(false)
    }
  }

  const handleTutorSubmit = async (e) => {
    e.preventDefault()
    if (!explanation.trim()) return

    try {
      setTutorLoading(true)
      setTutorError("")
      const res = await fetch(`/api/lessons/${lessonId}/tutor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ explanation: explanation.trim() }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze explanation")
      }

      setTutorFeedback(data.feedback)
      setRemainingCalls(data.remainingCalls ?? 0)
      setPracticeAnswers({})
    } catch (err) {
      setTutorError(err.message)
    } finally {
      setTutorLoading(false)
    }
  }

  const handlePracticeOptionSelect = (qIdx, optIdx) => {
    setPracticeAnswers((prev) => ({ ...prev, [qIdx]: optIdx }))
  }

  // Calculate overall course progress from sidebar modules
  const allLessons = courseModules.flatMap((m) => m.lessons)
  const totalLessons = allLessons.length
  const completedCount = allLessons.filter((l) => l.isCompleted).length
  const progressPercentage =
    totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading lesson content...</p>
      </div>
    )
  }

  if (error || !lesson) {
    return (
      <div className="container mx-auto p-6 max-w-4xl text-center space-y-4">
        <p className="text-destructive">{error || "Lesson not found"}</p>
        <Link to={`/courses/${courseId}`}>
          <Button variant="outline">Return to Course Overview</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Top Header / Progress Bar */}
      <div className="border-b bg-card px-4 py-3 sticky top-0 z-10 shadow-xs">
        <div className="container mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to={`/courses/${courseId}`}
              className="text-xs text-muted-foreground hover:underline"
            >
              ← {lesson.courseTitle}
            </Link>
            <span className="text-muted-foreground">•</span>
            <span className="text-sm font-semibold truncate max-w-xs sm:max-w-md">
              {lesson.title}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 min-w-[140px]">
              <Progress value={progressPercentage} className="h-2 w-24" />
              <span className="text-xs font-medium text-muted-foreground">
                {progressPercentage}%
              </span>
            </div>

            <Button
              variant={lesson.isCompleted ? "secondary" : "default"}
              size="sm"
              onClick={handleToggleComplete}
              disabled={marking}
            >
              {lesson.isCompleted ? "✓ Completed (Undo)" : "Mark as Complete"}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="container mx-auto p-4 md:p-6 flex-1 flex flex-col lg:flex-row gap-6">
        {/* Left / Center Content Column */}
        <div className="flex-1 space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={lesson.type === "VIDEO" ? "default" : "secondary"}>
                {lesson.type}
              </Badge>
              {lesson.level && (
                <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5">
                  {lesson.level}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {lesson.title}
            </h1>
          </div>

          {/* Video Player or Text Reader */}
          {lesson.type === "VIDEO" ? (
            <div className="space-y-4">
              {lesson.videoUrl ? (
                <div className="relative aspect-video w-full rounded-lg overflow-hidden border bg-black shadow-md">
                  <iframe
                    src={lesson.videoUrl}
                    title={lesson.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="p-8 border rounded-lg text-center text-muted-foreground">
                  No video link configured for this lesson.
                </div>
              )}
            </div>
          ) : (
            <Card className="border">
              <CardContent className="p-6 sm:p-8">
                {lesson.content ? (
                  <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-sm sm:text-base">
                    {lesson.content}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No text content provided for this lesson.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Keywords */}
          {lesson.keywords && lesson.keywords.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              <span>Tags:</span>
              {lesson.keywords.map((k, idx) => (
                <span
                  key={idx}
                  className="rounded bg-muted px-2 py-0.5 font-mono text-[11px]"
                >
                  #{k}
                </span>
              ))}
            </div>
          )}

          {/* -------------------------------------------------------- */}
          {/* AI TUTOR: "Explain It Back" Active Recall Panel          */}
          {/* -------------------------------------------------------- */}
          <Card className="border-primary/30 bg-primary/2">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    AI Tutor
                  </Badge>
                  <CardTitle className="text-lg font-bold">Explain It Back</CardTitle>
                </div>
                <span className="text-xs text-muted-foreground">
                  {remainingCalls}/10 daily calls remaining
                </span>
              </div>
              <CardDescription>
                Reinforce your learning by summarizing this lesson in your own words. The AI
                evaluates your explanation against lesson ground truth and produces an ungraded practice quiz.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <form onSubmit={handleTutorSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Textarea
                    placeholder="In this lesson, I learned that..."
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value.slice(0, 1500))}
                    rows={4}
                    disabled={tutorLoading || remainingCalls === 0}
                    className="resize-y"
                  />
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>Active recall check • Max 1500 characters</span>
                    <span className={explanation.length > 1400 ? "text-destructive font-semibold" : ""}>
                      {explanation.length} / 1500
                    </span>
                  </div>
                </div>

                {tutorError && (
                  <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive">
                    {tutorError}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={tutorLoading || !explanation.trim() || remainingCalls === 0}
                  className="w-full sm:w-auto"
                >
                  {tutorLoading ? "Evaluating Explanation..." : "Get AI Feedback"}
                </Button>
              </form>

              {/* AI Feedback Display */}
              {tutorFeedback && (
                <div className="space-y-6 pt-4 border-t animate-in fade-in">
                  {/* Score & Overview */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg bg-card border">
                    <div>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                        Mastery Evaluation
                      </span>
                      <div className="text-2xl font-bold text-primary mt-0.5">
                        {tutorFeedback.score}% Comprehension
                      </div>
                    </div>
                    <Progress value={tutorFeedback.score} className="w-full sm:w-48 h-2.5" />
                  </div>

                  {/* Understood vs Gaps */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Understood Concepts */}
                    <div className="p-4 rounded-lg border bg-emerald-500/5 border-emerald-500/20 space-y-2">
                      <div className="text-xs font-semibold uppercase text-emerald-600 flex items-center gap-1.5">
                        <span>✓</span> Understood Concepts
                      </div>
                      <ul className="text-xs space-y-1.5 text-foreground list-disc list-inside">
                        {tutorFeedback.understood.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Conceptual Gaps */}
                    <div className="p-4 rounded-lg border bg-amber-500/5 border-amber-500/20 space-y-2">
                      <div className="text-xs font-semibold uppercase text-amber-600 flex items-center gap-1.5">
                        <span>!</span> Concepts to Review
                      </div>
                      <ul className="text-xs space-y-1.5 text-foreground list-disc list-inside">
                        {tutorFeedback.gaps.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Corrections (if any misconceptions found) */}
                  {tutorFeedback.corrections && tutorFeedback.corrections.length > 0 && (
                    <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5 space-y-3">
                      <div className="text-xs font-semibold uppercase text-destructive">
                        Misconception Corrections
                      </div>
                      <div className="space-y-3">
                        {tutorFeedback.corrections.map((corr, idx) => (
                          <div key={idx} className="text-xs space-y-1 border-b pb-2 last:border-b-0 last:pb-0">
                            <div className="text-muted-foreground">
                              <strong>Your Claim:</strong> "{corr.claim}"
                            </div>
                            <div className="text-destructive font-medium">
                              <strong>Issue:</strong> {corr.issue}
                            </div>
                            <div className="text-emerald-700 dark:text-emerald-400 font-medium">
                              <strong>Correction:</strong> {corr.fix}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ungraded Practice Quiz (5 Questions) */}
                  {tutorFeedback.quiz && tutorFeedback.quiz.length > 0 && (
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold tracking-tight">
                          Ungraded Practice Quiz (5 Questions)
                        </h3>
                        <span className="text-xs text-muted-foreground">Instant Feedback</span>
                      </div>

                      <div className="space-y-4">
                        {tutorFeedback.quiz.map((q, qIdx) => {
                          const chosenOption = practiceAnswers[qIdx]
                          const hasAnswered = chosenOption !== undefined

                          return (
                            <Card key={qIdx} className="border">
                              <CardHeader className="py-3 px-4 bg-muted/20">
                                <span className="text-xs font-semibold text-muted-foreground uppercase">
                                  Practice Question {qIdx + 1}
                                </span>
                                <CardTitle className="text-sm font-semibold mt-0.5">
                                  {q.prompt}
                                </CardTitle>
                              </CardHeader>

                              <CardContent className="p-4 space-y-2">
                                {q.options.map((opt, optIdx) => {
                                  const isSelected = chosenOption === optIdx
                                  const isCorrect = q.correctIndex === optIdx

                                  let btnClass = "border text-left p-2.5 rounded-md text-xs transition-colors flex items-center justify-between w-full "

                                  if (hasAnswered) {
                                    if (isCorrect) {
                                      btnClass += "bg-emerald-500/15 border-emerald-500/60 font-medium text-foreground"
                                    } else if (isSelected && !isCorrect) {
                                      btnClass += "bg-destructive/15 border-destructive/50 text-destructive font-medium"
                                    } else {
                                      btnClass += "bg-card text-muted-foreground opacity-60"
                                    }
                                  } else {
                                    btnClass += "bg-card hover:bg-muted/40 text-foreground"
                                  }

                                  return (
                                    <button
                                      key={optIdx}
                                      type="button"
                                      onClick={() => handlePracticeOptionSelect(qIdx, optIdx)}
                                      className={btnClass}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="w-4 h-4 rounded-full border flex items-center justify-center font-mono text-[10px]">
                                          {String.fromCharCode(65 + optIdx)}
                                        </span>
                                        <span>{opt}</span>
                                      </div>

                                      {hasAnswered && isCorrect && (
                                        <span className="text-emerald-600 font-bold">✓ Correct</span>
                                      )}
                                      {hasAnswered && isSelected && !isCorrect && (
                                        <span className="text-destructive font-bold">✗ Incorrect</span>
                                      )}
                                    </button>
                                  )
                                })}

                                {hasAnswered && q.explanation && (
                                  <div className="p-2.5 rounded bg-muted/40 text-xs text-muted-foreground mt-2 border-l-2 border-primary">
                                    <strong>Explanation:</strong> {q.explanation}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bottom Prev / Next Navigation Controls */}
          <div className="flex items-center justify-between border-t pt-6">
            {lesson.prevLessonId ? (
              <Link to={`/courses/${courseId}/lessons/${lesson.prevLessonId}`}>
                <Button variant="outline" size="sm">
                  ← Previous Lesson
                </Button>
              </Link>
            ) : (
              <div />
            )}

            {lesson.nextLessonId ? (
              <Link to={`/courses/${courseId}/lessons/${lesson.nextLessonId}`}>
                <Button size="sm">Next Lesson →</Button>
              </Link>
            ) : (
              <Link to={`/courses/${courseId}`}>
                <Button variant="secondary" size="sm">
                  Back to Syllabus
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Right Sidebar: Course Modules & Lessons */}
        <aside className="w-full lg:w-80 shrink-0">
          <Card className="sticky top-20 border">
            <CardHeader className="py-3 px-4 border-b">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-semibold">Course Outline</CardTitle>
                <span className="text-xs text-muted-foreground">
                  {completedCount}/{totalLessons} Done
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[calc(100vh-14rem)] overflow-y-auto divide-y">
              {courseModules.map((mod, modIdx) => (
                <div key={mod.id} className="py-2">
                  <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Module {modIdx + 1}: {mod.title}
                  </div>
                  <div className="space-y-0.5">
                    {mod.lessons.map((l) => {
                      const isCurrent = l.id === lesson.id
                      return (
                        <Link
                          key={l.id}
                          to={`/courses/${courseId}/lessons/${l.id}`}
                          className={`flex items-center justify-between px-4 py-2 text-xs transition-colors ${
                            isCurrent
                              ? "bg-accent font-medium text-accent-foreground border-l-2 border-primary"
                              : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <span className="truncate pr-2">{l.title}</span>
                          {l.isCompleted && (
                            <span className="text-emerald-600 font-bold">✓</span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
