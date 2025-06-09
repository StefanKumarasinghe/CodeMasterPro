"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Maximize2, Minimize2, Clock, MessageSquare, Terminal, Play, X, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { API_ENDPOINT } from "@/config/constants"
import { toast } from "@/utils/toast-util"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { useChat } from "@/context/chat-context"
import { Textarea } from "@/components/ui/textarea"

interface BashShellProps {
  isOpen: boolean
  onClose: () => void
  workingDirectory?: string
  initialCode?: string
}

interface BashOutput {
  stdout: string
  stderr: string
  exit_code: number
}

export function BashShell({ isOpen, onClose, workingDirectory, initialCode }: BashShellProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState<BashOutput | null>(null)
  const [outputHistory, setOutputHistory] = useState<
    Array<{ type: "command" | "result" | "system"; content: string | BashOutput; timestamp: Date }>
  >([])
  const [command, setCommand] = useState(initialCode || "")
  const [sessionId, setSessionId] = useState<string>("")
  const [multilineMode, setMultilineMode] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(300)
  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const { handleSubmit } = useChat()
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const hasInitializedRef = useRef(false)
  const instanceId = useRef(`bash-shell-${Date.now()}`)

  useEffect(() => {
    if (isOpen && !hasInitializedRef.current) {
      hasInitializedRef.current = true
      initSession()
      startSessionTimer()

      window.dispatchEvent(new CustomEvent("code-editor-close", { detail: { forced: true } }))
      window.dispatchEvent(new CustomEvent("bash-shell-close", { detail: { forced: true } }))
      window.dispatchEvent(new CustomEvent("python-shell-close", { detail: { forced: true } }))
      window.dispatchEvent(new CustomEvent("html-preview-close", { detail: { forced: true } }))
      window.dispatchEvent(new CustomEvent("node-test-runner-close", { detail: { forced: true } }))

      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("bash-shell-state", {
            detail: { isOpen: true, width: 400, instanceId: instanceId.current },
          }),
        )
      }, 50)
    }

    if (!isOpen) {
      hasInitializedRef.current = false
      window.dispatchEvent(
        new CustomEvent("bash-shell-state", {
          detail: { isOpen: false, width: 0, instanceId: instanceId.current },
        }),
      )
    }

    const handleForcedClose = (event: CustomEvent) => {
      if (event.detail?.forced) {
        handleClose()
      }
    }

    window.addEventListener("bash-shell-close", handleForcedClose as EventListener)

    return () => {
      window.removeEventListener("bash-shell-close", handleForcedClose as EventListener)
    }
  }, [isOpen])

  useEffect(() => {
    if (initialCode && sessionId) {
      executeCommand(new Event("submit") as any)
    }
  }, [initialCode, sessionId])

  const startSessionTimer = () => {
    setTimeRemaining(300)

    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          toast.warning("Bash session timed out after 5 minutes")
          terminateSession()
          handleClose()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const formatTimeRemaining = () => {
    const minutes = Math.floor(timeRemaining / 60)
    const seconds = timeRemaining % 60
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const getTimerColor = () => {
    if (timeRemaining > 180) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
    if (timeRemaining > 60) return "text-amber-400 border-amber-500/30 bg-amber-500/10"
    return "text-red-400 border-red-500/30 bg-red-500/10"
  }

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [outputHistory])

  const initSession = async () => {
    try {
      setOutputHistory([{ type: "system", content: "🚀 Initializing Bash session...", timestamp: new Date() }])

      const response = await fetch(`${API_ENDPOINT}/init_bash_session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          working_directory: workingDirectory,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to initialize Bash session")
      }

      const data = await response.json()
      setSessionId(data.session_id)

      setOutputHistory((prev) => [
        ...prev,
        { type: "system", content: "✅ Bash session initialized successfully", timestamp: new Date() },
        { type: "system", content: "⏱️ Session will auto-close after 5 minutes of inactivity", timestamp: new Date() },
      ])
    } catch (error) {
      console.error("Failed to initialize session:", error)
      setOutputHistory((prev) => [...prev, { type: "system", content: "❌ Error: Failed to initialize Bash session", timestamp: new Date() }])
      toast.error("Failed to initialize Bash session")
    }
  }

  const terminateSession = async () => {
    if (!sessionId) return

    try {
      await fetch(`${API_ENDPOINT}/close_bash_session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session_id: sessionId }),
      })
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      setOutputHistory((prev) => [...prev, { type: "system", content: "🔒 Bash session closed", timestamp: new Date() }])
    } catch (error) {
      console.error("Failed to terminate session:", error)
    }
  }

  const executeCommand = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!command.trim() || !sessionId) return

    setIsRunning(true)
    startSessionTimer()

    const commandText = command.trim()
    setOutputHistory((prev) => [...prev, { type: "command", content: commandText, timestamp: new Date() }])

    try {
      const response = await fetch(`${API_ENDPOINT}/run_bash_command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          command: commandText,
          session_id: sessionId
        })
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error("Command execution failed:", errorData)
        throw new Error(`Failed to execute command: ${errorData}`)
      }

      const data = await response.json()

      const result: BashOutput = {
        stdout: data.stdout || "",
        stderr: data.stderr || "",
        exit_code: data.exit_code || 0,
      }

      setOutput(result)
      setOutputHistory((prev) => [...prev, { type: "result", content: result, timestamp: new Date() }])
    } catch (error) {
      console.error("Failed to execute command:", error)
      setOutputHistory((prev) => [...prev, { type: "system", content: "❌ Error: Failed to execute command", timestamp: new Date() }])
      toast.error("Failed to execute command")
    } finally {
      setIsRunning(false)
      setCommand("")
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }
  }

  const handleClose = () => {
    terminateSession()
    
    window.dispatchEvent(
      new CustomEvent("bash-shell-state", {
        detail: { isOpen: false, width: 0, instanceId: instanceId.current },
      }),
    )

    onClose()
  }

  const askTarsAboutError = () => {
    const outputLogs = outputHistory
      .map((item) => {
        if (typeof item.content === "string") {
          return item.content
        } else {
          return `${item.content.stdout ? `Output: ${item.content.stdout}\n` : ""}${item.content.stderr ? `Error: ${item.content.stderr}\n` : ""}`
        }
      })
      .join("\n")

    const prompt = `Analyse this output from my bash terminal, if it is an error recommend a fix, or else explain it:\n\n\`\`\`bash\n${outputLogs}\n\`\`\`\n\n Is there any fix or improvements?`

    handleSubmit(prompt)

    toast.success("Sent Bash logs to CodeMasterPro for analysis")
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isFullscreen) {
          setIsFullscreen(false)
          window.dispatchEvent(
            new CustomEvent("bash-shell-state", {
              detail: { isOpen: true, width: 400, instanceId: instanceId.current },
            }),
          )
        } else {
          handleClose()
        }
      }
      if (e.key === "Enter" && !e.shiftKey && !multilineMode && document.activeElement === inputRef.current) {
        e.preventDefault()
        executeCommand(new Event("submit") as any)
        if (inputRef.current) {
          inputRef.current.focus()
        }

      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFullscreen, isRunning, multilineMode, command])

  const renderOutputContent = (item: { type: "command" | "result" | "system"; content: string | BashOutput; timestamp: Date }) => {
    const timeStr = item.timestamp.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })

    if (typeof item.content === "string") {
      return (
        <div className="group hover:bg-slate-800/30 rounded-lg p-1.5 transition-all duration-200">
          <div className="flex items-start gap-3">
            <div className={cn(
              "flex-shrink-0 w-2 h-2 rounded-full mt-2",
              item.type === "command" ? "bg-blue-400 shadow-lg shadow-blue-400/50" : 
              item.type === "system" ? "bg-gray-400" : "bg-green-400"
            )} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-400 font-mono">{timeStr}</span>
                {item.type === "command" && (
                  <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                    CMD
                  </Badge>
                )}
              </div>
              <div className={cn(
                "font-mono text-sm leading-relaxed",
                item.type === "command" ? "text-blue-300 bg-blue-500/5 p-2 rounded border-l-2 border-blue-400" : 
                item.type === "system" ? "text-slate-300" : "text-slate-200"
              )}>
                {item.type === "command" && "$ "}{item.content}
              </div>
            </div>
          </div>
        </div>
      )
    } else {
      return (
        <div className="group hover:bg-slate-800/30 rounded-lg p-1.5 transition-all duration-200">
          <div className="flex items-start gap-3">
            <div className={cn(
              "flex-shrink-0 w-2 h-2 rounded-full mt-2",
              item.content.exit_code === 0 ? "bg-green-400 shadow-lg shadow-green-400/50" : "bg-red-400 shadow-lg shadow-red-400/50"
            )} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-slate-400 font-mono">{timeStr}</span>
                <Badge variant="outline" className={cn(
                  "text-xs",
                  item.content.exit_code === 0 ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"
                )}>
                  EXIT {item.content.exit_code}
                </Badge>
              </div>
              {item.content.stdout && (
                <div className="bg-slate-800/50 rounded p-3 mb-2 border-l-2 border-green-400">
                  <pre className="text-green-300 text-sm whitespace-pre-wrap font-mono leading-relaxed scrollbar-hide">{item.content.stdout}</pre>
                </div>
              )}
              {item.content.stderr && (
                <div className="bg-red-500/5 rounded p-3 border-l-2 border-red-400">
                  <pre className="text-red-300 text-sm whitespace-pre-wrap font-mono leading-relaxed">{item.content.stderr}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }
  }
  if (!isOpen) return null

  return (
    <div
      ref={shellRef}
      className={cn(
        "border-l border-slate-700/50 shadow-2xl flex flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 transition-all duration-300 backdrop-blur-sm",
        isFullscreen 
          ? "fixed z-50 top-0 right-0 h-full w-full" 
          : isOpen 
            ? "fixed z-50 top-0 right-0 h-full w-full md:w-[400px] min-w-[350px]" 
            : "hidden"
      )}
      style={{
        zIndex: 1000,
      }}
    >
    <div className="flex items-center justify-between p-3 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/80 to-slate-800/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-blue-400" />
            <span className="font-medium text-slate-200 text-sm">Bash Terminal</span>
          </div>
          <div className="flex items-center gap-2">
            {sessionId && (
              <Badge
                variant="outline"
                className="text-xs bg-blue-500/10 text-blue-300 border-blue-500/30 font-mono px-2 py-0.5 truncate max-w-[120px]"
              >
                {sessionId.slice(0, 6)}...
              </Badge>
            )}
            <Badge variant="outline" className={cn("text-xs font-mono px-2 py-0.5", getTimerColor())}>
              <Clock className="h-3 w-3 mr-1" />
              {formatTimeRemaining()}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            onClick={() => {
              setIsFullscreen(!isFullscreen)
              window.dispatchEvent(
                new CustomEvent("bash-shell-state", {
                  detail: { isOpen: true, width: isFullscreen ? 400 : window.innerWidth, instanceId: instanceId.current },
                }),
              )
            }}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" 
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between p-3 border-b border-slate-700/30 bg-slate-800/30">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors"
          onClick={askTarsAboutError}
          disabled={outputHistory.length === 0}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Ask AI
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 gap-2 transition-colors",
            multilineMode 
              ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30" 
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
          )}
          onClick={() => setMultilineMode(!multilineMode)}
        >
          {multilineMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          {multilineMode ? "Single Line" : "Multiline"}
        </Button>
      </div>

      <div ref={outputRef} className="flex-1 p-3 overflow-auto scrollbar-hide bg-slate-950/50">
        {outputHistory.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-slate-500">
              <Terminal className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium mb-1">Ready to execute commands</p>
              <p className="text-sm">Start typing below to run bash commands</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {outputHistory.map((item, i) => (
              <div key={i} className="scrollbar-hide">
                {renderOutputContent(item)}
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={executeCommand} className="border-t border-slate-700/50 bg-gradient-to-r from-slate-800/60 to-slate-800/40 backdrop-blur-sm">
        <div className="flex items-start p-3 gap-3">
          {multilineMode ? (
            <div className="flex-1 flex gap-2">
              <Textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                className="flex-1 bg-slate-900/50 border-slate-600/50 text-slate-200 font-mono text-sm min-h-[80px] resize-none focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                placeholder="Enter bash commands..."
                disabled={!sessionId || isRunning}
              />
              <Button
                type="submit"
                size="sm"
                className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                disabled={!sessionId || !command.trim() || isRunning}
              >
                {isRunning ? (
                  <Zap className="h-4 w-4 animate-pulse" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            </div>
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="flex-1 bg-transparent text-slate-200 font-mono text-sm outline-none placeholder:text-slate-500 focus:text-white transition-colors"
              placeholder="Enter bash command and press Enter..."
              disabled={!sessionId || isRunning}
            />
          )}
        </div>
      </form>
    </div>
  )
}