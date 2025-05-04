"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useRef, useEffect, useState, useCallback } from "react";
import ChatMessage from "./chat-message";
import { ChatWelcome } from "./chat-welcome";
import { useChat } from "@/context/chat-context";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatProgressBar } from "./chat-progress-bar";
import { useInView } from "react-intersection-observer";
import { API_ENDPOINT } from "@/config/constants";
import { ChatMessage as MessageType } from "@/context/chat-context";

const LOADING_MESSAGES = [
  "TARS is thinking...",
  "TARS is analyzing your question...",
  "TARS is generating code...",
  "TARS is optimizing the response...",
  "TARS is validating the solution...",
];

const debounce = (func: (...args: any[]) => void, delay: number) => {
  let timeoutId: NodeJS.Timeout | null = null;
  return (...args: any[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};

const SCROLL_THRESHOLD = 200;

export function ChatMessageList() {
  const {
    messages,
    language,
    preferences,
    isLoading,
    handleCodeAction,
    setMemoryState,
  } = useChat();

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [loadedMessages, setLoadedMessages] = useState<MessageType[]>([]);
  const [batchSize] = useState(15);
  const [listInnerRef, isVisible] = useInView({
      triggerOnce: false,
      threshold: 0.1,
  });
  const [updateMessage, setUpdateMessage] = useState("");
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamSourceRef = useRef<EventSource | null>(null);
  const [lazyLoadingTriggered, setLazyLoadingTriggered] = useState(false);


  const scrollToBottom = useCallback(() => {
    const messagesEnd = messagesEndRef.current;

    if (!messagesEnd) {
      return;
    }

    requestAnimationFrame(() => {
      messagesEnd.scrollIntoView({ behavior: "smooth" });
    });
    setIsAutoScrollEnabled(true);

  }, [messagesEndRef]);

  const handleScroll = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    const { scrollTop, scrollHeight, clientHeight } = viewport;

    const isNearBottom = scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;

    setShowScrollButton(!isNearBottom && scrollHeight > clientHeight);

    setIsAutoScrollEnabled(isNearBottom);

  }, [setShowScrollButton, setIsAutoScrollEnabled, scrollViewportRef]);

  const streamUpdates = useCallback(() => {
    if (streamSourceRef.current) {
      streamSourceRef.current.close();
    }
    const source = new EventSource(`${API_ENDPOINT}/chat/stream`);
    streamSourceRef.current = source;

    source.onmessage = (event) => {
      const update = event.data;
      if (typeof update === "string" && update.length > 0) {
        setUpdateMessage(update);
      }
    };

    source.onerror = (error) => {
      console.error("EventSource failed:", error);
      source.close();
      streamSourceRef.current = null;
      setUpdateMessage("Stream error: Could not connect to updates.");
    };

    return () => {
      source.close();
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setLoadedMessages(messages.slice(0, batchSize));
       requestAnimationFrame(() => {
           if (messagesEndRef.current) {
             messagesEndRef.current.scrollIntoView();
           }
       });
       setIsAutoScrollEnabled(true);
    } else {
        setLoadedMessages([]);
        setIsAutoScrollEnabled(false);
    }
  }, [messages, batchSize, messagesEndRef]);

  useEffect(() => {
    if (isVisible && loadedMessages.length < messages.length) {
      const nextBatchStart = loadedMessages.length;
      const nextBatchEnd = Math.min(loadedMessages.length + batchSize, messages.length);
      const nextBatch = messages.slice(nextBatchStart, nextBatchEnd);

      if (nextBatch.length > 0) {
         setLoadedMessages(prevMessages => [...prevMessages, ...nextBatch]);
         setLazyLoadingTriggered(true);
      }
    }
  }, [isVisible, loadedMessages, messages, batchSize]);

  useEffect(() => {
    const container = scrollAreaRef.current;
    if (container) {
      const viewport = container.querySelector('[data-radix-scroll-area-viewport]');

      if (viewport instanceof HTMLDivElement) {
        scrollViewportRef.current = viewport;

        const debouncedHandleScroll = debounce(handleScroll, 100);

        viewport.addEventListener("scroll", debouncedHandleScroll);
        debouncedHandleScroll();

        return () => {
          viewport.removeEventListener("scroll", debouncedHandleScroll);
          scrollViewportRef.current = null;
        };
      } else {
         console.warn("ScrollArea viewport element not found.");
      }
    }
  }, [handleScroll, scrollAreaRef]);

  useEffect(() => {
    if (isAutoScrollEnabled && !lazyLoadingTriggered) {
      scrollToBottom();
    }

    if (lazyLoadingTriggered) {
      setLazyLoadingTriggered(false);
    }
  }, [loadedMessages, isLoading, isAutoScrollEnabled, lazyLoadingTriggered, scrollToBottom]);


  useEffect(() => {
    let cleanupStream: (() => void) | undefined;
    if (isLoading) {
      setUpdateMessage("Peeking into TARS' brain...");
      cleanupStream = streamUpdates();
      let index = 0;
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
      setLoadingMessage(LOADING_MESSAGES[index]);
      loadingIntervalRef.current = setInterval(() => {
        index = (index + 1) % LOADING_MESSAGES.length;
        setLoadingMessage(LOADING_MESSAGES[index]);
      }, 3000);
    } else {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
      if (streamSourceRef.current) streamSourceRef.current.close();
      setUpdateMessage("");
    }

    return () => {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
      if (cleanupStream) cleanupStream();
    };
  }, [isLoading, streamUpdates]);

  const handleClearMemory = useCallback(() => {
    setMemoryState((prev) => ({ ...prev, forgetMemory: true }));
  }, [setMemoryState]);


  return (
    <div className="flex-1 overflow-hidden relative flex flex-col">
      {messages.length > 0 && (
        <ChatProgressBar
          messageCount={messages.reduce((c, m) => c + m.content.length, 0)}
          onClearMemory={handleClearMemory}
        />
      )}

      <ScrollArea className="flex-1 px-2 sm:px-4 py-4" ref={scrollAreaRef}>
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
            <div className="gap-1 text-muted-foreground ml-5 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
                <span>{loadingMessage}</span>
              </div>
              {updateMessage && (
                <span className="p-3 ml-5 my-2 bg-gray-100 dark:bg-gray-700 rounded-md items-center gap-2 text-muted-foreground max-w-[60%] inline-flex break-words">
                  <span className="text-black dark:text-green-200 text-sm">
                    {updateMessage}
                  </span>
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
          showScrollButton ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={scrollToBottom}
        aria-label="Scroll to bottom"
      >
        <ChevronDown className="h-5 w-5" />
      </Button>
    </div>
  );
}