import * as React from "react"
import { cn } from "@/lib/utils"

export function Dialog({ open, onClose, className, children }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        className={cn(
          "relative z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border bg-background p-6 shadow-lg",
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ className, ...props }) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 text-center sm:text-left mb-4", className)}
      {...props}
    />
  )
}

export function DialogTitle({ className, ...props }) {
  return (
    <h2
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
}

export function DialogDescription({ className, ...props }) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export function DialogFooter({ className, ...props }) {
  return (
    <div
      className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6", className)}
      {...props}
    />
  )
}
