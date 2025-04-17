"use client"

// Import from the new toast utility instead of the old context
import { toast } from "@/utils/toast-util"

// Re-export the toast for backward compatibility
export const useToast = () => {
  // Return an object with a toast method that matches the expected API
  return {
    toast: (options: { description: string; title?: string; variant?: string; duration?: number }) => {
      const type = options.variant === "destructive" ? "error" : "default"
      toast.show(options.description, {
        title: options.title,
        type,
        duration: options.duration,
      })
    },
  }
}
