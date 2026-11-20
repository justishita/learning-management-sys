import { Navigate, useLocation } from "react-router-dom"
import { useAuth, getRoleRedirectPath } from "@/context/AuthContext"

export function ProtectedRoute({ children, allowedRole }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading session...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={getRoleRedirectPath(user.role)} replace />
  }

  return children
}
