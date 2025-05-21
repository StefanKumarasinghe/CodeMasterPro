"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Maximize2, Minimize2, Play, Square, ChevronRight, Package, Clock, MessageSquare, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { API_ENDPOINT } from "@/config/constants"
import { toast } from "@/utils/toast-util"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { useChat } from "@/context/chat-context"
import { Textarea } from "@/components/ui/textarea"

interface PythonShellProps {
  code: string
  isOpen: boolean
  onClose: () => void
}

interface PythonOutput {
  stdout: string
  stderr: string
  dependencies: string[]
  corrected_code?: string
  installed_packages?: string[]
}

export function PythonShell({ code, isOpen, onClose }: PythonShellProps) {
  const [isFullscreen, setIsFullscreen] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState<PythonOutput | null>(null)
  const [outputHistory, setOutputHistory] = useState<
    Array<{ type: "command" | "result" | "system"; content: string | PythonOutput }>
  >([])
  const [command, setCommand] = useState("")
  const [sessionId, setSessionId] = useState<string>("")
  const [dependencies, setDependencies] = useState<string[]>([])
  const [installedPackages, setInstalledPackages] = useState<string[]>([])
  const [multilineMode, setMultilineMode] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(300)
  const [showCorrectedCode, setShowCorrectedCode] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const { handleSubmit } = useChat()
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const hasInitializedRef = useRef(false)
  const instanceId = useRef(`python-shell-${Date.now()}`)

  useEffect(() => {
    if (!hasInitializedRef.current && isOpen) {
      hasInitializedRef.current = true
      initSession()
      startSessionTimer()
    }

    if (!isOpen) {
      hasInitializedRef.current = false
      window.dispatchEvent(
        new CustomEvent("python-shell-state", {
          detail: { isOpen: false, width: 0, instanceId: instanceId.current },
        }),
      )
    } else {

      window.dispatchEvent(
        new CustomEvent("code-editor-close", {
          detail: { forced: true },
        }),
      )
      window.dispatchEvent(
        new CustomEvent("node-test-runner-close", {
          detail: { forced: true },
        }),
      )
      window.dispatchEvent(
        new CustomEvent("html-preview-close", {
          detail: { forced: true },
        }),
      )

      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("python-shell-state", {
            detail: { isOpen: true, width: 400, instanceId: instanceId.current },
          }),
        )
      }, 50)
    }

    const handleForcedClose = (event: CustomEvent) => {
      if (event.detail?.forced) {
        handleClose()
      }
    }


    const handleNewShell = (event: CustomEvent) => {
      if (event.detail?.isOpen && event.detail?.instanceId !== instanceId.current) {
        // Instead of closing, just update the UI state
        onClose()
      }
    }

    window.addEventListener("python-shell-close", handleForcedClose as EventListener)
    window.addEventListener("python-shell-state", handleNewShell as EventListener)

    return () => {
      // Only terminate session if we're actually closing the shell
      if (!isOpen) {
        if (sessionId) {
          terminateSession()
        }
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }
      window.removeEventListener("python-shell-close", handleForcedClose as EventListener)
      window.removeEventListener("python-shell-state", handleNewShell as EventListener)
    }
  }, [isOpen, sessionId])

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
          toast.warning("Python session timed out after 5 minutes")
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
        corrected_code: data.corrected_code || "",
        installed_packages: data.installed_packages || [],
      }

      setOutput(result)
      setDependencies(result.dependencies || [])
      setInstalledPackages(result.installed_packages || [])

      setOutputHistory((prev) => [...prev, { type: "result", content: result }])
    } catch (error) {
      console.error("Failed to run code:", error)
      setOutputHistory((prev) => [...prev, { type: "system", content: "Error: Failed to run code." }])
      toast.error("Failed to run code")
    } finally {
      setIsRunning(false)
      setShowCorrectedCode(false)
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
        corrected_code: data.corrected_code || "",
        installed_packages: data.installed_packages || [],
      }

      setOutput(result)
      if (result.dependencies.length > 0) {
        setDependencies(result.dependencies || [])
      }
      setInstalledPackages(result.installed_packages || [])

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
      setShowCorrectedCode(false)
    }
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const handleClose = () => {
    // Only terminate session if we're actually closing the shell
    if (!isOpen) {
      terminateSession()
    }


    window.dispatchEvent(
      new CustomEvent("python-shell-state", {
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

    const prompt = `Analyse this output from my terminal, if it is an error recommend a fix, or else explain it:\n\n\`\`\`python\n${outputLogs}\n\`\`\`\n\n Is there any fix or improvements?`

    handleSubmit(prompt)

    toast.success("Sent Python logs to CodeMasterPro for analysis")
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
      if (e.key === "R" && (e.ctrlKey || e.metaKey)) {
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
            item.type === "command" ? "text-blue-400" : item.type === "system" ? "text-gray-400 " : "text-zinc-300",
          )}
        >
          {item.content}
        </div>
      )
    } else {
      return (
        <div>
          {item.content.stdout && <div className="text-green-300 whitespace-pre-wrap">{item.content.stdout}</div>}
          {item.content.stderr && <div className="text-red-400 whitespace-pre-wrap">{item.content.stderr}</div>}
        </div>
      )
    }
  }

  const copyCorrectedCode = () => {
    if (output?.corrected_code) {
      navigator.clipboard.writeText(output.corrected_code)
      toast.success("Corrected code copied to clipboard!")
    } else {
      toast.error("No corrected code available.")
    }
  }

  if (!isOpen) return null

  return (
    <div
      ref={shellRef}
      className={cn(
        "border-l border-zinc-700 shadow-xl flex flex-col bg-zinc-900 transition-all duration-300",
        isOpen ? "fixed z-50 top-0 right-0 h-full w-[400px] min-w-[350px]" : "hidden",
      )}
    >
      <div className="flex items-center justify-between p-2 border-b border-zinc-700 bg-zinc-800">
        <div className="flex items-center gap-2">
          {sessionId && (
            <Badge
              variant="outline"
              className="text-xs bg-blue-900/30 text-blue-300 border-blue-700 truncate max-w-[200px]"
            >
              Session: {sessionId}
            </Badge>
          )}
          <Badge variant="outline" className="position-fixed text-xs bg-amber-900/30 text-amber-300 border-amber-700">
            <Clock className="h-3 w-3 mr-1" />
            {formatTimeRemaining()}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="link" className="text-red-500" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>

      <div className="flex items-center p-2 border-b border-zinc-700 bg-zinc-800">
        <div className="flex items-center gap-1">
          <Button
            variant="link"
            size="sm"
            className="h-8 gap-1 border-none text-green-500"
            onClick={runCode}
            disabled={isRunning || !sessionId}
          >
            {isRunning ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isRunning ? "Stop" : "Run Code"}
          </Button>

          <Button
            variant="link"
            size="sm"
            className="h-8 gap-1  text-purple-400 "
            onClick={askTarsAboutError}
            disabled={outputHistory.length === 0}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            Ask AI
          </Button>
          {output?.corrected_code && (
            <Button
              variant="link"
              size="sm"
              className="h-8 gap-1 text-yellow-400"
              onClick={() => setShowCorrectedCode(!showCorrectedCode)}
            >
              Corrected Code
            </Button>
          )}
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
      {installedPackages.length > 0 && (
        <div className="flex flex-wrap gap-1 p-2 border-b border-zinc-700 bg-zinc-800/50">
          <div className="flex items-center gap-1 text-xs text-zinc-400">
            <Package className="h-3 w-3" />
            <span>Installed Packages:</span>
          </div>
          {installedPackages.map((dep, index) => (
            <Badge key={index} variant="outline" className="text-xs bg-zinc-800 text-zinc-300">
              {dep}
            </Badge>
          ))}
        </div>
      )}

      <div ref={outputRef} className="flex-1 p-3 overflow-auto text-sm text-zinc-300 whitespace-pre-wrap bg-zinc-900">
        {showCorrectedCode && output?.corrected_code ? (
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-zinc-500 italic">Corrected Code:</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-zinc-400 hover:text-zinc-100"
                onClick={copyCorrectedCode}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-green-300 whitespace-pre-wrap">{output.corrected_code}</div>
          </div>
        ) : outputHistory.length === 0 ? (
          <div className="text-zinc-500 italic">Output will appear here. Run your code to see the results.</div>
        ) : (
          outputHistory.map((item, i) => (
            <div key={i} className="mb-2">
              {renderOutputContent(item)}
            </div>
          ))
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        className={cn("h-8 rounded-none", multilineMode ? "bg-blue-600 text-white " : "text-zinc-400")}
        onClick={() => setMultilineMode(!multilineMode)}
      >
        {multilineMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        {multilineMode ? "Single Line" : "Multiline"}
      </Button>
      <form onSubmit={executeCommand} className="flex items-start p-2 border-t border-zinc-700 bg-zinc-800">
        <ChevronRight className="h-4 w-4 text-blue-500 mr-2 mt-2" />
        {multilineMode ? (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="flex-1 bg-zinc-800 border-none outline-none text-sm text-zinc-300 font-mono min-h-[60px] resize-y"
            placeholder="Enter Python commands or prompts, CodeMasterPro will automatically try validate and fix them."
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
