

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Trash2, X, Sparkles, Zap } from "lucide-react"
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
  const [isClearing, setIsClearing] = useState(false)
  const { setMessages } = useChat()
  const { toast } = useToast()
  const percentage = Math.min(Math.round((messageCount / 300000) * 100), 100)

  const getProgressColor = () => {
    if (percentage < 50) return "from-emerald-400 to-green-500"
    if (percentage < 80) return "from-amber-400 to-orange-500"
    return "from-red-400 to-rose-500"
  }

  const getGlowColor = () => {
    if (percentage < 50) return "shadow-emerald-500/30"
    if (percentage < 80) return "shadow-amber-500/30"
    return "shadow-red-500/30"
  }

  useEffect(() => {
    setShowWarning(messageCount > 200000)
  }, [messageCount])

  const handleClearMemory = async () => {
    setIsClearing(true)
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
        title: "✨ Memory cleared successfully",
        description: "Your chat is now fresh and optimized",
      })
      onClearMemory?.()
      setMessages([])
    } catch (error) {
      toast({
        title: "❌ Failed to clear memory",
        description: "Please try again in a moment",
        variant: "destructive",
      })
    } finally {
      setIsClearing(false)
    }
  }

  const handleHide = () => {
    setVisible(false)
  }

  if (!showWarning || !visible) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="absolute top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-black/80 border-b border-white/20 dark:border-white/10 shadow-2xl"
    >
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5" />
        
        <div className="relative px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Zap className="h-4 w-4 text-blue-500" />
                <div className="absolute inset-0 animate-pulse">
                  <Zap className="h-4 w-4 text-blue-300" />
                </div>
              </div>
              <span className="text-sm font-medium bg-gradient-to-r from-slate-700 to-slate-900 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                Chat Memory Usage
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                {messageCount.toLocaleString()} chars
              </span>
              <span className={cn(
                "text-xs px-2 py-1 rounded-full font-semibold",
                percentage < 50 && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
                percentage >= 50 && percentage < 80 && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                percentage >= 80 && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
              )}>
                {percentage}%
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                className={cn(
                  "h-full bg-gradient-to-r rounded-full relative overflow-hidden",
                  getProgressColor(),
                  getGlowColor(),
                  "shadow-lg"
                )}
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent w-1/3"
                  animate={{ x: ["-100%", "300%"] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
              </motion.div>
            </div>
          </div>

          <AnimatePresence>
            {showWarning && visible && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="mt-4"
              >
                <div className="relative overflow-hidden rounded-xl border border-amber-200/50 dark:border-amber-800/50 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5" />
                  
                  <div className="relative p-4">
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <AlertTriangle className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                        <motion.div
                          className="absolute inset-0"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <AlertTriangle className="h-5 w-5 text-amber-300 dark:text-amber-600" />
                        </motion.div>
                      </div>
                      
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                            Memory Optimization Needed
                          </h4>
                          <Sparkles className="h-3 w-3 text-amber-500 animate-pulse" />
                        </div>
                        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                          Your chat history is getting quite large. Clearing memory will improve performance and responsiveness.
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isClearing}
                          className={cn(
                            "h-8 px-3 text-xs font-medium transition-all duration-200",
                            "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700",
                            "text-white border-red-400 hover:border-red-500",
                            "shadow-lg hover:shadow-red-500/25",
                            "hover:scale-105 active:scale-95",
                            isClearing && "animate-pulse"
                          )}
                          onClick={handleClearMemory}
                        >
                          <motion.div
                            animate={isClearing ? { rotate: 360 } : {}}
                            transition={{ duration: 1, repeat: isClearing ? Infinity : 0 }}
                          >
                            <Trash2 className="w-3 h-3 mr-1.5" />
                          </motion.div>
                          {isClearing ? "Clearing..." : "Clear Memory"}
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-8 px-3 text-xs font-medium transition-all duration-200",
                            "bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800",
                            "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200",
                            "border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500",
                            "hover:scale-105 active:scale-95"
                          )}
                          onClick={handleHide}
                        >
                          <X className="w-3 h-3 mr-1.5" />
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
