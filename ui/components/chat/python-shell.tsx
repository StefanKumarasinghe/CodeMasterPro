"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import {
  X,
  Maximize2,
  Minimize2,
  Play,
  Square,
  ChevronRight,
  Terminal,
  Package,
  Clock,
  MessageSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { API_ENDPOINT } from "@/config/constants"
import { toast } from "@/utils/toast-util"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { useChat } from "@/context/chat-context"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface PythonShellProps {
  code: string
  isOpen: boolean
  onClose: () => void
}

interface PythonOutput {
  stdout: string
  stderr: string
  dependencies: string[]
}

export function PythonShell({ code, isOpen, onClose }: PythonShellProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState<PythonOutput | null>(null)
  const [outputHistory, setOutputHistory] = useState<
    Array<{ type: "command" | "result" | "system"; content: string | PythonOutput }>
  >([])
  const [command, setCommand] = useState("")
  const [sessionId, setSessionId] = useState<string>("")
  const [dependencies, setDependencies] = useState<string[]>([])
  const [multilineMode, setMultilineMode] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(300) 
  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)
  const { handleSubmit } = useChat()

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const hasInitializedRef = useRef(false)
  
  useEffect(() => {
    if (!hasInitializedRef.current && isOpen) {
      hasInitializedRef.current = true
      console.log("Initializing session")
      initSession()
      startSessionTimer()
    }
  
    // Reset the ref when the modal is closed so it can reinitialize next time
    if (!isOpen) {
      hasInitializedRef.current = false
    }
  
    return () => {
      console.log("Cleaning up session")
      if (sessionId) {
        terminateSession()
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isOpen])
  
  const startSessionTimer = () => {
    console.log("Starting session timer")
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
          toast.warning("Python session timed out after 5 minutes")
          terminateSession()
          onClose()
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
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [outputHistory])

  const initSession = async () => {
    try {
      setOutputHistory([{ type: "system", content: "Initializing Python session..." }])

      const response = await fetch(`${API_ENDPOINT}/init_python_session`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to initialize Python session")
      }

      const data = await response.json()
      setSessionId(data.session_id)

      setOutputHistory((prev) => [
        ...prev,
        { type: "system", content: "Python session initialized. Ready to run code." },
        { type: "system", content: "Session will automatically close after 5 minutes of inactivity." },
      ])
    } catch (error) {
      console.error("Failed to initialize session:", error)
      setOutputHistory((prev) => [...prev, { type: "system", content: "Error: Failed to initialize Python session." }])
      toast.error("Failed to initialize Python session")
    }
  }

  const terminateSession = async () => {
    if (!sessionId) return

    try {
      await fetch(`${API_ENDPOINT}/close_python_session`, {
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

      setOutputHistory((prev) => [...prev, { type: "system", content: "Python session closed." }])
    } catch (error) {
      console.error("Failed to terminate session:", error)
    }
  }

  const runCode = async () => {
    if (!sessionId) {
      setOutputHistory((prev) => [...prev, { type: "system", content: "Error: No active Python session." }])
      return
    }

    startSessionTimer()

    setIsRunning(true)
    setOutputHistory((prev) => [...prev, { type: "command", content: "Running code..." }])

    try {
      const response = await fetch(`${API_ENDPOINT}/run_python_code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          session_id: sessionId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to run code")
      }

      const data = await response.json()
      const result: PythonOutput = {
        stdout: data.stdout || "",
        stderr: data.stderr || "",
        dependencies: data.dependencies || [],
      }

      setOutput(result)
      setDependencies(result.dependencies)

      setOutputHistory((prev) => [...prev, { type: "result", content: result }])
    } catch (error) {
      console.error("Failed to run code:", error)
      setOutputHistory((prev) => [...prev, { type: "system", content: "Error: Failed to run code." }])
      toast.error("Failed to run code")
    } finally {
      setIsRunning(false)
    }
  }


  const executeCommand = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!command.trim() || !sessionId) return

    startSessionTimer()

    const commandText = command.trim()
    setOutputHistory((prev) => [...prev, { type: "command", content: `>>> ${commandText}` }])

    try {
      const response = await fetch(`${API_ENDPOINT}/run_python_code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: commandText,
          session_id: sessionId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to execute command")
      }

      const data = await response.json()


      const result: PythonOutput = {
        stdout: data.stdout || "",
        stderr: data.stderr || "",
        dependencies: data.dependencies || [],
      }

      setOutput(result)
      if (result.dependencies.length > 0) {
        setDependencies(result.dependencies)
      }

      setOutputHistory((prev) => [...prev, { type: "result", content: result }])
    } catch (error) {
      console.error("Failed to execute command:", error)
      setOutputHistory((prev) => [...prev, { type: "system", content: "Error: Failed to execute command." }])
      toast.error("Failed to execute command")
    } finally {
      setCommand("")
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const handleClose = () => {
    terminateSession()
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

    const prompt = `Analyse this output from my terminal, if it is an error recommend a fix, or else explain it:\n\n\`\`\`python\n${outputLogs}\n\`\`\`\n\n Is there any fix or improvements?`

    handleSubmit(prompt)


    toast.success("Sent Python logs to TARS for analysis")

  }


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {

      if (e.key === "Escape") {
        if (isFullscreen) {
          setIsFullscreen(false)
        } else {
          handleClose()
        }
      }

      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        if (multilineMode && document.activeElement === inputRef.current) {
          executeCommand(new Event("submit") as any)
        } else if (!isRunning) {
          runCode()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFullscreen, isRunning, multilineMode, command])


  const renderOutputContent = (item: { type: "command" | "result" | "system"; content: string | PythonOutput }) => {
    if (typeof item.content === "string") {
      return (
        <div
          className={cn(
            item.type === "command"
              ? "text-blue-400"
              : item.type === "system"
                ? "text-gray-400 italic"
                : "text-zinc-300",
          )}
        >
          {item.content}
        </div>
      )
    } else {
      // It's a PythonOutput object
      return (
        <div>
          {item.content.stdout && <div className="text-green-300 whitespace-pre-wrap">{item.content.stdout}</div>}
          {item.content.stderr && <div className="text-red-400 whitespace-pre-wrap">{item.content.stderr}</div>}
        </div>
      )
    }
  }

  if (!isOpen) return null

  return (
    <div
className={cn(
  "border-l border-zinc-700 shadow-xl flex flex-col bg-zinc-900 transition-all duration-300",
  isFullscreen ? "fixed z-50 top-0 right-0 h-full  w-1/3 min-w-[350px] " : "my-2 w-fit w-full rounded-lg bottom-5 right-5 shadow-2xl border border-zinc-800",
)}
    >
      <div className="flex items-center justify-between p-2 border-b border-zinc-700 bg-zinc-800">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-medium text-zinc-300">Python Shell</span>
          {sessionId && (
            <Badge variant="outline" className="text-xs bg-blue-900/30 text-blue-300 border-blue-700">
              Session: {sessionId.substring(0, 8)}...
            </Badge>
          )}
          <Badge variant="outline" className="text-xs bg-amber-900/30 text-amber-300 border-amber-700">
            <Clock className="h-3 w-3 mr-1" />
            {formatTimeRemaining()}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-400 hover:text-zinc-100"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="destructive"

            onClick={handleClose}
          >
            Close session
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-zinc-700 bg-zinc-800">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 border-blue-500 text-white"
            onClick={runCode}
            disabled={isRunning || !sessionId}
          >
            {isRunning ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isRunning ? "Stop" : "Run Code"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 bg-purple-600 hover:bg-purple-700 border-purple-500 text-white"
            onClick={askTarsAboutError}
            disabled={outputHistory.length === 0}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            Ask TARS
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center space-x-2">
            <Switch id="multiline-mode" checked={multilineMode} onCheckedChange={setMultilineMode} />
            <Label htmlFor="multiline-mode" className="text-xs text-zinc-400">
              Multiline
            </Label>
          </div>
          <div className="text-xs text-zinc-400">{isRunning ? "Running..." : "Press Ctrl+Enter to run"}</div>
        </div>
      </div>


      {dependencies.length > 0 && (
        <div className="flex flex-wrap gap-1 p-2 border-b border-zinc-700 bg-zinc-800/50">
          <div className="flex items-center gap-1 text-xs text-zinc-400">
            <Package className="h-3 w-3" />
            <span>Dependencies:</span>
          </div>
          {dependencies.map((dep, index) => (
            <Badge key={index} variant="outline" className="text-xs bg-zinc-800 text-zinc-300">
              {dep}
            </Badge>
          ))}
        </div>
      )}


      <div
        ref={outputRef}
        className="flex-1 p-3 overflow-auto font-mono text-sm text-zinc-300 whitespace-pre-wrap bg-zinc-900"
      >
        {outputHistory.length === 0 ? (
          <div className="text-zinc-500 italic">Output will appear here. Run your code to see the results.</div>
        ) : (
          outputHistory.map((item, i) => (
            <div key={i} className="mb-2">
              {renderOutputContent(item)}
            </div>
          ))
        )}
      </div>

      <form onSubmit={executeCommand} className="flex items-start p-2 border-t border-zinc-700 bg-zinc-800">
        <ChevronRight className="h-4 w-4 text-blue-500 mr-2 mt-2" />
        {multilineMode ? (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="flex-1 bg-zinc-800 border-none outline-none text-sm text-zinc-300 font-mono min-h-[60px] resize-y"
            placeholder="Enter Python commands (Ctrl+Enter to execute)..."
            disabled={!sessionId}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-300 font-mono"
            placeholder="Enter Python command..."
            disabled={!sessionId}
          />
        )}

        {multilineMode && (
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="ml-2 h-8 bg-blue-600 hover:bg-blue-700 border-blue-500 text-white"
            disabled={!sessionId || !command.trim()}
          >
            Run
          </Button>
        )}
      </form>
    </div>
  )
}
