"use client"

import type React from "react"
import { useEffect } from "react"
import { ToastProvider as InternalToastProvider, useToastMessage, setToastContext } from "./toast-context"

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <InternalToastProvider>
      <ToastContextInitializer>{children}</ToastContextInitializer>
    </InternalToastProvider>
  )
}

// This component is used to initialize the toast context for the global toast function
const ToastContextInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toastContext = useToastMessage()

  useEffect(() => {
    setToastContext(toastContext)
  }, [toastContext])

  return <>{children}</>
}
