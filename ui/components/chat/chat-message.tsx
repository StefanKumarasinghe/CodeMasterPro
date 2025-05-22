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
import { NodeTestRunner } from "./node-test-runner"

interface ChatMessageProps {
  message: Message
  language: string
  syntaxHighlighting: boolean
  showLineNumbers: boolean
  onCodeAction: (action: string, code: string, lang: string) => void
  editorWidth?: number
  isResizing?: boolean
}

interface EditorPosition {
  x: number
  y: number
  width: number
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
  const [editorPosition, setEditorPosition] = useState<EditorPosition>({ x: 0, y: 0, width: 0 })
  const messageContentRef = useRef<HTMLDivElement>(null)
  const [mainContentWidth, setMainContentWidth] = useState(0)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showTestRunner, setShowTestRunner] = useState(false)
  
  const isUser = message.role === "user"
  const messageContent = typeof message.content === "string" ? message.content : ""
  const messageImage = typeof message.dataImage === "string" ? message.dataImage : ""
  const hasCodeBlocks = extractCodeBlocks(messageContent).length > 0

  useEffect(() => {
    contentRef.current = typeof message.content === "string" ? message.content : ""
  }, [message.content])

  useEffect(() => {
    const handleEditorEvent = (e: CustomEvent) => {
      if (e.detail) {
        setEditorPosition({
          x: e.detail.x,
          y: e.detail.y,
          width: e.detail.width,
        })
      }
    }

    window.addEventListener("editor-position-change", handleEditorEvent as EventListener)
    window.addEventListener("editor-resize", handleEditorEvent as EventListener)
    window.addEventListener("editor-interaction-end", handleEditorEvent as EventListener)

    return () => {
      window.removeEventListener("editor-position-change", handleEditorEvent as EventListener)
      window.removeEventListener("editor-resize", handleEditorEvent as EventListener)
      window.removeEventListener("editor-interaction-end", handleEditorEvent as EventListener)
    }
  }, [])

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      let container: HTMLElement | null = messageContentRef.current
      let messageListContainer: HTMLElement | null = null
      
      while (container) {
        if (container.classList && 
            (container.classList.contains('radix-scroll-area-viewport') || 
             container.parentElement?.querySelector('[data-radix-scroll-area-viewport]'))) {
          messageListContainer = container
          break
        }
        container = container.parentElement
      }
      
      if (messageListContainer) {
        setMainContentWidth(messageListContainer.offsetWidth)
      } else if (messageContentRef.current?.parentElement) {
        setMainContentWidth(messageContentRef.current.parentElement.offsetWidth)
      }
    })

    if (messageContentRef.current) {
      resizeObserver.observe(messageContentRef.current)
      
      
      let parent = messageContentRef.current.parentElement
      while (parent) {
        resizeObserver.observe(parent)
        if (parent.classList && 
            (parent.classList.contains('radix-scroll-area-viewport') || 
             parent.querySelector('[data-radix-scroll-area-viewport]'))) {
          break
        }
        parent = parent.parentElement
      }
    }

    const handleResize = () => {
      if (messageContentRef.current) {
        
        setMainContentWidth(messageContentRef.current.parentElement?.offsetWidth || 0)
        
        setTimeout(() => {
          if (messageContentRef.current) {
            setMainContentWidth(messageContentRef.current.parentElement?.offsetWidth || 0)
          }
        }, 150)
      }
    }
    
    
    window.addEventListener('resize', handleResize)
    window.addEventListener('sidebar-resize', handleResize)
    window.addEventListener('node-test-runner-state', handleResize as EventListener)
    window.addEventListener('code-editor-state', handleResize as EventListener)
    window.addEventListener('python-shell-state', handleResize as EventListener)
    
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('sidebar-resize', handleResize)
      window.removeEventListener('node-test-runner-state', handleResize as EventListener)
      window.removeEventListener('code-editor-state', handleResize as EventListener)
      window.removeEventListener('python-shell-state', handleResize as EventListener)
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

  const sendApiRequest = useCallback(async (endpoint: string, content: string, successMessage?: string) => {
    try {
      await fetch(`${API_ENDPOINT}/${endpoint}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      if (successMessage) {
        toast.success(successMessage)
      }
      return true
    } catch (error) {
      console.warn(`Failed to ${endpoint}:`, error)
      toast.error(`Failed to ${endpoint.replace("_", " ")}`)
      return false
    }
  }, [])

  const handleGoodCodeActionClick = useCallback(async () => {
    if (contentRef.current) {
      await sendApiRequest("add_resource", contentRef.current)
    }
  }, [sendApiRequest])

  const handleBadCodeActionClick = useCallback(async () => {
    if (contentRef.current) {
      await sendApiRequest("flag_bad_input", contentRef.current, "Content flagged for improvement")
    }
  }, [sendApiRequest])

  const handleCodeAction = useCallback((action: string, code: string, lang: string) => {
    if (action === "run-tests") {
      setShowTestRunner(true)
    } else {
      onCodeAction(action, code, lang)
    }
  }, [onCodeAction])

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
              : "max-width w-full 0.3s ease-in-out, font-size 0.3s ease-in-out, width 0.3s ease-in-out",
            fontSize: `calc(1rem * var(--font-scale, 1))`,
            minWidth: "500px",
          }}
        >
          <Suspense fallback={<div className="animate-pulse bg-muted h-24 max-w-3xl rounded-md"></div>}>
            <MessageContent
              content={messageContent}
              imageData={messageImage}
              syntaxHighlighting={syntaxHighlighting}
              showLineNumbers={showLineNumbers}
              onCodeAction={handleCodeAction}
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
              
              {mcp === "context" && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="Save to file"
                        onClick={() => setShowSaveDialog(true)}
                      >
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Save to file</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="View raw"
                      onClick={() => setShowEditor(true)}
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
              
              {showTestRunner && (
                <NodeTestRunner
                  isOpen={showTestRunner}
                  onClose={() => setShowTestRunner(false)}
                />
              )}
              
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