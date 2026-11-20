import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function App() {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(false)

  const checkHealth = () => {
    setLoading(true)
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch((err) => console.error("Health check error:", err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    checkHealth()
  }, [])

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full border rounded-lg p-6 bg-card text-card-foreground shadow-sm space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">LMS Platform</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monorepo client configured with React, Tailwind CSS, and shadcn/ui.
          </p>
        </div>

        <div className="rounded-md bg-muted p-3 text-xs font-mono break-all">
          API Health: {health ? JSON.stringify(health) : "Checking..."}
        </div>

        <Button onClick={checkHealth} disabled={loading} className="w-full">
          {loading ? "Refreshing..." : "Refresh Health"}
        </Button>
      </div>
    </main>
  )
}
