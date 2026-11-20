import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

export default function Instructor() {
  const [tab, setTab] = useState("courses") // "courses" | "analytics"
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // New Course Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [creating, setCreating] = useState(false)

  // Analytics State
  const [selectedCourseId, setSelectedCourseId] = useState("")
  const [analyticsData, setAnalyticsData] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  const fetchCourses = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/instructor/courses", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load courses")
      const data = await res.json()
      setCourses(data.courses || [])
      if (data.courses?.length > 0 && !selectedCourseId) {
        setSelectedCourseId(data.courses[0].id)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCourses()
  }, [])

  // Fetch course analytics whenever selectedCourseId changes
  const fetchAnalytics = async (courseId) => {
    if (!courseId) return
    try {
      setAnalyticsLoading(true)
      const res = await fetch(`/api/instructor/courses/${courseId}/analytics`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to load course analytics")
      const data = await res.json()
      setAnalyticsData(data)
    } catch (err) {
      console.error(err)
      setAnalyticsData(null)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  useEffect(() => {
    if (tab === "analytics" && selectedCourseId) {
      fetchAnalytics(selectedCourseId)
    }
  }, [tab, selectedCourseId])

  const handleCreateCourse = async (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setCreating(true)

    try {
      const res = await fetch("/api/instructor/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || null,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Failed to create course")
      }

      setNewTitle("")
      setNewDescription("")
      setIsModalOpen(false)
      await fetchCourses()
    } catch (err) {
      alert(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleTogglePublish = async (courseId, currentStatus) => {
    try {
      const res = await fetch(`/api/instructor/courses/${courseId}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isPublished: !currentStatus }),
      })

      if (!res.ok) throw new Error("Failed to update status")
      const data = await res.json()

      setCourses((prev) =>
        prev.map((c) => (c.id === courseId ? { ...c, isPublished: data.course.isPublished } : c))
      )
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Instructor Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage course curriculum, monitor student progress, and review quiz results.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Switcher */}
          <div className="flex rounded-md border p-1 bg-muted/40">
            <Button
              variant={tab === "courses" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTab("courses")}
            >
              My Courses ({courses.length})
            </Button>
            <Button
              variant={tab === "analytics" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTab("analytics")}
            >
              Student Analytics
            </Button>
          </div>

          {tab === "courses" && (
            <Button onClick={() => setIsModalOpen(true)}>+ New Course</Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading instructor data...</p>
        </div>
      ) : tab === "courses" ? (
        // Courses Tab
        courses.length === 0 ? (
          <Card className="text-center p-12">
            <CardHeader>
              <CardTitle>No courses yet</CardTitle>
              <CardDescription>
                Get started by creating your first course and adding curriculum modules.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setIsModalOpen(true)}>Create Course</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {courses.map((course) => (
              <Card key={course.id} className="flex flex-col justify-between">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-xl line-clamp-1">{course.title}</CardTitle>
                    <Badge variant={course.isPublished ? "success" : "secondary"}>
                      {course.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2 mt-1">
                    {course.description || "No description provided."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="text-xs text-muted-foreground space-x-4">
                  <span>{course._count?.modules ?? 0} Modules</span>
                  <span>•</span>
                  <span>{course._count?.enrollments ?? 0} Enrolled Students</span>
                </CardContent>

                <CardFooter className="flex items-center justify-between border-t pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTogglePublish(course.id, course.isPublished)}
                  >
                    {course.isPublished ? "Unpublish" : "Publish"}
                  </Button>
                  <Link to={`/instructor/courses/${course.id}`}>
                    <Button size="sm">Edit Curriculum</Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )
      ) : (
        // Student Analytics Dashboard Tab
        <div className="space-y-6">
          {courses.length === 0 ? (
            <Card className="text-center p-12">
              <CardHeader>
                <CardTitle>No courses available</CardTitle>
                <CardDescription>
                  Create a course first to monitor enrolled student progress.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <>
              {/* Course Selector Bar */}
              <Card className="p-4 bg-card">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="course-select" className="text-xs text-muted-foreground uppercase tracking-wider">
                      Select Course to View Analytics
                    </Label>
                    <select
                      id="course-select"
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      className="flex h-10 w-full sm:w-80 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} ({c.isPublished ? "Published" : "Draft"})
                        </option>
                      ))}
                    </select>
                  </div>

                  {analyticsData?.course && (
                    <div className="flex items-center gap-6 text-xs text-muted-foreground pt-1 sm:pt-0">
                      <div>
                        <span className="block font-semibold text-foreground text-sm">
                          {analyticsData.course.enrolledCount}
                        </span>
                        <span>Students</span>
                      </div>
                      <div>
                        <span className="block font-semibold text-foreground text-sm">
                          {analyticsData.course.totalLessons}
                        </span>
                        <span>Lessons</span>
                      </div>
                      <div>
                        <span className="block font-semibold text-foreground text-sm">
                          {analyticsData.course.quizModules.length}
                        </span>
                        <span>Quizzes</span>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {analyticsLoading ? (
                <div className="flex min-h-[250px] items-center justify-center">
                  <p className="text-sm text-muted-foreground">Loading student progress...</p>
                </div>
              ) : !analyticsData || analyticsData.students.length === 0 ? (
                // Empty state for courses with 0 enrollments
                <Card className="text-center p-12 border-dashed">
                  <CardHeader>
                    <CardTitle className="text-lg">No students enrolled yet</CardTitle>
                    <CardDescription className="max-w-md mx-auto">
                      Once students enroll in this course, their curriculum completion % and per-module
                      quiz scores will appear here in real time.
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                // Enrolled Students Table
                <Card className="border overflow-hidden">
                  <CardHeader className="py-4 px-6 border-b bg-muted/20">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base font-semibold">Enrolled Students</CardTitle>
                      <span className="text-xs text-muted-foreground">
                        {analyticsData.students.length} Total Enrolled
                      </span>
                    </div>
                  </CardHeader>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b">
                        <tr>
                          <th className="py-3 px-4 font-semibold">Student</th>
                          <th className="py-3 px-4 font-semibold">Enrolled At</th>
                          <th className="py-3 px-4 font-semibold min-w-[150px]">Course Progress</th>
                          {analyticsData.course.quizModules.map((qm, idx) => (
                            <th key={qm.quizId} className="py-3 px-4 font-semibold whitespace-nowrap">
                              <div>{qm.moduleTitle}</div>
                              <span className="text-[10px] font-normal lowercase text-muted-foreground">
                                pass: {qm.passMark}%
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {analyticsData.students.map((student) => (
                          <tr key={student.studentId} className="hover:bg-muted/20 transition-colors">
                            {/* Student Name & Email */}
                            <td className="py-3 px-4">
                              <div className="font-medium text-foreground">{student.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {student.email}
                              </div>
                            </td>

                            {/* Enrolled Date */}
                            <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(student.enrolledAt).toLocaleDateString()}
                            </td>

                            {/* Overall Progress % */}
                            <td className="py-3 px-4">
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-medium">
                                  <span>{student.progressPercentage}%</span>
                                  <span className="text-muted-foreground font-normal">
                                    {student.completedLessons}/{student.totalLessons}
                                  </span>
                                </div>
                                <Progress value={student.progressPercentage} className="h-1.5" />
                              </div>
                            </td>

                            {/* Dynamic Module Quiz Results */}
                            {student.quizResults.map((qr) => (
                              <td key={qr.quizId} className="py-3 px-4 whitespace-nowrap">
                                {qr.status === "COMPLETED" ? (
                                  <div className="flex items-center gap-1.5">
                                    <Badge
                                      variant={qr.passed ? "success" : "destructive"}
                                      className="text-[11px] px-2 py-0.5"
                                    >
                                      {qr.score}% ({qr.passed ? "Pass" : "Fail"})
                                    </Badge>
                                  </div>
                                ) : qr.status === "IN_PROGRESS" ? (
                                  <Badge variant="outline" className="text-[11px]">
                                    In Progress
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">
                                    Not Attempted
                                  </span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* New Course Modal */}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <DialogHeader>
          <DialogTitle>Create Course</DialogTitle>
          <DialogDescription>
            Enter a title and optional description to begin structuring your curriculum.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreateCourse} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Course Title</Label>
            <Input
              id="title"
              placeholder="e.g. Modern Web Development with React"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              placeholder="Brief course overview..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={creating || !newTitle.trim()}>
              {creating ? "Creating..." : "Create Course"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
