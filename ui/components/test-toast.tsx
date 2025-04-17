"use client"

import { Button } from "@/components/ui/button"
import { toast } from "@/utils/toast-util"

export function TestToast() {
  const showDefaultToast = () => {
    toast.show("This is a default toast notification")
  }

  const showSuccessToast = () => {
    toast.success("Operation completed successfully")
  }

  const showErrorToast = () => {
    toast.error("Something went wrong")
  }

  const showWarningToast = () => {
    toast.warning("This action might have consequences")
  }

  return (
    <div className="flex flex-wrap gap-2 p-4">
      <Button onClick={showDefaultToast}>Default Toast</Button>
      <Button onClick={showSuccessToast} className="bg-green-600 hover:bg-green-700">
        Success Toast
      </Button>
      <Button onClick={showErrorToast} variant="destructive">
        Error Toast
      </Button>
      <Button onClick={showWarningToast} className="bg-yellow-600 hover:bg-yellow-700">
        Warning Toast
      </Button>
    </div>
  )
}
