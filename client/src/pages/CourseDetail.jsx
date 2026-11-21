import { useState, useEffect } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { BackButton } from "@/components/BackButton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

export default function CourseDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [error, setError] = useState("")
  const [enrollError, setEnrollError] = useState("")

  const fetchCourse = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/courses/${id}`, { credentials: "include" })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Course not found")
      }
      const data = await res.json()
      setCourse(data.course)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCourse()
  }, [id])

  const handleEnroll = async () => {
    if (!user) {
      navigate("/login", { state: { from: { pathname: `/courses/${id}` } } })
      return
    }

    try {
      setEnrolling(true)
      setEnrollError("")
      const res = await fetch(`/api/courses/${id}/enroll`, {
        method: "POST",
        credentials: "include",
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Failed to enrol")
      }

      await fetchCourse()
    } catch (err) {
      setEnrollError(err.message)
    } finally {
      setEnrolling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading course...</p>
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="container mx-auto p-6 max-w-4xl text-center space-y-4">
        <p className="text-destructive">{error || "Course unavailable"}</p>
        <div>
          <BackButton fallbackPath="/courses" label="Back to Catalog" variant="outline" />
        </div>
      </div>
    )
  }

  // Unpublished course view for enrolled student
  if (course.isTemporarilyUnavailable) {
    return (
      <div className="container mx-auto p-6 max-w-4xl space-y-6">
        <div>
          <BackButton fallbackPath="/courses" label="Back to My Courses" />
        </div>
        <Card className="opacity-70 bg-muted/30 border-dashed text-center p-8">
          <CardHeader>
            <div className="flex justify-center mb-2">
              <Badge variant="secondary">Temporarily Unavailable</Badge>
            </div>
            <CardTitle className="text-2xl text-muted-foreground">{course.title}</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              This course has been unpublished by the instructor. Lessons are temporarily
              hidden, but your enrollment and {course.progressPercentage}% progress are saved.
            </CardDescription>
          </CardHeader>
          <CardContent className="max-w-xs mx-auto">
            <Progress value={course.progressPercentage} className="h-2 opacity-50 mb-4" />
            <BackButton fallbackPath="/courses" label="Return to Dashboard" variant="outline" size="sm" className="w-full justify-center" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-8">
      {/* Top Banner */}
      <div className="space-y-4 border-b pb-6">
        <div>
          <BackButton fallbackPath="/courses" />
        </div>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="space-y-2 flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{course.title}</h1>
            <p className="text-muted-foreground">
              {course.description || "No description provided for this course."}
            </p>
            <p className="text-xs text-muted-foreground">
              Instructor:{" "}
              <span className="font-medium text-foreground">
                {course.instructor?.name || course.instructor?.email}
              </span>
            </p>
          </div>

          <div className="min-w-[240px] space-y-4 rounded-lg border bg-card p-4 shadow-sm">
            {course.isEnrolled ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Course Progress</span>
                    <span className="font-semibold">{course.progressPercentage}%</span>
                  </div>
                  <Progress value={course.progressPercentage} />
                  <p className="text-[11px] text-muted-foreground">
                    {course.completedLessons} of {course.totalLessons} lessons completed
                  </p>
                </div>

                {course.nextLessonId && (
                  <Link
                    to={`/courses/${course.id}/lessons/${course.nextLessonId}`}
                    className="block"
                  >
                    <Button className="w-full">
                      {course.progressPercentage > 0
                        ? "Continue where you left off"
                        : "Start First Lesson"}
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <div className="text-sm font-semibold">Join this Course</div>
                <p className="text-xs text-muted-foreground">
                  Get full access to all {course.totalLessons} lessons and interactive exercises.
                </p>
                {enrollError && <p className="text-xs text-destructive">{enrollError}</p>}
                <Button
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="w-full"
                >
                  {enrolling ? "Enrolling..." : "Enrol in Course"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Curriculum Outline */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Curriculum Syllabus</h2>
          <p className="text-xs text-muted-foreground">
            {course.modules.length} Modules • {course.totalLessons} Lessons
          </p>
        </div>

        {course.modules.length === 0 ? (
          <Card className="text-center p-8 border-dashed">
            <CardHeader>
              <CardTitle className="text-base">No modules available</CardTitle>
              <CardDescription>
                The instructor has not added modules to this course yet.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-4">
            {course.modules.map((mod, modIdx) => (
              <Card key={mod.id}>
                <CardHeader className="py-3 px-4 bg-muted/40">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Module {modIdx + 1}
                    </span>
                    <CardTitle className="text-base font-semibold">{mod.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0 divide-y">
                  {mod.lessons.length === 0 && !mod.quiz ? (
                    <p className="p-4 text-xs text-muted-foreground italic">
                      No lessons in this module yet.
                    </p>
                  ) : (
                    mod.lessons.map((lesson, lessIdx) => (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between p-3.5 hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-muted-foreground w-6">
                            {modIdx + 1}.{lessIdx + 1}
                          </span>
                          <Badge
                            variant={lesson.type === "VIDEO" ? "default" : "secondary"}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {lesson.type}
                          </Badge>
                          <span className="text-sm font-medium">{lesson.title}</span>
                          {lesson.level && (
                            <span className="text-[11px] text-muted-foreground border rounded px-1.5 py-0.5">
                              {lesson.level}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          {course.isEnrolled && (
                            lesson.isCompleted ? (
                              <Badge variant="success" className="text-xs">
                                ✓ Completed
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">To do</span>
                            )
                          )}

                          {course.isEnrolled ? (
                            <Link to={`/courses/${course.id}/lessons/${lesson.id}`}>
                              <Button variant="ghost" size="sm">
                                {lesson.isCompleted ? "Review" : "Start"}
                              </Button>
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground italic pr-2">
                              Enroll to view
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {mod.quiz && (
                    <div className="flex items-center justify-between p-3.5 bg-primary/5 hover:bg-primary/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-[10px] bg-background">
                          Assessment
                        </Badge>
                        <span className="text-sm font-semibold">Quiz: {mod.quiz.title}</span>
                      </div>

                      {course.isEnrolled ? (
                        <Link to={`/quizzes/${mod.quiz.id}`}>
                          <Button size="sm">
                            Take Quiz
                          </Button>
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground italic pr-2">
                          Enroll to take quiz
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
