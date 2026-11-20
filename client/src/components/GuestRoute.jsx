import { Navigate } from "react-router-dom"
import { useAuth, getRoleRedirectPath } from "@/context/AuthContext"

export function GuestRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading session...</p>
      </div>
    )
  }

  if (user) {
    return <Navigate to={getRoleRedirectPath(user.role)} replace />
  }

  return children
}
