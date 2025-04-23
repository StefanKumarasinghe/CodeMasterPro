/**
 * Ultra-simple toast utility that directly manipulates the DOM
 * This bypasses React's rendering cycle completely
 */

type ToastType = "default" | "success" | "error" | "warning"

interface ToastOptions {
  message: string
  type?: ToastType
  duration?: number
}

// Create a container for toasts if it doesn't exist
function getOrCreateToastContainer(): HTMLElement {
  let container = document.getElementById("simple-toast-container")

  if (!container) {
    container = document.createElement("div")
    container.id = "simple-toast-container"
    container.style.position = "fixed"
    container.style.top = "20px"
    container.style.right = "20px"
    container.style.zIndex = "9999"
    container.style.display = "flex"
    container.style.flexDirection = "column"
    container.style.gap = "10px"
    document.body.appendChild(container)
  }

  return container
}

// Get background color based on toast type
function getBackgroundColor(type: ToastType): string {
  switch (type) {
    case "success":
      return "#22c55e"
    case "error":
      return "#f43f5e"
    case "warning":
      return "#fbbf24"
    default:
      return "#60a5fa"
  }
}

// Show a toast notification
export function showToast({ message, type = "default", duration = 3000 }: ToastOptions): void {
  const container = getOrCreateToastContainer()

  // Create toast element
  const toast = document.createElement("div")
  toast.style.backgroundColor = getBackgroundColor(type)
  toast.style.color = "white"
  toast.style.padding = "12px 16px"
  toast.style.borderRadius = "6px"
  toast.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)"
  toast.style.marginBottom = "8px"
  toast.style.maxWidth = "300px"
  toast.style.wordBreak = "break-word"
  toast.style.opacity = "0"
  toast.style.transform = "translateY(10px)"
  toast.style.transition = "opacity 0.3s, transform 0.3s"
  toast.textContent = message

  // Add close button
  const closeButton = document.createElement("button")
  closeButton.textContent = "×"
  closeButton.style.marginLeft = "8px"
  closeButton.style.background = "transparent"
  closeButton.style.border = "none"
  closeButton.style.color = "white"
  closeButton.style.fontSize = "16px"
  closeButton.style.cursor = "pointer"
  closeButton.style.float = "right"
  closeButton.onclick = () => removeToast(toast)
  toast.appendChild(closeButton)

  // Add to container
  container.appendChild(toast)

  // Trigger animation
  setTimeout(() => {
    toast.style.opacity = "1"
    toast.style.transform = "translateY(0)"
  }, 10)

  // Auto-remove after duration
  if (duration !== Number.POSITIVE_INFINITY) {
    setTimeout(() => {
      removeToast(toast)
    }, duration)
  }
}

// Remove a toast element with animation
function removeToast(toast: HTMLElement): void {
  toast.style.opacity = "0"
  toast.style.transform = "translateY(10px)"

  // Remove from DOM after animation completes
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast)
    }
  }, 300)
}

// Convenience methods
export const toast = {
  show: (message: string, options?: Omit<ToastOptions, "message">) => showToast({ message, ...options }),

  success: (message: string, duration?: number) => showToast({ message, type: "success", duration }),

  error: (message: string, duration?: number) => showToast({ message, type: "error", duration }),

  warning: (message: string, duration?: number) => showToast({ message, type: "warning", duration }),
}
