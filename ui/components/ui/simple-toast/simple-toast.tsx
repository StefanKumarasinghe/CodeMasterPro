"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react"
import type { ToastType } from "./toast-context"
import { cn } from "@/lib/utils"

interface SimpleToastProps {
  id: string
  title?: string
  message: string
  type: ToastType
  onClose: () => void
}

export const SimpleToast: React.FC<SimpleToastProps> = ({ id, title, message, type, onClose }) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Trigger entrance animation after mount
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 10)

    return () => clearTimeout(timer)
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    // Wait for exit animation to complete before removing
    setTimeout(onClose, 300)
  }

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      default:
        return <Info className="h-5 w-5 text-blue-500" />
    }
  }

  const getToastClasses = () => {
    const baseClasses =
      "max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 mb-3 transition-all duration-300 ease-in-out"

    const visibilityClasses = isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"

    const typeClasses = {
      default: "ring-gray-200 dark:ring-gray-700",
      success: "ring-green-200 dark:ring-green-800",
      error: "ring-red-200 dark:ring-red-800",
      warning: "ring-yellow-200 dark:ring-yellow-800",
    }

    return cn(baseClasses, visibilityClasses, typeClasses[type])
  }

  return (
    <div className={getToastClasses()}>
      <div className="flex-1 p-4 w-0">
        <div className="flex items-start">
          <div className="flex-shrink-0">{getIcon()}</div>
          <div className="ml-3 flex-1">
            {title && <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</p>}
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{message}</p>
          </div>
        </div>
      </div>
      <div className="flex border-l border-gray-200 dark:border-gray-700">
        <button
          onClick={handleClose}
          className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
