import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // New Course Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [creating, setCreating] = useState(false)

  const fetchCourses = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/instructor/courses", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load courses")
      const data = await res.json()
      setCourses(data.courses || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCourses()
  }, [])

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Courses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create, organize modules and lessons, and manage course publication.
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>+ New Course</Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading your courses...</p>
        </div>
      ) : courses.length === 0 ? (
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
                <span>{course._count?.enrollments ?? 0} Students</span>
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
                  <Button size="sm">Edit Course</Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
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
