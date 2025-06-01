"use client"

import { ChatHeader } from "./chat-header"
import { ChatMessageList } from "./chat-message-list"
import { ChatInput } from "./chat-input"
import { useChat } from "@/context/chat-context"
import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface SidebarStateDetail {
  isOpen: boolean
  width: number
}

type ActiveSidebar = "python" | "code" | "test-runner" | "bash" | null

export function ChatLayout() {
  const { language, isLoading } = useChat()
  const [activeSidebar, setActiveSidebar] = useState<ActiveSidebar>(null)
  const [sidebarWidth, setSidebarWidth] = useState(0)
  const [editorWidth, setEditorWidth] = useState(0)
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(250) 
  const layoutRef = useRef<HTMLDivElement>(null)
  const [mainContentWidth, setMainContentWidth] = useState(0)
  const [isResizing, setIsResizing] = useState(false)

  const calculateMainContentWidth = () => {
    if (!layoutRef.current) return 0

    const viewportWidth = window.innerWidth
    const leftSidebarWidthValue = leftSidebarWidth

    const rightSidebarWidthValue = sidebarWidth

    const availableWidth = viewportWidth - leftSidebarWidthValue - rightSidebarWidthValue

    document.documentElement.style.setProperty("--main-content-width", `${availableWidth}px`)

    return availableWidth
  }

  useEffect(() => {
    const handleSidebarWidthChange = (event: CustomEvent<{ width: number }>) => {
      if (event.detail && typeof event.detail.width === "number") {
        setLeftSidebarWidth(event.detail.width)
        setIsResizing(true)

        setTimeout(() => {
          setMainContentWidth(calculateMainContentWidth())
          setIsResizing(false)
        }, 10)
      }
    }

    window.addEventListener("sidebar-width-change", handleSidebarWidthChange as EventListener)
    window.addEventListener("sidebar-resize", handleSidebarWidthChange as EventListener)

    return () => {
      window.removeEventListener("sidebar-width-change", handleSidebarWidthChange as EventListener)
      window.removeEventListener("sidebar-resize", handleSidebarWidthChange as EventListener)
    }
  }, [sidebarWidth])

  useEffect(() => {
    const handlePythonShellState = (event: CustomEvent<SidebarStateDetail>) => {
      if (event.detail && typeof event.detail.isOpen === "boolean" && typeof event.detail.width === "number") {
        const { isOpen, width } = event.detail

        if (isOpen) {
          window.dispatchEvent(
            new CustomEvent("code-editor-close", {
              detail: { forced: true },
            }),
          )

          window.dispatchEvent(
            new CustomEvent("html-preview-close", {
              detail: { forced: true },
            }),
          )

          window.dispatchEvent(
            new CustomEvent("node-test-runner-close", {
              detail: { forced: true },
            }),
          )

          setTimeout(() => {
            setActiveSidebar("python")
            setSidebarWidth(width)
            setMainContentWidth(calculateMainContentWidth())

            if (layoutRef.current) {
              layoutRef.current.style.paddingRight = `${width}px`
              document.documentElement.style.setProperty("--right-sidebar-width", `${width}px`)
            }
          }, 50)
        } else if (activeSidebar === "python") {
          setActiveSidebar(null)
          setSidebarWidth(0)
          setMainContentWidth(calculateMainContentWidth())

          if (layoutRef.current) {
            layoutRef.current.style.paddingRight = "0px"
            document.documentElement.style.setProperty("--right-sidebar-width", "0px")
          }
        }
      }
    }

    const handleBashShellState = (event: CustomEvent<SidebarStateDetail>) => {
      if (event.detail && typeof event.detail.isOpen === "boolean" && typeof event.detail.width === "number") {
        const { isOpen, width } = event.detail

        if (isOpen) {
          window.dispatchEvent(
            new CustomEvent("code-editor-close", {
              detail: { forced: true },
            }),
          )

          window.dispatchEvent(
            new CustomEvent("python-shell-close", {
              detail: { forced: true },
            }),
          )

          window.dispatchEvent(
            new CustomEvent("html-preview-close", {
              detail: { forced: true },
            }),
          )

          window.dispatchEvent(
            new CustomEvent("node-test-runner-close", {
              detail: { forced: true },
            }),
          )

          setTimeout(() => {
            setActiveSidebar("bash")
            setSidebarWidth(width)
            setMainContentWidth(calculateMainContentWidth())

            if (layoutRef.current) {
              layoutRef.current.style.paddingRight = `${width}px`
              document.documentElement.style.setProperty("--right-sidebar-width", `${width}px`)
            }
          }, 50)
        } else if (activeSidebar === "bash") {
          setActiveSidebar(null)
          setSidebarWidth(0)
          setMainContentWidth(calculateMainContentWidth())

          if (layoutRef.current) {
            layoutRef.current.style.paddingRight = "0px"
            document.documentElement.style.setProperty("--right-sidebar-width", "0px")
          }
        }
      }
    }

    const handleCodeEditorState = (event: CustomEvent<SidebarStateDetail>) => {
      if (event.detail && typeof event.detail.isOpen === "boolean" && typeof event.detail.width === "number") {
        const { isOpen, width } = event.detail || {}
        if (isOpen) {
          window.dispatchEvent(new CustomEvent("python-shell-close", { detail: { forced: true } }))
          window.dispatchEvent(new CustomEvent("node-test-runner-close", { detail: { forced: true } }))
          window.dispatchEvent(new CustomEvent("html-preview-close", { detail: { forced: true } }))
          setTimeout(() => {
            setActiveSidebar("code")
            setSidebarWidth(width)
            setEditorWidth(width)
            setMainContentWidth(calculateMainContentWidth())

            if (layoutRef.current) {
              layoutRef.current.style.paddingRight = `${width}px`
              document.documentElement.style.setProperty("--right-sidebar-width", `${width}px`)
            }
          }, 50)
        } else if (activeSidebar === "code") {
          setActiveSidebar(null)
          setSidebarWidth(0)
          setEditorWidth(0)
          setMainContentWidth(calculateMainContentWidth())

          if (layoutRef.current) {
            layoutRef.current.style.paddingRight = "0px"
            document.documentElement.style.setProperty("--right-sidebar-width", "0px")
          }
        }
      }
    }

    const handleMemoryCleared = () => {
      setActiveSidebar(null)
      setSidebarWidth(0)
      setEditorWidth(0)
      setMainContentWidth(calculateMainContentWidth())

      if (layoutRef.current) {
        layoutRef.current.style.paddingRight = "0px"
        document.documentElement.style.setProperty("--right-sidebar-width", "0px")
      }

      window.dispatchEvent(new CustomEvent("python-shell-close", { detail: { forced: true } }))
      window.dispatchEvent(new CustomEvent("code-editor-close", { detail: { forced: true } }))
      window.dispatchEvent(new CustomEvent("bash-shell-close", { detail: { forced: true } }))
    }

    const handleSidebarResize = () => {
      setMainContentWidth(calculateMainContentWidth())
      setIsResizing(true)
      setTimeout(() => setIsResizing(false), 100)
    }

    const handleWindowResize = () => {
      setMainContentWidth(calculateMainContentWidth())
    }

    const handleNodeTestRunnerState = (event: CustomEvent<SidebarStateDetail>) => {
      if (event.detail && typeof event.detail.isOpen === "boolean" && typeof event.detail.width === "number") {
        const { isOpen, width } = event.detail

        if (isOpen) {
          window.dispatchEvent(
            new CustomEvent("code-editor-close", {
              detail: { forced: true },
            }),
          )
          
          window.dispatchEvent(
            new CustomEvent("python-shell-close", {
              detail: { forced: true },
            }),
          )
          
          window.dispatchEvent(
            new CustomEvent("html-preview-close", {
              detail: { forced: true },
            }),
          )

          setTimeout(() => {
            setActiveSidebar("test-runner")
            setSidebarWidth(width)
            setMainContentWidth(calculateMainContentWidth())

            if (layoutRef.current) {
              layoutRef.current.style.paddingRight = `${width}px`
              document.documentElement.style.setProperty("--right-sidebar-width", `${width}px`)
            }
          }, 50)
        } else if (activeSidebar === "test-runner") {
          setActiveSidebar(null)
          setSidebarWidth(0)
          setMainContentWidth(calculateMainContentWidth())

          if (layoutRef.current) {
            layoutRef.current.style.paddingRight = "0px"
            document.documentElement.style.setProperty("--right-sidebar-width", "0px")
            console.log("test-runner closed 3")
          }
          
          setIsResizing(true)
          setActiveSidebar(null)
          setSidebarWidth(0)
          setMainContentWidth(calculateMainContentWidth())
          
          setTimeout(() => {
            window.dispatchEvent(new Event('resize'))
            window.dispatchEvent(new CustomEvent("sidebar-resize"))
            setIsResizing(false)
          }, 150)
        }
      }
    }

    window.addEventListener("python-shell-state", handlePythonShellState as EventListener)
    window.addEventListener("code-editor-state", handleCodeEditorState as EventListener)
    window.addEventListener("memory-cleared", handleMemoryCleared)
    window.addEventListener("sidebar-resize", handleSidebarResize)
    window.addEventListener("resize", handleWindowResize)
    window.addEventListener("node-test-runner-state", handleNodeTestRunnerState as EventListener)
    window.addEventListener("bash-shell-state", handleBashShellState as EventListener)
    setMainContentWidth(calculateMainContentWidth())

    const resizeObserver = new ResizeObserver(() => {
      setMainContentWidth(calculateMainContentWidth())
    })

    if (layoutRef.current) {
      resizeObserver.observe(layoutRef.current)
    }

    return () => {
      window.removeEventListener("python-shell-state", handlePythonShellState as EventListener)
      window.removeEventListener("code-editor-state", handleCodeEditorState as EventListener)
      window.removeEventListener("memory-cleared", handleMemoryCleared)
      window.removeEventListener("sidebar-resize", handleSidebarResize)
      window.removeEventListener("resize", handleWindowResize)
      window.removeEventListener("node-test-runner-state", handleNodeTestRunnerState as EventListener)
      window.removeEventListener("bash-shell-state", handleBashShellState as EventListener)
      resizeObserver.disconnect()
    }
  }, [activeSidebar, sidebarWidth, leftSidebarWidth])


  useEffect(() => {
    setMainContentWidth(calculateMainContentWidth())
  }, [sidebarWidth])


  return (
   <div
      ref={layoutRef}
      className={cn(
        "flex flex-col md:h-screen overflow-y-auto transition-all duration-300",
        activeSidebar ? "with-sidebar" : ""
      )}

    >
      <ChatHeader />
      <div className="flex-1 overflow-y-auto scrollbar-hide relative w-full  max-w-full">
        <ChatMessageList 
          language={language} 
          isLoading={isLoading}
          editorWidth={editorWidth}
          isResizing={isResizing}
        />
      </div>
      <ChatInput />
    </div>
  )
}
