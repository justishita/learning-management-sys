import { useAuth } from "@/context/AuthContext"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

export default function Courses() {
  const { user } = useAuth()

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Courses</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {user?.name || user?.email}. Browse available published courses.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Dashboard</CardTitle>
          <CardDescription>Role: {user?.role}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No courses enrolled yet. Available published courses will appear here.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
