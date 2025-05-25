type ToastType = "default" | "success" | "error" | "warning" | "info"

interface ToastOptions {
  message: string
  type?: ToastType
  duration?: number
}

const ICONS: Record<ToastType, string> = {
  default: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>`,
  success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 12l2 2 4-4"/>
    <circle cx="12" cy="12" r="10"/>
  </svg>`,
  error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12" y2="16"/>
  </svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10.29 3.86l-6.63 11.48A1 1 0 004.62 17h14.76a1 1 0 00.86-1.66L13.71 3.86a1 1 0 00-1.72 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>`,
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
    case "success": return "bg-green-600"    
    case "error": return "bg-red-600"      
    case "warning": return "bg-yellow-600"   
    case "info": return "bg-blue-600"      
    default: return "bg-blue-600"          
  }
}


function getIconColor(type: ToastType): string {
  switch (type) {
    case "success": return "#fffff"
    case "error": return "#fffff"
    case "warning": return "#fffff"
    case "info": return "#fffff"
    default: return "#fffff"
  }
}

function getToastTextColor(type: ToastType): string {
  switch (type) {
    case "success": return "text-white"
    case "error": return "text-white"
    case "warning": return "text-black"
    case "info": return "text-white"
    default: return "text-white"
  }
}

export function showToast({ message, type = "default", duration = 3000 }: ToastOptions): void {
  const container = getOrCreateToastContainer()

  const toast = document.createElement("div")
  toast.style.padding = "12px 16px"
  toast.style.borderRadius = "6px"
  toast.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)"
  toast.style.marginBottom = "8px"
  toast.style.wordBreak = "break-word"
  toast.style.opacity = "0"
  toast.style.transform = "translateY(10px)"
  toast.style.transition = "opacity 0.3s, transform 0.3s"
  toast.style.display = "flex"
  toast.className = `${getBackgroundColor(type)} backdrop-blur border ${getToastTextColor(type)} md:text-base text-xs max-w-[200px] md:max-w-[500px]`
  toast.style.alignItems = "center"
  toast.style.justifyContent = "space-between"

  
  const iconContainer = document.createElement("div")
  iconContainer.style.marginRight = "8px"
  iconContainer.style.display = "flex"
  iconContainer.style.alignItems = "center"
  iconContainer.style.fontSize = "2em"
  iconContainer.style.color = getIconColor(type)
  iconContainer.innerHTML = `<div style="width: 1.2em; height: 1.2em;">${ICONS[type]}</div>`
  iconContainer.className = "mr-4"
  toast.appendChild(iconContainer)

  
  const messageSpan = document.createElement("span")
  messageSpan.textContent = message
  messageSpan.style.flex = "1"
  messageSpan.style.marginRight = "8px"
  toast.appendChild(messageSpan)

  
  const closeButton = document.createElement("button");
  closeButton.style.background = "transparent";
  closeButton.style.border = "none";
  closeButton.style.color = "black"; 
  closeButton.style.fontSize = "16px";
  closeButton.style.cursor = "pointer";
  closeButton.style.marginLeft = "8px";
  closeButton.style.display = "flex";
  closeButton.style.alignItems = "center";
  closeButton.style.justifyContent = "center";
  closeButton.style.padding = "0";
  closeButton.style.outline = "none";
  closeButton.ariaLabel = "Close toast";
  closeButton.onclick = () => removeToast(toast);
  
  const xIcon = document.createElement("div");
  xIcon.innerHTML = `
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    stroke-width="2" 
    stroke-linecap="round" 
    stroke-linejoin="round" 
    width="16" 
    height="16"
    style="color: inherit;"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>`;
  closeButton.appendChild(xIcon);
  toast.appendChild(closeButton);
  

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
  info: (message: string, duration?: number) => showToast({ message, type: "info", duration }),
}
