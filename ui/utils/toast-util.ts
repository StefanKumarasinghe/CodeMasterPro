type ToastType = "default" | "success" | "error" | "warning"

interface ToastOptions {
  message: string
  type?: ToastType
  duration?: number
}

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

export function showToast({ message, type = "default", duration = 3000 }: ToastOptions): void {
  const container = getOrCreateToastContainer()

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

  container.appendChild(toast)

  setTimeout(() => {
    toast.style.opacity = "1"
    toast.style.transform = "translateY(0)"
  }, 10)

  if (duration !== Number.POSITIVE_INFINITY) {
    setTimeout(() => {
      removeToast(toast)
    }, duration)
  }
}


function removeToast(toast: HTMLElement): void {
  toast.style.opacity = "0"
  toast.style.transform = "translateY(10px)"

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast)
    }
  }, 300)
}

export const toast = {
  show: (message: string, options?: Omit<ToastOptions, "message">) => showToast({ message, ...options }),

  success: (message: string, duration?: number) => showToast({ message, type: "success", duration }),

  error: (message: string, duration?: number) => showToast({ message, type: "error", duration }),

  warning: (message: string, duration?: number) => showToast({ message, type: "warning", duration }),
  
  info: (message: string, duration?: number) => showToast({ message, type: "default", duration }),
}
