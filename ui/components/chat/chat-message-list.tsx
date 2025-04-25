"use client"

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
import { marked } from 'marked';



const LOADING_MESSAGES = [
  "TARS is thinking...",
  "TARS is analyzing your question...",
  "TARS is generating code...",
  "TARS is optimizing the response...",
  "TARS is validating the solution...",
]

export type MessageBoardUpdater = {
  setMessage: React.Dispatch<React.SetStateAction<string>>
  setBorder: React.Dispatch<React.SetStateAction<boolean>>
}

export const updateMessageBoard = (
  message: string,
  show: boolean,
  updater?: MessageBoardUpdater
) => {
  if (updater) {
    const { setMessage, setBorder } = updater
    setMessage(message)
    setBorder(show)
  }
}

export function ChatMessageList() {
  const { messages, language, preferences, isLoading, handleCodeAction, setMemoryState } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0])
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [loadedMessages, setLoadedMessages] = useState<ChatMessage[]>([])
  const [batchSize] = useState(10)
  const [listInnerRef, isVisible] = useInView()
  const [updateMessage, setUpdateMessage] = useState("")
  const streamSourceRef = useRef<EventSource | null>(null)

  const streamUpdates = useCallback(() => {
    if (streamSourceRef.current) {
      streamSourceRef.current.close()
      streamSourceRef.current = null
    }



    const source = new EventSource(`${API_ENDPOINT}/chat/stream`)
    streamSourceRef.current = source

    source.onopen = () => {

    }

    source.onmessage = (event) => {
      const update = event.data
      if (typeof update === 'string' && update.length > 0) {
        setUpdateMessage(update)
      }
    }

    source.onerror = (event) => {
      if (source.readyState === EventSource.CLOSED) {
      }
      source.close()
      streamSourceRef.current = null
    }

    return () => {
      if (source.readyState !== EventSource.CLOSED) {
        source.close()
      }
    }
  }, [])

  useEffect(() => {
    if (messages.length > 0) {
      setLoadedMessages(messages.slice(0, batchSize))
    }
  }, [messages, batchSize])

  useEffect(() => {
    if (isVisible && loadedMessages.length < messages.length) {
      const nextBatchSize = Math.min(loadedMessages.length + batchSize, messages.length)
      setLoadedMessages(messages.slice(0, nextBatchSize))
    }
  }, [isVisible, messages, loadedMessages, batchSize])

  useEffect(() => {
    let cleanupStream: (() => void) | undefined

    if (isLoading) {
      setUpdateMessage("Peeking into TARS' brain...")
      cleanupStream = streamUpdates()

      let messageIndex = 0
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current)
      }

      setLoadingMessage(LOADING_MESSAGES[messageIndex])
      loadingIntervalRef.current = setInterval(() => {
        messageIndex = (messageIndex + 1) % LOADING_MESSAGES.length
        setLoadingMessage(LOADING_MESSAGES[messageIndex])
      }, 3000)
    } else {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current)
        loadingIntervalRef.current = null
      }

      if (streamSourceRef.current) {
        streamSourceRef.current.close()
        streamSourceRef.current = null
      }

      setUpdateMessage("")
    }

    return () => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current)
      }
      if (cleanupStream) {
        cleanupStream()
      }
    }
  }, [isLoading, streamUpdates])

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
    setIsAutoScrollEnabled(true)
  }, [])

  const handleScroll = useCallback(() => {
    if (!scrollAreaRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100

    setShowScrollButton(!isNearBottom)
    setIsAutoScrollEnabled(isNearBottom)
  }, [])

  useEffect(() => {
    const scrollArea = scrollAreaRef.current
    if (scrollArea) {
      scrollArea.addEventListener("scroll", handleScroll)
      return () => scrollArea.removeEventListener("scroll", handleScroll)
    }
  }, [handleScroll])

  useEffect(() => {
    if (isAutoScrollEnabled && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isLoading, isAutoScrollEnabled])

  const handleClearMemory = useCallback(() => {
    setMemoryState((prev) => ({ ...prev, forgetMemory: true }))
  }, [setMemoryState])

  const convertMarkdownToText = (markdown) => {

    const html = marked(markdown);
    const div = document.createElement('div');
    div.innerHTML = html;
  
    return div.textContent || div.innerText || '';
  };
  return (
    <div className="flex-1 overflow-hidden relative flex flex-col">
      {messages.length > 0 && (
        <ChatProgressBar
          messageCount={messages.reduce((count, message) => count + message.content.length, 0)}
          onClearMemory={handleClearMemory}
        />
      )}

      <ScrollArea className="flex-1 px-2 sm:px-4 py-4" scrollAreaRef={scrollAreaRef}>
        <div className="space-y-6 pb-6 max-w-full mx-auto px-3">
          {messages.length === 0 ? (
            <ChatWelcome />
          ) : (
            loadedMessages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                language={language}
                syntaxHighlighting={preferences.syntaxHighlighting}
                showLineNumbers={preferences.showLineNumbers}
                onCodeAction={handleCodeAction}
              />
            ))
          )}
          {isLoading && (
            <div className="flex flex-col gap-1 text-muted-foreground ml-5 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
                <span>{loadingMessage}</span>
              </div>
              {updateMessage && (
                <span className="p-3 my-2 bg-gray-100 dark:bg-gray-700 rounded-md items-center gap-2 text-muted-foreground max-w-[60%] inline-flex">
                  <span className="italic text-black dark:text-green-300 text-sm">{convertMarkdownToText(updateMessage)}</span>
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
        variant="outline"
        size="icon"
        className={cn(
          "absolute bottom-4 right-4 rounded-full h-10 w-10 bg-background shadow-md transition-opacity duration-200",
          showScrollButton ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={scrollToBottom}
        aria-label="Scroll to bottom"
      >
        <ChevronDown className="h-5 w-5" />
      </Button>
    </div>
  )
}