"use client"

import { useEffect, useState } from "react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Trash2, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { API_ENDPOINT } from "@/config/constants"
import { useChat } from "@/context/chat-context"
import { useToast } from "@/components/ui/use-toast"

interface ChatProgressBarProps {
  messageCount: number
  onClearMemory?: () => void
}

export function ChatProgressBar({ messageCount, onClearMemory }: ChatProgressBarProps) {
  const [showWarning, setShowWarning] = useState(false)
  const [visible, setVisible] = useState(true)
  const { setMessages } = useChat()
  const { toast } = useToast()
  const percentage = Math.min(Math.round((messageCount / 100000) * 100), 100)

  const getProgressColor = () => {
    if (percentage < 50) return "bg-green-500"
    if (percentage < 80) return "bg-amber-500"
    return "bg-red-500"
  }

  useEffect(() => {
    setShowWarning(messageCount > 50000)
    if (!visible) {
      setShowWarning(messageCount > 100000)
    }
  }, [messageCount])

  const handleClearMemory = async () => {
    try {
      const response = await fetch(`${API_ENDPOINT}/memory/clear`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to clear memory")

      window.dispatchEvent(new CustomEvent("code-editor-state", {
        detail: { isOpen: false, width: 0 },
      }))
      window.dispatchEvent(new CustomEvent("python-shell-state", {
        detail: { isOpen: false, width: 0 },
      }))
      window.dispatchEvent(new CustomEvent("html-preview-state", {
        detail: { isOpen: false, width: 0 },
      }))
      window.dispatchEvent(new CustomEvent("node-test-runner-state", {
        detail: { isOpen: false, width: 0 },
      }))

      window.dispatchEvent(new CustomEvent("memory-cleared"))

      toast({
        title: "Memory cleared successfully",
      })
      onClearMemory?.()
      setMessages([])
    } catch (error) {
      toast({
        title: "Failed to clear memory",
        variant: "destructive",
      })
    }
  }

  const handleHide = () => {
    setVisible(false)
  }

  if (!showWarning || !visible) return null

  return (
    <div className="fixed z-50 px-4 right-0 py-3 bg-red-500/30 backdrop-blur border mx-2">
      <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
        <span>
          Chat History: <span className="font-semibold">{messageCount}</span> characters
        </span>
        <span>{percentage}%</span>
      </div>
      <Progress
        value={percentage}
        className="h-2"
        indicatorClassName={cn("transition-all", getProgressColor())}
      />
      <AnimatePresence>
        {showWarning && visible && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: 0,
              y: 4,
              transition: {
                duration: 0.2,
              },
            }}
            className="mt-3 rounded-md border border-amber-400/40 bg-amber-100 p-3"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-0.5">
                <p className="text-sm font-medium text-amber-700">Chat history is getting long</p>
                <p className="text-xs text-amber-700">
                  Consider clearing memory for better performance.
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-amber-600 border-amber-400 hover:bg-amber-200/30 h-7 px-2 text-xs"
                  onClick={handleClearMemory}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-gray-200 border-gray-400 hover:bg-gray-200/30 h-7 px-2 text-xs"
                  onClick={handleHide}
                >
                  <X className="w-3 h-3 mr-1" />
                  Hide
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}