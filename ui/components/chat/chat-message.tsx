"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { API_ENDPOINT } from "@/config/constants"
import { Copy, Download, ThumbsUp, ThumbsDown, SmileIcon, RefreshCcw } from "lucide-react"
import { extractCodeBlocks } from "@/utils/chat-utils"
import { toast } from "@/utils/toast-util"
import { useState, useCallback, memo, Suspense, useRef, useEffect } from "react"
import { type Message } from "ai"
import { useChat } from "@/context/chat-context"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import MessageContent from "./message-content"

interface ChatMessageProps {
  message: Message
  language: string
  syntaxHighlighting: boolean
  showLineNumbers: boolean
  onCodeAction: (action: string, code: string, lang: string) => void
}

const ChatMessage = memo(function ChatMessage({
  message,
  language,
  syntaxHighlighting,
  showLineNumbers,
  onCodeAction,
}: Readonly<ChatMessageProps>) {
  const [isCopied, setIsCopied] = useState(false)
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null)
  const contentRef = useRef<string>("");
  const { handleSubmit } = useChat()

  useEffect(() => {
    contentRef.current = typeof message.content === "string" ? message.content : "";
  }, [message.content]);

  const copyToClipboard = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    const cleanedContent = content.replace(/^```[\w]*\n/, "").replace(/\n```$/, "");
    navigator.clipboard
      .writeText(cleanedContent)
      .then(() => {
        toast.success("Code copied to clipboard");
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
        toast.error("Could not copy to clipboard");
      });
  }, []);

  const retrySubmission = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    handleSubmit(content);
    toast.success("Retrying submission...");
  }, [handleSubmit]);

  const downloadCodeBlocks = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    const blocks = extractCodeBlocks(content);
    if (!blocks.length) return;
    const blob = new Blob([blocks.map((b) => b.code).join("\n\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const validExtension = language && /\.(txt|js|ts|html|css|py)$/i.test(language) ? language : "txt";
    a.download = `code-snippet.${validExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Code downloaded as file");
  }, [language]);

  const handleFeedback = useCallback((type: "like" | "dislike") => {
    setFeedback(type);
    toast.success(type === "like" ? "Thanks for your positive feedback!" : "Thanks for your feedback. We'll improve.");
  }, []);

  const handleGoodCodeActionClick = useCallback(async () => {
    const content = contentRef.current;
    if (content) {
      try {
        await fetch(`${API_ENDPOINT}/add_resource/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
      } catch (error) {
        console.warn("Failed to reindex memory:", error);
        toast.error("Failed to save content");
      }
    }
  }, []);

  const handleBadCodeActionClick = useCallback(async () => {
    const content = contentRef.current;
    if (content) {
      try {
        await fetch(`${API_ENDPOINT}/flag_bad_input/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        toast.success("Content flagged for improvement");
      } catch (error) {
        console.warn("Failed toreindex memory:", error);
        toast.error("Failed to flag content");
      }
    }
  }, []);
  const isUser = message.role === "user";
  const messageContent = typeof message.content === "string" ? message.content : "";
  const messageImage = typeof message.dataImage === "string" ? message.dataImage : ""

  const hasCodeBlocks = extractCodeBlocks(messageContent).length > 0;
  return (
    <div className={cn("flex gap-3 w-full", isUser ? "ml-auto justify-end text-right" : "text-left")}>
      {!isUser && (
        <div className="shrink-0 h-8 w-8 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 flex items-center justify-center mt-1">
          <SmileIcon className="h-6 w-6 text-white" />
        </div>
      )}
      <div className={cn("space-y-2 max-w-full", isUser ? "order-1" : "order-2")}>
        <div className={cn("flex items-center gap-2 w-full", isUser ? "justify-end" : "justify-start")}>
          <span className="text-sm font-medium truncate">{isUser ? "You" : "TARS"}</span>
          {isUser && language && (
            <Badge variant="outline" className="text-xs truncate">{language}</Badge>
          )}
          {!isUser && (
            <Badge variant="outline" className="text-xs block truncate">CodeMasterPro</Badge>
          )}
        </div>
        <div
          className={cn(
            "p-4 rounded-lg text-sm sm:text-base break-words overflow-auto",
            "max-w-[calc(100vw-5rem)] sm:max-w-[calc(100vw-8rem)] md:max-w-[calc(100vw-20rem)] lg:max-w-[calc(100vw-25rem)]",
            isUser ? "ml-auto text-left  border border-blue-500/10" : "bg-card text-left shadow-sm",
          )}
        >
          <Suspense fallback={<div className="animate-pulse bg-muted h-24 rounded-md"></div>}>
            <MessageContent
              content={messageContent}
              imageData={messageImage}
              syntaxHighlighting={syntaxHighlighting}
              showLineNumbers={showLineNumbers}
              onCodeAction={onCodeAction}
              isInteractive={!isUser}
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
                        handleFeedback("like");
                        handleGoodCodeActionClick();
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
                        handleFeedback("dislike");
                        handleBadCodeActionClick();
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
})

export default ChatMessage