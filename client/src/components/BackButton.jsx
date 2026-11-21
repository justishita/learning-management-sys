import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"

export function BackButton({
  fallbackPath = "/",
  label = "Back",
  className = "",
  ...props
}) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1)
    } else {
      navigate(fallbackPath)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className={`h-8 px-2 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 ${className}`}
      {...props}
    >
      <span aria-hidden="true">&larr;</span>
      <span>{label}</span>
    </Button>
  )
}

export default BackButton
