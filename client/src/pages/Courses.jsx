import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"

export default function Courses() {
  const { user } = useAuth()
  const [tab, setTab] = useState("enrolled") // "enrolled" | "catalog"
  const [enrolledCourses, setEnrolledCourses] = useState([])
  const [catalogCourses, setCatalogCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchData = async () => {
    setLoading(true)
    setError("")
    try {
      const [enrolledRes, catalogRes] = await Promise.all([
        fetch("/api/student/enrolled", { credentials: "include" }),
        fetch("/api/courses", { credentials: "include" }),
      ])

      if (!enrolledRes.ok) {
        const data = await enrolledRes.json()
        throw new Error(data.error || "Failed to load enrolled courses")
      }
      const enrolledData = await enrolledRes.json()
      setEnrolledCourses(enrolledData.enrolledCourses || [])
      if ((enrolledData.enrolledCourses || []).length === 0) {
        setTab("catalog")
      }

      if (!catalogRes.ok) {
        const data = await catalogRes.json()
        throw new Error(data.error || "Failed to load course catalog")
      }
      const catalogData = await catalogRes.json()
      setCatalogCourses(catalogData.courses || [])
    } catch (err) {
      setError(err.message || "Failed to load courses")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse published courses and track your curriculum progress.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-md border p-1 bg-muted/40 w-fit">
          <Button
            variant={tab === "enrolled" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTab("enrolled")}
          >
            My Courses ({enrolledCourses.length})
          </Button>
          <Button
            variant={tab === "catalog" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTab("catalog")}
          >
            Course Catalog ({catalogCourses.length})
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading courses...</p>
        </div>
      ) : tab === "enrolled" ? (
        // My Enrolled Courses Tab
        enrolledCourses.length === 0 ? (
          <Card className="text-center p-12">
            <CardHeader>
              <CardTitle>You haven't enrolled in any courses yet</CardTitle>
              <CardDescription>
                Explore our catalog to find courses and start learning.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setTab("catalog")}>Browse Catalog</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {enrolledCourses.map((c) =>
              c.isTemporarilyUnavailable ? (
                // Greyed out "Temporarily Unavailable" Card for unpublished courses
                <Card
                  key={c.id}
                  className="opacity-60 bg-muted/30 border-dashed flex flex-col justify-between"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg line-clamp-1 text-muted-foreground">
                        {c.title}
                      </CardTitle>
                      <Badge variant="secondary" className="bg-muted text-muted-foreground">
                        Temporarily Unavailable
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2">
                      This course is currently unpublished by the instructor. Your enrollment
                      and progress are safely preserved.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{c.progressPercentage}%</span>
                    </div>
                    <Progress value={c.progressPercentage} className="h-1.5 opacity-50" />
                  </CardContent>

                  <CardFooter className="border-t pt-3">
                    <Button variant="outline" size="sm" disabled className="w-full">
                      Unavailable
                    </Button>
                  </CardFooter>
                </Card>
              ) : (
                // Active Enrolled Course Card
                <Card key={c.id} className="flex flex-col justify-between">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg line-clamp-1">{c.title}</CardTitle>
                      <Badge variant="outline">{c.progressPercentage}% Complete</Badge>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {c.description || "No description provided."}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {c.completedLessons} of {c.totalLessons} lessons completed
                        </span>
                        <span className="font-medium text-foreground">
                          {c.progressPercentage}%
                        </span>
                      </div>
                      <Progress value={c.progressPercentage} />
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Instructor: {c.instructor?.name || c.instructor?.email}
                    </div>
                  </CardContent>

                  <CardFooter className="flex items-center justify-between border-t pt-4 gap-2">
                    <Link to={`/courses/${c.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        Curriculum
                      </Button>
                    </Link>
                    {c.nextLessonId ? (
                      <Link
                        to={`/courses/${c.id}/lessons/${c.nextLessonId}`}
                        className="flex-1"
                      >
                        <Button size="sm" className="w-full">
                          {c.progressPercentage > 0
                            ? "Continue Learning"
                            : "Start Course"}
                        </Button>
                      </Link>
                    ) : (
                      <Link to={`/courses/${c.id}`} className="flex-1">
                        <Button size="sm" className="w-full">
                          View
                        </Button>
                      </Link>
                    )}
                  </CardFooter>
                </Card>
              )
            )}
          </div>
        )
      ) : (
        // Course Catalog Tab
        catalogCourses.length === 0 ? (
          <Card className="text-center p-12">
            <CardHeader>
              <CardTitle>No published courses available</CardTitle>
              <CardDescription>
                Check back later as instructors publish new content.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {catalogCourses.map((c) => (
              <Card key={c.id} className="flex flex-col justify-between">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-1">{c.title}</CardTitle>
                    {c.isEnrolled && (
                      <Badge variant="secondary">Enrolled</Badge>
                    )}
                  </div>
                  <CardDescription className="line-clamp-2">
                    {c.description || "No description provided."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="text-xs text-muted-foreground space-x-3">
                  <span>Instructor: {c.instructor?.name || c.instructor?.email}</span>
                  <span>•</span>
                  <span>{c.totalLessons} Lessons</span>
                </CardContent>

                <CardFooter className="border-t pt-4">
                  <Link to={`/courses/${c.id}`} className="w-full">
                    <Button
                      variant={c.isEnrolled ? "outline" : "default"}
                      size="sm"
                      className="w-full"
                    >
                      {c.isEnrolled ? "View Enrolled Course" : "Course Overview & Enrol"}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  )
}
