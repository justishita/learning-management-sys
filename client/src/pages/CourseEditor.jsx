import { useState, useEffect } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { BackButton } from "@/components/BackButton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

export default function CourseEditor() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Course Edit Modal
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false)
  const [courseTitle, setCourseTitle] = useState("")
  const [courseDesc, setCourseDesc] = useState("")

  // Module Modal State
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false)
  const [editingModule, setEditingModule] = useState(null)
  const [moduleTitle, setModuleTitle] = useState("")

  // Lesson Modal State
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false)
  const [activeModuleId, setActiveModuleId] = useState(null)
  const [editingLesson, setEditingLesson] = useState(null)
  const [lessonTitle, setLessonTitle] = useState("")
  const [lessonType, setLessonType] = useState("TEXT")
  const [lessonContent, setLessonContent] = useState("")
  const [lessonVideoUrl, setLessonVideoUrl] = useState("")
  const [lessonTopic, setLessonTopic] = useState("")
  const [lessonLevel, setLessonLevel] = useState("Beginner")
  const [lessonKeywords, setLessonKeywords] = useState("")
  const [lessonAiContext, setLessonAiContext] = useState("")
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false)
  const [generateNotesError, setGenerateNotesError] = useState(null)

  // Quiz Modal State
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false)
  const [quizModuleId, setQuizModuleId] = useState(null)
  const [quizId, setQuizId] = useState(null)
  const [quizTitle, setQuizTitle] = useState("")
  const [quizPassMark, setQuizPassMark] = useState(70)
  const [quizTimeLimit, setQuizTimeLimit] = useState(10)
  const [quizQuestions, setQuizQuestions] = useState([
    { prompt: "", options: ["", "", "", ""], correctIndex: 0 },
  ])

  // Operation & Loading States
  const [savingDetails, setSavingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState("")
  const [togglingPublish, setTogglingPublish] = useState(false)
  const [deletingCourse, setDeletingCourse] = useState(false)
  const [savingModule, setSavingModule] = useState(false)
  const [moduleError, setModuleError] = useState("")
  const [deletingModuleId, setDeletingModuleId] = useState(null)
  const [savingLesson, setSavingLesson] = useState(false)
  const [lessonError, setLessonError] = useState("")
  const [deletingLessonId, setDeletingLessonId] = useState(null)
  const [savingQuiz, setSavingQuiz] = useState(false)
  const [quizError, setQuizError] = useState("")
  const [deletingQuiz, setDeletingQuiz] = useState(false)

  const fetchCourse = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/instructor/courses/${id}`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error("Course not found or access denied")
      const data = await res.json()
      setCourse(data.course)
      setCourseTitle(data.course.title)
      setCourseDesc(data.course.description || "")
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCourse()
  }, [id])

  // Course actions
  const handleTogglePublish = async () => {
    try {
      setTogglingPublish(true)
      const res = await fetch(`/api/instructor/courses/${id}/publish`, {
        method: "PATCH",
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to toggle publish status")
      setCourse((prev) => ({ ...prev, isPublished: data.course.isPublished }))
    } catch (err) {
      setError(err.message)
    } finally {
      setTogglingPublish(false)
    }
  }

  const handleUpdateCourseDetails = async (e) => {
    e.preventDefault()
    try {
      setSavingDetails(true)
      setDetailsError("")
      const res = await fetch(`/api/instructor/courses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: courseTitle.trim(),
          description: courseDesc.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update course details")
      setCourse((prev) => ({ ...prev, ...data.course }))
      setIsCourseModalOpen(false)
    } catch (err) {
      setDetailsError(err.message)
    } finally {
      setSavingDetails(false)
    }
  }

  const handleDeleteCourse = async () => {
    if (!window.confirm("Are you sure you want to delete this course and all its contents?")) {
      return
    }
    try {
      setDeletingCourse(true)
      const res = await fetch(`/api/instructor/courses/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "Failed to delete course")
      }
      navigate("/instructor")
    } catch (err) {
      setError(err.message)
      setDeletingCourse(false)
    }
  }

  // Module actions
  const openCreateModule = () => {
    setEditingModule(null)
    setModuleTitle("")
    setModuleError("")
    setIsModuleModalOpen(true)
  }

  const openEditModule = (mod) => {
    setEditingModule(mod)
    setModuleTitle(mod.title)
    setModuleError("")
    setIsModuleModalOpen(true)
  }

  const handleSaveModule = async (e) => {
    e.preventDefault()
    if (!moduleTitle.trim()) return

    try {
      setSavingModule(true)
      setModuleError("")
      if (editingModule) {
        const res = await fetch(`/api/instructor/modules/${editingModule.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ title: moduleTitle.trim() }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to update module")
      } else {
        const res = await fetch(`/api/instructor/courses/${id}/modules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ title: moduleTitle.trim() }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to create module")
      }

      setIsModuleModalOpen(false)
      await fetchCourse()
    } catch (err) {
      setModuleError(err.message)
    } finally {
      setSavingModule(false)
    }
  }

  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm("Delete this module and its lessons?")) return
    try {
      setDeletingModuleId(moduleId)
      const res = await fetch(`/api/instructor/modules/${moduleId}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "Failed to delete module")
      }
      await fetchCourse()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingModuleId(null)
    }
  }

  // Lesson actions
  const openCreateLesson = (moduleId) => {
    setActiveModuleId(moduleId)
    setEditingLesson(null)
    setLessonTitle("")
    setLessonType("TEXT")
    setLessonContent("")
    setLessonVideoUrl("")
    setLessonTopic("")
    setLessonLevel("Beginner")
    setLessonKeywords("")
    setLessonAiContext("")
    setLessonError("")
    setGenerateNotesError(null)
    setIsLessonModalOpen(true)
  }

  const openEditLesson = (moduleId, lesson) => {
    setActiveModuleId(moduleId)
    setEditingLesson(lesson)
    setLessonTitle(lesson.title)
    setLessonType(lesson.type)
    setLessonContent(lesson.content || "")
    setLessonVideoUrl(lesson.videoUrl || "")
    setLessonTopic(lesson.topic || "")
    setLessonLevel(lesson.level || "Beginner")
    setLessonKeywords(Array.isArray(lesson.keywords) ? lesson.keywords.join(", ") : "")
    setLessonAiContext(lesson.aiContext || "")
    setLessonError("")
    setGenerateNotesError(null)
    setIsLessonModalOpen(true)
  }

  const handleGenerateNotes = async () => {
    if (!lessonTitle.trim()) {
      setGenerateNotesError("Please enter a lesson title before generating notes.")
      return
    }

    try {
      setIsGeneratingNotes(true)
      setGenerateNotesError(null)
      const res = await fetch("/api/instructor/lessons/generate-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: lessonTitle.trim(),
          topic: lessonTopic.trim() || null,
          keywords: lessonKeywords
            ? lessonKeywords.split(",").map((k) => k.trim()).filter(Boolean)
            : [],
          level: lessonLevel.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate reference notes")
      }

      setLessonAiContext(data.notes || "")
    } catch (err) {
      setGenerateNotesError(err.message)
    } finally {
      setIsGeneratingNotes(false)
    }
  }

  const handleSaveLesson = async (e) => {
    e.preventDefault()
    if (!lessonTitle.trim()) return

    const payload = {
      title: lessonTitle.trim(),
      type: lessonType,
      content: lessonType === "TEXT" ? lessonContent : null,
      videoUrl: lessonType === "VIDEO" ? lessonVideoUrl.trim() : null,
      topic: lessonTopic.trim() || null,
      level: lessonLevel.trim() || null,
      keywords: lessonKeywords
        ? lessonKeywords.split(",").map((k) => k.trim()).filter(Boolean)
        : [],
      aiContext: lessonType === "VIDEO" ? lessonAiContext.trim() || null : null,
    }

    try {
      setSavingLesson(true)
      setLessonError("")
      if (editingLesson) {
        const res = await fetch(`/api/instructor/lessons/${editingLesson.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Failed to update lesson")
        }
      } else {
        const res = await fetch(`/api/instructor/modules/${activeModuleId}/lessons`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Failed to create lesson")
        }
      }

      setIsLessonModalOpen(false)
      await fetchCourse()
    } catch (err) {
      setLessonError(err.message)
    } finally {
      setSavingLesson(false)
    }
  }

  const handleDeleteLesson = async (lessonId) => {
    if (!window.confirm("Delete this lesson?")) return
    try {
      setDeletingLessonId(lessonId)
      const res = await fetch(`/api/instructor/lessons/${lessonId}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to delete lesson")
      await fetchCourse()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingLessonId(null)
    }
  }

  // Quiz actions
  const openQuizEditor = async (mod) => {
    setQuizModuleId(mod.id)
    setQuizError("")
    if (mod.quiz) {
      setQuizId(mod.quiz.id)
      try {
        const res = await fetch(`/api/instructor/modules/${mod.id}/quiz`, {
          credentials: "include",
        })
        if (res.ok) {
          const data = await res.json()
          setQuizTitle(data.quiz?.title || "Module Quiz")
          setQuizPassMark(data.quiz?.passMark ?? 70)
          setQuizTimeLimit(data.quiz?.timeLimitMin ?? 10)
          setQuizQuestions(
            data.quiz?.questions?.length > 0
              ? data.quiz.questions.map((q) => {
                  let opts = Array.isArray(q.options) ? [...q.options] : []
                  while (opts.length < 4) opts.push("")
                  opts = opts.slice(0, 4)
                  return {
                    prompt: q.prompt,
                    options: opts,
                    correctIndex: q.correctIndex ?? 0,
                  }
                })
              : [{ prompt: "", options: ["", "", "", ""], correctIndex: 0 }]
          )
        }
      } catch (err) {
        setQuizTitle("Module Quiz")
        setQuizPassMark(70)
        setQuizTimeLimit(10)
        setQuizQuestions([{ prompt: "", options: ["", "", "", ""], correctIndex: 0 }])
      }
    } else {
      setQuizId(null)
      setQuizTitle(`${mod.title} Assessment`)
      setQuizPassMark(70)
      setQuizTimeLimit(10)
      setQuizQuestions([{ prompt: "", options: ["", "", "", ""], correctIndex: 0 }])
    }
    setIsQuizModalOpen(true)
  }

  const handleAddQuestion = () => {
    setQuizQuestions((prev) => [
      ...prev,
      { prompt: "", options: ["", "", "", ""], correctIndex: 0 },
    ])
  }

  const handleRemoveQuestion = (idx) => {
    if (!window.confirm("Remove this question?")) return
    setQuizQuestions((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSaveQuiz = async (e) => {
    e.preventDefault()
    if (!quizTitle.trim()) return

    // Ensure all 4 options are filled for each question
    for (let i = 0; i < quizQuestions.length; i++) {
      const q = quizQuestions[i]
      if (!q.prompt.trim()) {
        setQuizError(`Question ${i + 1} prompt cannot be empty`)
        return
      }
      for (let j = 0; j < 4; j++) {
        if (!q.options[j]?.trim()) {
          setQuizError(`Question ${i + 1}, option ${String.fromCharCode(65 + j)} cannot be empty`)
          return
        }
      }
    }

    try {
      setSavingQuiz(true)
      setQuizError("")
      const res = await fetch(`/api/instructor/modules/${quizModuleId}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: quizTitle.trim(),
          passMark: Number(quizPassMark) || 70,
          timeLimitMin: Number(quizTimeLimit) || 10,
          questions: quizQuestions.map((q) => ({
            prompt: q.prompt.trim(),
            options: q.options.map((o) => o.trim()),
            correctIndex: Number(q.correctIndex),
          })),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save quiz")
      }

      setIsQuizModalOpen(false)
      await fetchCourse()
    } catch (err) {
      setQuizError(err.message)
    } finally {
      setSavingQuiz(false)
    }
  }

  const handleDeleteQuiz = async (quizIdToDelete) => {
    if (!window.confirm("Delete this module quiz?")) return
    try {
      setDeletingQuiz(true)
      setQuizError("")
      const res = await fetch(`/api/instructor/quizzes/${quizIdToDelete}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to delete quiz")
      setIsQuizModalOpen(false)
      await fetchCourse()
    } catch (err) {
      setQuizError(err.message)
    } finally {
      setDeletingQuiz(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading course editor...</p>
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="container mx-auto p-6 max-w-4xl text-center space-y-4">
        <p className="text-destructive">{error || "Course not found"}</p>
        <div>
          <BackButton fallbackPath="/instructor" label="Back to Courses" variant="outline" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-8">
      {/* Top Navigation & Status */}
      <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <BackButton fallbackPath="/instructor" />
            <span className="text-muted-foreground/60 text-xs">|</span>
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Link to="/instructor" className="hover:text-foreground hover:underline transition-colors">
                My Courses
              </Link>
              <span aria-hidden="true">&gt;</span>
              <span className="font-medium text-foreground truncate max-w-xs">{course.title}</span>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{course.title}</h1>
            <Badge variant={course.isPublished ? "success" : "secondary"}>
              {course.isPublished ? "Published" : "Draft"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {course.description || "No description provided."}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCourseModalOpen(true)}
            disabled={togglingPublish || deletingCourse}
          >
            Edit Details
          </Button>
          <Button
            variant={course.isPublished ? "outline" : "default"}
            size="sm"
            onClick={handleTogglePublish}
            disabled={togglingPublish || deletingCourse}
          >
            {togglingPublish
              ? "Updating..."
              : course.isPublished
              ? "Unpublish Course"
              : "Publish Course"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteCourse}
            disabled={deletingCourse || togglingPublish}
          >
            {deletingCourse ? "Deleting..." : "Delete Course"}
          </Button>
        </div>
      </div>

      {/* Curriculum Modules Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Curriculum Structure</h2>
            <p className="text-xs text-muted-foreground">
              Add modules, lessons, and module quizzes.
            </p>
          </div>
          <Button size="sm" onClick={openCreateModule}>
            + Add Module
          </Button>
        </div>

        {course.modules.length === 0 ? (
          <Card className="text-center p-8 border-dashed">
            <CardHeader>
              <CardTitle className="text-lg">No modules added</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Divide your course into structured chapters or modules.
              </p>
              <Button size="sm" onClick={openCreateModule}>
                Create First Module
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {course.modules.map((mod, modIdx) => (
              <Card key={mod.id} className="border">
                <CardHeader className="bg-muted/40 py-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Module {modIdx + 1}
                    </span>
                    <h3 className="font-semibold text-base">{mod.title}</h3>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant={mod.quiz ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => openQuizEditor(mod)}
                    >
                      {mod.quiz ? "Edit Quiz" : "+ Quiz"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openCreateLesson(mod.id)}
                    >
                      + Add Lesson
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModule(mod)}
                    >
                      Rename
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteModule(mod.id)}
                      disabled={deletingModuleId === mod.id}
                    >
                      {deletingModuleId === mod.id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  {/* Quiz banner if configured */}
                  {mod.quiz && (
                    <div className="flex items-center justify-between p-2.5 rounded-md border border-primary/20 bg-primary/5 text-xs">
                      <div className="flex items-center gap-2 font-medium">
                        <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 uppercase tracking-wider text-[10px]">
                          Assessment
                        </span>
                        <span>Quiz: {mod.quiz.title}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => openQuizEditor(mod)}
                      >
                        Configure
                      </Button>
                    </div>
                  )}

                  {mod.lessons.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 italic">
                      No lessons in this module. Click "+ Add Lesson" above.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {mod.lessons.map((lesson, lessIdx) => (
                        <div
                          key={lesson.id}
                          className="flex items-center justify-between p-3 rounded-md border bg-card hover:bg-muted/20 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted-foreground">
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
                                <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5">
                                  {lesson.level}
                                </span>
                              )}
                            </div>

                            {lesson.type === "VIDEO" && lesson.videoUrl && (
                              <p className="text-xs text-muted-foreground truncate max-w-md">
                                Embed URL: {lesson.videoUrl}
                              </p>
                            )}

                            {lesson.type === "TEXT" && lesson.content && (
                              <p className="text-xs text-muted-foreground line-clamp-1 max-w-md">
                                {lesson.content}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditLesson(mod.id, lesson)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteLesson(lesson.id)}
                              disabled={deletingLessonId === lesson.id}
                            >
                              {deletingLessonId === lesson.id ? "Deleting..." : "Delete"}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Course Details Modal */}
      <Dialog open={isCourseModalOpen} onClose={() => setIsCourseModalOpen(false)}>
        <DialogHeader>
          <DialogTitle>Edit Course Details</DialogTitle>
          <DialogDescription>Update the title and description for this course.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUpdateCourseDetails} className="space-y-4">
          {detailsError && <p className="text-xs text-destructive">{detailsError}</p>}
          <div className="space-y-2">
            <Label htmlFor="c-title">Course Title</Label>
            <Input
              id="c-title"
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-desc">Description</Label>
            <Textarea
              id="c-desc"
              value={courseDesc}
              onChange={(e) => setCourseDesc(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCourseModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={savingDetails}>
              {savingDetails ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Add / Edit Module Modal */}
      <Dialog open={isModuleModalOpen} onClose={() => setIsModuleModalOpen(false)}>
        <DialogHeader>
          <DialogTitle>{editingModule ? "Edit Module" : "Add Module"}</DialogTitle>
          <DialogDescription>
            {editingModule
              ? "Rename this module in your curriculum."
              : "Create a new chapter or module for your course."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSaveModule} className="space-y-4">
          {moduleError && <p className="text-xs text-destructive">{moduleError}</p>}
          <div className="space-y-2">
            <Label htmlFor="m-title">Module Title</Label>
            <Input
              id="m-title"
              placeholder="e.g. Getting Started"
              value={moduleTitle}
              onChange={(e) => setModuleTitle(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModuleModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={savingModule}>
              {savingModule ? "Saving..." : editingModule ? "Save" : "Add Module"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Add / Edit Lesson Modal */}
      <Dialog open={isLessonModalOpen} onClose={() => setIsLessonModalOpen(false)}>
        <DialogHeader>
          <DialogTitle>{editingLesson ? "Edit Lesson" : "Add Lesson"}</DialogTitle>
          <DialogDescription>
            Create text or video lesson content with YouTube support.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSaveLesson} className="space-y-4">
          {lessonError && <p className="text-xs text-destructive">{lessonError}</p>}
          <div className="space-y-2">
            <Label htmlFor="l-title">Lesson Title</Label>
            <Input
              id="l-title"
              placeholder="e.g. Component Architecture"
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Lesson Format</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={lessonType === "TEXT" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setLessonType("TEXT")}
              >
                Text Article
              </Button>
              <Button
                type="button"
                variant={lessonType === "VIDEO" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setLessonType("VIDEO")}
              >
                Video Lesson
              </Button>
            </div>
          </div>

          {lessonType === "VIDEO" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="l-url">YouTube Video URL</Label>
                <Input
                  id="l-url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={lessonVideoUrl}
                  onChange={(e) => setLessonVideoUrl(e.target.value)}
                  required={lessonType === "VIDEO"}
                />
                <p className="text-xs text-muted-foreground">
                  Paste any standard YouTube watch link or embed link; it will be automatically converted to an embed player.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="l-topic" className="text-xs">Topic</Label>
                  <Input
                    id="l-topic"
                    placeholder="e.g. Asynchronous JS"
                    value={lessonTopic}
                    onChange={(e) => setLessonTopic(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="l-level" className="text-xs">Level</Label>
                  <Input
                    id="l-level"
                    placeholder="e.g. Intermediate"
                    value={lessonLevel}
                    onChange={(e) => setLessonLevel(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="l-keywords" className="text-xs">Keywords</Label>
                  <Input
                    id="l-keywords"
                    placeholder="async, await, promise"
                    value={lessonKeywords}
                    onChange={(e) => setLessonKeywords(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-md border p-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold">AI Tutor Reference Context</h4>
                    <p className="text-[11px] text-muted-foreground">
                      Reference notes serve as the ground truth for the AI Tutor.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleGenerateNotes}
                    disabled={isGeneratingNotes}
                  >
                    {isGeneratingNotes ? "Generating Notes..." : "✨ Generate Notes"}
                  </Button>
                </div>

                {generateNotesError && (
                  <p className="text-xs text-destructive">{generateNotesError}</p>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="l-aicontext" className="text-xs">
                      Reference Notes (aiContext)
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      Editable — saving lesson approves these notes
                    </span>
                  </div>
                  <Textarea
                    id="l-aicontext"
                    rows={6}
                    placeholder="Click 'Generate Notes' or write reference notes explaining key concepts, definitions, and takeaways covered in the video..."
                    value={lessonAiContext}
                    onChange={(e) => setLessonAiContext(e.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="l-content">Lesson Content</Label>
                <Textarea
                  id="l-content"
                  rows={5}
                  placeholder="Write lesson notes, markdown, or instructions..."
                  value={lessonContent}
                  onChange={(e) => setLessonContent(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="l-level">Level</Label>
                  <Input
                    id="l-level"
                    placeholder="Beginner, Advanced..."
                    value={lessonLevel}
                    onChange={(e) => setLessonLevel(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="l-keywords">Keywords</Label>
                  <Input
                    id="l-keywords"
                    placeholder="react, jsx, hooks"
                    value={lessonKeywords}
                    onChange={(e) => setLessonKeywords(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsLessonModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={savingLesson}>
              {savingLesson ? "Saving..." : editingLesson ? "Save Changes" : "Create Lesson"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Quiz Modal */}
      <Dialog open={isQuizModalOpen} onClose={() => setIsQuizModalOpen(false)}>
        <DialogHeader>
          <DialogTitle>{quizId ? "Edit Module Quiz" : "Create Module Quiz"}</DialogTitle>
          <DialogDescription>
            Add multiple choice questions with a designated correct answer.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSaveQuiz} className="space-y-4">
          {quizError && <p className="text-xs text-destructive">{quizError}</p>}
          <div className="space-y-2">
            <Label htmlFor="q-title">Quiz Title</Label>
            <Input
              id="q-title"
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              placeholder="e.g. Module 1 Knowledge Check"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="q-passmark">Pass Mark (%)</Label>
              <Input
                id="q-passmark"
                type="number"
                min={1}
                max={100}
                value={quizPassMark}
                onChange={(e) => setQuizPassMark(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="q-timelimit">Time Limit (Minutes)</Label>
              <Input
                id="q-timelimit"
                type="number"
                min={1}
                max={180}
                value={quizTimeLimit}
                onChange={(e) => setQuizTimeLimit(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <Label>Multiple-Choice Questions ({quizQuestions.length})</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddQuestion}>
                + Add Question
              </Button>
            </div>

            {quizQuestions.map((q, qIdx) => (
              <div key={qIdx} className="p-3 border rounded-md space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase">Question {qIdx + 1}</span>
                  {quizQuestions.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-destructive hover:text-destructive"
                      onClick={() => handleRemoveQuestion(qIdx)}
                    >
                      Remove
                    </Button>
                  )}
                </div>

                <Input
                  placeholder="Enter question prompt..."
                  value={q.prompt}
                  onChange={(e) =>
                    setQuizQuestions((prev) =>
                      prev.map((item, i) =>
                        i === qIdx ? { ...item, prompt: e.target.value } : item
                      )
                    )
                  }
                  required
                />

                <div className="space-y-2 pl-1">
                  <span className="text-xs text-muted-foreground block">
                    4 Options (select radio for the correct answer):
                  </span>
                  {[0, 1, 2, 3].map((optIdx) => (
                    <div key={optIdx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        id={`opt-${qIdx}-${optIdx}`}
                        name={`correct-${qIdx}`}
                        checked={q.correctIndex === optIdx}
                        onChange={() =>
                          setQuizQuestions((prev) =>
                            prev.map((item, i) =>
                              i === qIdx ? { ...item, correctIndex: optIdx } : item
                            )
                          )
                        }
                        className="h-4 w-4 text-primary"
                      />
                      <span className="text-xs font-mono font-bold w-4">
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <Input
                        placeholder={`Option ${String.fromCharCode(65 + optIdx)} text`}
                        value={q.options[optIdx] || ""}
                        onChange={(e) =>
                          setQuizQuestions((prev) =>
                            prev.map((item, i) => {
                              if (i !== qIdx) return item
                              const newOpts = [...item.options]
                              newOpts[optIdx] = e.target.value
                              return { ...item, options: newOpts }
                            })
                          )
                        }
                        required
                        className="h-8 text-xs flex-1"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="flex justify-between items-center pt-4">
            {quizId && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteQuiz(quizId)}
                disabled={deletingQuiz || savingQuiz}
              >
                {deletingQuiz ? "Deleting..." : "Delete Quiz"}
              </Button>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsQuizModalOpen(false)}
                disabled={savingQuiz || deletingQuiz}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingQuiz || deletingQuiz}>
                {savingQuiz ? "Saving..." : "Save Quiz"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
