"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { API_ENDPOINT } from "@/config/constants"
import { Copy, Download, ThumbsUp, ThumbsDown, RefreshCcw, SparkleIcon, Save } from "lucide-react"
import { extractCodeBlocks } from "@/utils/chat-utils"
import { toast } from "@/utils/toast-util"
import { useState, useCallback, memo, Suspense, useRef, useEffect } from "react"
import type { Message } from "ai"
import { useChat } from "@/context/chat-context"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import MessageContent from "./message-content"
import { CodeEditorCanvas } from "../canvas/code-editor-canvas"
import { SaveToFileDialog } from "./save-to-file-dialog"

interface ChatMessageProps {
  message: Message
  language: string
  syntaxHighlighting: boolean
  showLineNumbers: boolean
  onCodeAction: (action: string, code: string, lang: string) => void
  editorWidth?: number
  isResizing?: boolean
}

const ChatMessage = memo(function ChatMessage({
  message,
  language,
  syntaxHighlighting,
  showLineNumbers,
  onCodeAction,
  isResizing = false,
}: Readonly<ChatMessageProps>) {
  const [isCopied, setIsCopied] = useState(false)
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null)
  const contentRef = useRef<string>("")
  const { handleSubmit, mcp } = useChat()
  const [showEditor, setShowEditor] = useState(false)
  const [editorPosition, setEditorPosition] = useState({ x: 0, y: 0, width: 0 })
  const messageContentRef = useRef<HTMLDivElement>(null)
  const [mainContentWidth, setMainContentWidth] = useState(0)
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  useEffect(() => {
    contentRef.current = typeof message.content === "string" ? message.content : ""
  }, [message.content])

  useEffect(() => {
    const handleEditorPositionChange = (e: CustomEvent) => {
      if (e.detail) {
        setEditorPosition({
          x: e.detail.x,
          y: e.detail.y,
          width: e.detail.width,
        })
      }
    }

    const handleEditorResize = (e: CustomEvent) => {
      if (e.detail) {
        setEditorPosition({
          x: e.detail.x,
          y: e.detail.y,
          width: e.detail.width,
        })
      }
    }

    window.addEventListener("editor-position-change", handleEditorPositionChange as EventListener)
    window.addEventListener("editor-resize", handleEditorResize as EventListener)
    window.addEventListener("editor-interaction-end", handleEditorResize as EventListener)

    return () => {
      window.removeEventListener("editor-position-change", handleEditorPositionChange as EventListener)
      window.removeEventListener("editor-resize", handleEditorResize as EventListener)
      window.removeEventListener("editor-interaction-end", handleEditorResize as EventListener)
    }
  }, [])

  const copyToClipboard = useCallback(() => {
    const content = contentRef.current
    if (!content) return
    const cleanedContent = content.replace(/^```[\w]*\n/, "").replace(/\n```$/, "")
    navigator.clipboard
      .writeText(cleanedContent)
      .then(() => {
        toast.success("Code copied to clipboard")
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
      })
      .catch((err) => {
        console.error("Failed to copy: ", err)
        toast.error("Could not copy to clipboard")
      })
  }, [])

  const retrySubmission = useCallback(() => {
    const content = contentRef.current
    if (!content) return
    handleSubmit(content)
    toast.success("Retrying submission...")
  }, [handleSubmit])

  const handleViewRaw = useCallback(() => {
    setShowEditor(true)
  }, [])

  const downloadCodeBlocks = useCallback(() => {
    const content = contentRef.current
    if (!content) return
    const blocks = extractCodeBlocks(content)
    if (!blocks.length) return
    const blob = new Blob([blocks.map((b) => b.code).join("\n\n")], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const validExtension = language && /\.(txt|js|ts|html|css|py)$/i.test(language) ? language : "txt"
    a.download = `code-snippet.${validExtension}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Code downloaded as file")
  }, [language])

  const handleFeedback = useCallback((type: "like" | "dislike") => {
    setFeedback(type)
    toast.success(type === "like" ? "Thanks for your positive feedback!" : "Thanks for your feedback. We'll improve.")
  }, [])

  const handleGoodCodeActionClick = useCallback(async () => {
    const content = contentRef.current
    if (content) {
      try {
        await fetch(`${API_ENDPOINT}/add_resource/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        })
      } catch (error) {
        console.warn("Failed to reindex memory:", error)
        toast.error("Failed to save content")
      }
    }
  }, [])

  const handleBadCodeActionClick = useCallback(async () => {
    const content = contentRef.current
    if (content) {
      try {
        await fetch(`${API_ENDPOINT}/flag_bad_input/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        })
        toast.success("Content flagged for improvement")
      } catch (error) {
        console.warn("Failed toreindex memory:", error)
        toast.error("Failed to flag content")
      }
    }
  }, [])

  const handleSaveToFile = useCallback(() => {
    setShowSaveDialog(true);
  }, []);

  const isUser = message.role === "user"
  const messageContent = typeof message.content === "string" ? message.content : ""
  const messageImage = typeof message.dataImage === "string" ? message.dataImage : ""

  const hasCodeBlocks = extractCodeBlocks(messageContent).length > 0

  // Calculate maximum width for chat content based on editor position
  const calculateMaxWidth = () => {
    // If we have a parent element width, use that
    if (mainContentWidth > 0) {
      const availableWidth = mainContentWidth - 48;
      // Set a minimum width to prevent content from becoming too narrow
      const minWidth = Math.min(400, availableWidth * 0.8);
      // Use the available width, but ensure it's not less than the minimum
      return `${Math.max(minWidth, availableWidth)}px`;
    }
    
    // Fallback to window-based calculation if we don't have parent dimensions yet
    const windowWidth = typeof window !== "undefined" ? window.innerWidth : 0
    const sidebarWidth = Number.parseInt(
      document.documentElement.style.getPropertyValue("--sidebar-width") || "280",
      10,
    )
    const rightSidebarWidth = Number.parseInt(
      document.documentElement.style.getPropertyValue("--right-sidebar-width") || "0",
      10,
    )

    // Calculate available space
    const availableWidth = windowWidth - sidebarWidth - rightSidebarWidth

    // Set a minimum width to prevent content from becoming too narrow
    const minWidth = Math.min(400, availableWidth * 0.7)

    // Use the available width, but ensure it's not less than the minimum
    return `${Math.max(minWidth, availableWidth - 48)}px`
  }

  // Add useEffect to measure the parent container width
  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      // Look up the DOM tree to find the message list container
      let container: HTMLElement | null = messageContentRef.current;
      let messageListContainer: HTMLElement | null = null;
      
      // Find the chat-message-list container by traversing up the DOM
      while (container) {
        // Check for parent that's a scrollable container or chat message list
        if (container.classList && 
            (container.classList.contains('radix-scroll-area-viewport') || 
             container.parentElement?.querySelector('[data-radix-scroll-area-viewport]'))) {
          messageListContainer = container;
          break;
        }
        container = container.parentElement;
      }
      
      // If we found the message list container, set its width
      if (messageListContainer) {
        setMainContentWidth(messageListContainer.offsetWidth);
      } else if (messageContentRef.current?.parentElement) {
        // Fallback to the direct parent's width
        setMainContentWidth(messageContentRef.current.parentElement.offsetWidth);
      }
    });

    if (messageContentRef.current) {
      resizeObserver.observe(messageContentRef.current);
    }

    // Also observe window resize events
    const handleResize = () => {
      if (messageContentRef.current) {
        setMainContentWidth(messageContentRef.current.parentElement?.offsetWidth || 0);
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className={cn("flex gap-3 w-full", isUser ? "ml-auto justify-end text-right" : "text-left")}>
      <div className={cn("space-y-2 max-w-full", isUser ? "order-1" : "order-2")}>
        <div className={cn("flex items-center gap-2 w-full", isUser ? "justify-end" : "justify-start")}>
          <span className="text-sm font-medium truncate px-3 font-scale-base">{isUser ? "You" : "CodeMasterPro"}</span>
          {!isUser && (
            <Badge variant="outline" className="text-xs truncate font-scale-sm">
              Developer
            </Badge>
          )}
          {isUser && language && (
            <Badge variant="outline" className="text-xs truncate font-scale-sm">
              CodeMaster
            </Badge>
          )}
        </div>
        <div
          ref={messageContentRef}
          className={cn(
            "p-4 rounded-lg text-sm sm:text-base break-words overflow-auto font-scale-base custom-scrollbar fluid-motion message-container",
            isUser ? "ml-auto text-left border border-blue-500/10" : "bg-card text-left shadow-sm",
            isResizing && "resize-transition",
          )}
          style={{
            transition: isResizing
              ? "none"
              : "max-width 0.3s ease-in-out, font-size 0.3s ease-in-out, width 0.3s ease-in-out",
            fontSize: `calc(1rem * var(--font-scale, 1))`,
            maxWidth: calculateMaxWidth(),
          }}
        >
          <Suspense fallback={<div className="animate-pulse bg-muted h-24 max-w-3xl rounded-md"></div>}>
            <MessageContent
              content={messageContent}
              imageData={messageImage}
              syntaxHighlighting={syntaxHighlighting}
              showLineNumbers={showLineNumbers}
              onCodeAction={onCodeAction}
              isInteractive={!isUser}
              editorInfo={showEditor ? editorPosition : undefined}
            />
          </Suspense>
        </div>
        <div className={cn("flex items-center gap-2", isUser ? "justify-end" : "justify-start")}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={copyToClipboard}
                  aria-label="Copy message"
                >
                  {isCopied ? <span className="text-xs text-green-500">Copied!</span> : <Copy className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copy message</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {hasCodeBlocks && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={downloadCodeBlocks}
                    aria-label="Download code"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Download code</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {isUser && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={retrySubmission}
                    aria-label="Retry submission"
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Retry submission</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {!isUser && (
            <div className="flex items-center gap-1 ml-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={feedback === "like" ? "default" : "ghost"}
                      size="icon"
                      className={cn("h-7 w-7", feedback === "like" && "bg-green-500 hover:bg-green-600")}
                      onClick={() => {
                        handleFeedback("like")
                        handleGoodCodeActionClick()
                      }}
                      aria-label="Helpful response"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Mark as helpful</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={feedback === "dislike" ? "default" : "ghost"}
                      size="icon"
                      className={cn("h-7 w-7", feedback === "dislike" && "bg-red-500 hover:bg-red-600")}
                      onClick={() => {
                        handleFeedback("dislike")
                        handleBadCodeActionClick()
                      }}
                      aria-label="Unhelpful response"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Mark as unhelpful</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              { mcp == "context" && (
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Save to file"
                      onClick={handleSaveToFile}
                    >
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Save to file</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              )
            }
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Delete message"
                      onClick={() => {
                        handleViewRaw()
                      }}
                    >
                      <SparkleIcon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View Raw</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <CodeEditorCanvas
                code={contentRef.current}
                language={"Markdown"}
                isOpen={showEditor}
                onClose={() => setShowEditor(false)}
                onSave={() => {}}
                safeView={true}
              />
              
              {/* Save to File Dialog */}
              <SaveToFileDialog
                isOpen={showSaveDialog}
                onClose={() => setShowSaveDialog(false)}
                content={contentRef.current}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default ChatMessage
