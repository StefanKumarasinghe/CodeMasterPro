"use client"

import type React from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { useRef, useEffect, useState, useCallback } from "react"
import ChatMessage from "./chat-message"
import { ChatWelcome } from "./chat-welcome"
import { useChat } from "@/context/chat-context"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { ChatProgressBar } from "./chat-progress-bar"
import { useInView } from "react-intersection-observer"
import { API_ENDPOINT } from "@/config/constants"
import type { Message } from "@/types"

const LOADING_MESSAGES = [
  "CodeMasterPro is thinking...",
  "CodeMasterPro is analyzing your question...",
  "CodeMasterPro is generating code...",
  "CodeMasterPro is optimizing the response...",
  "CodeMasterPro is validating the solution...",
]

const debounce = (func: (...args: any[]) => void, delay: number) => {
  let timeoutId: NodeJS.Timeout | null = null
  return (...args: any[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      func(...args)
    }, delay)
  }
}

const SCROLL_THRESHOLD = 200

interface ChatMessageListProps {
  language: string
  isLoading: boolean
  style?: React.CSSProperties
  editorWidth?: number
  isResizing?: boolean
}

export function ChatMessageList({
  language,
  isLoading,
  style,
  editorWidth = 0,
  isResizing = false,
}: ChatMessageListProps) {
  const { messages, preferences, handleCodeAction, setMemoryState, language: contextLanguage } = useChat()

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0])
  const [loadedMessages, setLoadedMessages] = useState<Message[]>([])
  const [batchSize] = useState(15)
  const [listInnerRef, isVisible] = useInView({
    triggerOnce: false,
    threshold: 0.1,
  })
  const [updateMessage, setUpdateMessage] = useState("")
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const streamSourceRef = useRef<EventSource | null>(null)
  const [lazyLoadingTriggered, setLazyLoadingTriggered] = useState(false)
  const messageListRef = useRef<HTMLDivElement | null>(null)
  const [editorVisible, setEditorVisible] = useState(false)
  const [editorPosition, setEditorPosition] = useState({ x: 0, y: 0, width: 0 })
  const messagesRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    const messagesEnd = messagesEndRef.current

    if (!messagesEnd) {
      return
    }

    requestAnimationFrame(() => {
      messagesEnd.scrollIntoView({ behavior: "smooth" })
    })
    setIsAutoScrollEnabled(true)
  }, [messagesEndRef])

  const handleScroll = useCallback(() => {
    const viewport = scrollViewportRef.current
    if (!viewport) return

    const { scrollTop, scrollHeight, clientHeight } = viewport

    const isNearBottom = scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD

    setShowScrollButton(!isNearBottom && scrollHeight > clientHeight)

    setIsAutoScrollEnabled(isNearBottom)
  }, [setShowScrollButton, setIsAutoScrollEnabled, scrollViewportRef])

  const streamUpdates = useCallback(() => {
    if (streamSourceRef.current) {
      streamSourceRef.current.close()
    }
    const source = new EventSource(`${API_ENDPOINT}/chat/stream`)
    streamSourceRef.current = source

    source.onmessage = (event) => {
      const update = event.data
      if (typeof update === "string" && update.length > 0) {
        setUpdateMessage(update)
      }
    }

    source.onerror = (error) => {
      source.close()
      streamSourceRef.current = null
      setUpdateMessage("Stream error: Could not connect to updates.")
    }

    return () => {
      source.close()
    }
  }, [])

  useEffect(() => {
    if (messages.length > 0) {
      setLoadedMessages(messages.slice(0, batchSize))
      requestAnimationFrame(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView()
        }
      })
      setIsAutoScrollEnabled(true)
    } else {
      setLoadedMessages([])
      setIsAutoScrollEnabled(false)
    }
  }, [messages, batchSize, messagesEndRef])

  useEffect(() => {
    if (isVisible && loadedMessages.length < messages.length) {
      const nextBatchStart = loadedMessages.length
      const nextBatchEnd = Math.min(loadedMessages.length + batchSize, messages.length)
      const nextBatch = messages.slice(nextBatchStart, nextBatchEnd)

      if (nextBatch.length > 0) {
        setLoadedMessages((prevMessages) => [...prevMessages, ...nextBatch])
        setLazyLoadingTriggered(true)
      }
    }
  }, [isVisible, loadedMessages, messages, batchSize])

  useEffect(() => {
    const container = scrollAreaRef.current
    if (container) {
      const viewport = container.querySelector("[data-radix-scroll-area-viewport]")

      if (viewport instanceof HTMLDivElement) {
        scrollViewportRef.current = viewport

        const debouncedHandleScroll = debounce(handleScroll, 100)

        viewport.addEventListener("scroll", debouncedHandleScroll)
        debouncedHandleScroll()

        return () => {
          viewport.removeEventListener("scroll", debouncedHandleScroll)
          scrollViewportRef.current = null
        }
      } else {
        console.warn("ScrollArea viewport element not found.")
      }
    }
  }, [handleScroll, scrollAreaRef])

  useEffect(() => {
    if (isAutoScrollEnabled && !lazyLoadingTriggered) {
      scrollToBottom()
    }

    if (lazyLoadingTriggered) {
      setLazyLoadingTriggered(false)
    }
  }, [loadedMessages, isLoading, isAutoScrollEnabled, lazyLoadingTriggered, scrollToBottom])

  useEffect(() => {
    let cleanupStream: (() => void) | undefined
    if (isLoading) {
      setUpdateMessage("Peeking into CodeMasterPro's brain...")
      cleanupStream = streamUpdates()
      let index = 0
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current)
      setLoadingMessage(LOADING_MESSAGES[index])
      loadingIntervalRef.current = setInterval(() => {
        index = (index + 1) % LOADING_MESSAGES.length
        setLoadingMessage(LOADING_MESSAGES[index])
      }, 3000)
    } else {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current)
      if (streamSourceRef.current) streamSourceRef.current.close()
      setUpdateMessage("")
    }

    return () => {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current)
      if (cleanupStream) cleanupStream()
    }
  }, [isLoading, streamUpdates])

  const handleClearMemory = useCallback(() => {
    setMemoryState((prev) => ({ ...prev, forgetMemory: true }))
  }, [setMemoryState])

  // Add effect to listen for editor position changes
  useEffect(() => {
    const handleEditorPositionChange = (e: CustomEvent) => {
      if (e.detail) {
        setEditorVisible(true)
        setEditorPosition({
          x: e.detail.x,
          y: e.detail.y,
          width: e.detail.width,
        })
      }
    }

    const handleEditorInteractionEnd = (e: CustomEvent) => {
      if (e.detail) {
        setEditorPosition({
          x: e.detail.x,
          y: e.detail.y,
          width: e.detail.width,
        })
      }
    }

    const handleCodeEditorClose = () => {
      setEditorVisible(false)
    }

    window.addEventListener("editor-position-change", handleEditorPositionChange as EventListener)
    window.addEventListener("editor-resize", handleEditorPositionChange as EventListener)
    window.addEventListener("editor-interaction-end", handleEditorInteractionEnd as EventListener)
    window.addEventListener("code-editor-close", handleCodeEditorClose as EventListener)

    return () => {
      window.removeEventListener("editor-position-change", handleEditorPositionChange as EventListener)
      window.removeEventListener("editor-resize", handleEditorPositionChange as EventListener)
      window.removeEventListener("editor-interaction-end", handleEditorInteractionEnd as EventListener)
      window.removeEventListener("code-editor-close", handleCodeEditorClose as EventListener)
    }
  }, [])

  return (
    <div
      ref={messageListRef}
      className={cn("flex flex-col gap-5 overflow-y-auto flex-grow p-4 sm:p-6 chat-message-list", isLoading && "opacity-90")}
      style={{
        transition: "width 0.3s ease-in-out, margin-right 0.3s ease-in-out",
        ...(editorVisible
          ? {
              width: `calc(100% - ${Math.min(50, Math.max(0, editorPosition.width - 200))}px)`,
              marginRight: `${Math.min(50, Math.max(0, editorPosition.width - 300))}px`,
            }
          : {}),
      }}
    >
      {messages.length > 0 && (
        <ChatProgressBar
          messageCount={messages.reduce((c, m) => c + m.content.length, 0)}
          onClearMemory={handleClearMemory}
        />
      )}

      <ScrollArea className="flex-1 px-2 sm:px-4 py-4" ref={scrollAreaRef}>
        <div
          className="space-y-6 pb-6 w-full mx-auto px-3"
          style={{
            maxWidth: "calc(100% - 1.5rem)",
            transition: "max-width 0.3s ease-in-out",
          }}
        >
          {loadedMessages.length > 0 ? (
            <>
              {loadedMessages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  language={language}
                  syntaxHighlighting={preferences.syntaxHighlighting}
                  showLineNumbers={preferences.showLineNumbers}
                  onCodeAction={handleCodeAction}
                />
              ))}
            </>
          ) : (
            <ChatWelcome />
          )}

          {isLoading && (
            <div className="gap-1 text-muted-foreground  text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
                <span>{loadingMessage}</span>
              </div>
              {updateMessage && (
                <span className="p-3 my-2 bg-gray-100 dark:bg-gray-700 rounded-md items-center gap-2 text-muted-foreground max-w-[60%] inline-flex break-words">
                  <span className="text-black dark:text-green-200 text-sm">{updateMessage}</span>
                </span>
              )}
            </div>
          )}

          {loadedMessages.length < messages.length && (
            <div ref={listInnerRef} className="py-2 text-center text-gray-500">
              Loading more messages...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <Button
        variant="default"
        size="icon"
        className={cn(
          "absolute bottom-4 right-4 rounded-full h-9 w-9 font-bold shadow-md transition-opacity duration-200",
          showScrollButton ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={scrollToBottom}
        aria-label="Scroll to bottom"
      >
        <ChevronDown className="h-5 w-5" />
      </Button>
    </div>
  )
}
