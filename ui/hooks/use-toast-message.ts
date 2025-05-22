"use client"

import { toast } from "@/utils/toast-util"

export const useToast = () => {
  return {
    toast: (options: { description: string; title?: string; variant?: string; duration?: number }) => {
      const type = options.variant === "destructive" ? "error" : "default"
      toast.show(options.description, {
        type,
        duration: options.duration,
      })
    },
  }
}
