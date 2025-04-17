"use client"

import type React from "react"
import { createContext, useContext, useState, useCallback } from "react"
import { SimpleToast } from "./simple-toast"
import { v4 as uuidv4 } from "uuid"

export type ToastType = "default" | "success" | "error" | "warning"

export interface ToastMessage {
  id: string
  title?: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextType {
  toasts: ToastMessage[]
  addToast: (toast: Omit<ToastMessage, "id">) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const useToastMessage = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToastMessage must be used within a ToastProvider")
  }
  return context
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = uuidv4()
    const newToast = { ...toast, id }

    setToasts((prevToasts) => [...prevToasts, newToast])

    // Auto-remove toast after duration
    if (toast.duration !== Number.POSITIVE_INFINITY) {
      const duration = toast.duration || 3000
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <SimpleToast
            key={toast.id}
            id={toast.id}
            title={toast.title}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// Utility function to show toast without using the hook
let toastContextValue: ToastContextType | undefined

export const setToastContext = (context: ToastContextType) => {
  toastContextValue = context
}

export const toast = {
  show: (message: string, options?: { title?: string; type?: ToastType; duration?: number }) => {
    if (!toastContextValue) {
      console.error("Toast context not available")
      return
    }

    toastContextValue.addToast({
      message,
      title: options?.title,
      type: options?.type || "default",
      duration: options?.duration || 3000,
    })
  },
  success: (message: string, options?: { title?: string; duration?: number }) => {
    toast.show(message, { ...options, type: "success" })
  },
  error: (message: string, options?: { title?: string; duration?: number }) => {
    toast.show(message, { ...options, type: "error" })
  },
  warning: (message: string, options?: { title?: string; duration?: number }) => {
    toast.show(message, { ...options, type: "warning" })
  },
}
