import { useState, useEffect } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default function LessonViewer() {
  const { id: courseId, lessonId } = useParams()
  const navigate = useNavigate()

  const [lesson, setLesson] = useState(null)
  const [courseModules, setCourseModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)
  const [error, setError] = useState("")

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
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLesson()
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

      // Update local lesson state
      setLesson((prev) => ({
        ...prev,
        isCompleted: data.progress.isCompleted,
      }))

      // Update courseModules list for sidebar checkmarks
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
        <div className="flex-1 space-y-6">
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
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground pt-2">
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
