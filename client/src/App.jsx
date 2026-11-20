import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth, getRoleRedirectPath } from "@/context/AuthContext"
import { Navbar } from "@/components/Navbar"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { GuestRoute } from "@/components/GuestRoute"
import Login from "@/pages/Login"
import Signup from "@/pages/Signup"
import Courses from "@/pages/Courses"
import CourseDetail from "@/pages/CourseDetail"
import LessonViewer from "@/pages/LessonViewer"
import QuizTaker from "@/pages/QuizTaker"
import Instructor from "@/pages/Instructor"
import CourseEditor from "@/pages/CourseEditor"

function RootRedirect() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading session...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={getRoleRedirectPath(user.role)} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-background text-foreground flex flex-col">
          <Navbar />
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route
                path="/login"
                element={
                  <GuestRoute>
                    <Login />
                  </GuestRoute>
                }
              />
              <Route
                path="/signup"
                element={
                  <GuestRoute>
                    <Signup />
                  </GuestRoute>
                }
              />
              <Route
                path="/courses"
                element={
                  <ProtectedRoute allowedRole="STUDENT">
                    <Courses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/courses/:id"
                element={
                  <ProtectedRoute allowedRole="STUDENT">
                    <CourseDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/courses/:id/lessons/:lessonId"
                element={
                  <ProtectedRoute allowedRole="STUDENT">
                    <LessonViewer />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/quizzes/:id"
                element={
                  <ProtectedRoute allowedRole="STUDENT">
                    <QuizTaker />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/instructor"
                element={
                  <ProtectedRoute allowedRole="INSTRUCTOR">
                    <Instructor />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/instructor/courses/:id"
                element={
                  <ProtectedRoute allowedRole="INSTRUCTOR">
                    <CourseEditor />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
