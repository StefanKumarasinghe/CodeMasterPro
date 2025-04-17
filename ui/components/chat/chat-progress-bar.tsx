"use client"

import { useEffect, useState } from "react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Trash2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface ChatProgressBarProps {
  messageCount: number
  onClearMemory: () => void
}

export function ChatProgressBar({ messageCount, onClearMemory }: ChatProgressBarProps) {
  const [showWarning, setShowWarning] = useState(false)

  const percentage = Math.min(Math.round((messageCount / 30) * 100), 100)

  const getProgressColor = () => {
    if (percentage < 50) return "bg-green-500"
    if (percentage < 80) return "bg-amber-500"
    return "bg-red-500"
  }

  useEffect(() => {
    if (messageCount > 30) {
      setShowWarning(true)
    } else {
      setShowWarning(false)
    }
  }, [messageCount])

  return (
    <div className="w-full px-4 py-2">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-muted-foreground">
          Optimizer Chat length checker: <span className="font-medium">{messageCount} messages</span>
        </div>
        <div className="text-xs text-muted-foreground">{percentage}%</div>
      </div>

      <Progress value={percentage} className="h-1.5" indicatorClassName={cn("transition-colors", getProgressColor())} />

      <AnimatePresence>
        {showWarning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-md p-2"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-amber-500 font-medium">Chat history is getting long</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  For better performance, consider clearing memory.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                onClick={onClearMemory}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear Memory
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
