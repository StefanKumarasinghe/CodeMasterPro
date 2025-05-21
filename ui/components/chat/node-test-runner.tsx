"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Maximize2, Minimize2, Play, Square, ChevronRight, Package, Clock, MessageSquare, Copy, Rocket, XCircle, CheckCircle, StopCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { API_ENDPOINT } from "@/config/constants"
import { toast } from "@/utils/toast-util"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { useChat } from "@/context/chat-context"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"

interface NodeTestRunnerProps {
  isOpen: boolean
  onClose: () => void
  directory?: string
  codeSnippet?: string
}

interface TestOutput {
  success: boolean
  exit_code?: number
  error?: string
  stdout: string
  stderr: string
  process_id?: string
}

type OutputItem = {
  type: "command" | "result" | "system" | "loading" | "stdout" | "stderr" | "error" | "heartbeat" | "complete"
  content: string | TestOutput
}

export function NodeTestRunner({ isOpen, onClose, directory, codeSnippet }: NodeTestRunnerProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [testCommand, setTestCommand] = useState("test")
  const [runCommand, setRunCommand] = useState("dev")
  const [output, setOutput] = useState<OutputItem[]>([])
  const [selectedDirectory, setSelectedDirectory] = useState(directory || "")
  const [testMode, setTestMode] = useState<"app" | "snippet">(directory ? "app" : "snippet")
  const [code, setCode] = useState(codeSnippet || "")
  const [testCode, setTestCode] = useState("")
  const [framework, setFramework] = useState("jest")
  const [activeProcessId, setActiveProcessId] = useState<string | null>(null)
  const [eventSource, setEventSource] = useState<EventSource | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const { handleSubmit } = useChat()
  const instanceId = useRef(`node-test-runner-${Date.now()}`)
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const resizingRef = useRef(false)

  const handleClose = useCallback(() => {
    // Cancel any pending resize timeouts
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = null;
    }
    
    // Set resizing flag to false
    resizingRef.current = false;
    
    // Only dispatch state update to restore layout
    window.dispatchEvent(
      new CustomEvent("node-test-runner-state", {
        detail: { isOpen: false, width: 0, instanceId: instanceId.current },
      }),
    )
    
    // Trigger a resize event to update the layout
    window.dispatchEvent(new CustomEvent("sidebar-resize"))
    
    setTimeout(() => {
      onClose()
    }, 50)
  }, [onClose])

  useEffect(() => {
    if (directory) {
      setSelectedDirectory(directory)
      setTestMode("app")
    }
  }, [directory])

  useEffect(() => {
    if (codeSnippet) {
      setCode(codeSnippet)
      setTestMode("snippet")
    }
  }, [codeSnippet])

  useEffect(() => {
    if (!isOpen) {
      // When closing, dispatch event to restore layout
      window.dispatchEvent(
        new CustomEvent("node-test-runner-state", {
          detail: { isOpen: false, width: 0, instanceId: instanceId.current },
        }),
      )
      window.dispatchEvent(new CustomEvent("sidebar-resize"))
      return
    } else {
      // Prevent closing other components if this component is already in the process of opening
      if (resizingRef.current) return;
      
      resizingRef.current = true;
      
      // Close other components
      window.dispatchEvent(
        new CustomEvent("code-editor-close", {
          detail: { forced: true },
        }),
      )

      window.dispatchEvent(
        new CustomEvent("python-shell-close", {
          detail: { forced: true },
        })
      )

      window.dispatchEvent(
        new CustomEvent("html-preview-close", {
          detail: { forced: true },
        })
      )

      // Wait for other components to close before updating our state
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("node-test-runner-state", {
            detail: { isOpen: true, width: isMaximized ? window.innerWidth : 400, instanceId: instanceId.current },
          }),
        )
        
        // Trigger a resize event to update the layout
        window.dispatchEvent(new CustomEvent("sidebar-resize"))
        
        // Reset resizing flag after a delay
        setTimeout(() => {
          resizingRef.current = false;
        }, 300);
      }, 100)
    }

    const handleForcedClose = (event: CustomEvent) => {
      if (event.detail?.forced) {
        handleClose()
      }
    }

    const handleNewRunner = (event: CustomEvent) => {
      if (event.detail?.isOpen && event.detail?.instanceId !== instanceId.current) {
        onClose()
      }
    }

    window.addEventListener("node-test-runner-close", handleForcedClose as EventListener)
    window.addEventListener("node-test-runner-state", handleNewRunner as EventListener)

    return () => {
      window.removeEventListener("node-test-runner-close", handleForcedClose as EventListener)
      window.removeEventListener("node-test-runner-state", handleNewRunner as EventListener)
    }
  }, [isOpen, isMaximized, onClose, handleClose])

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose()
      }
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [handleClose])

  useEffect(() => {
    const handleResize = () => {
      // Debounce resize handling
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      
      // Set a flag to prevent concurrent resize operations
      if (resizingRef.current) return;
      resizingRef.current = true;
      
      resizeTimeoutRef.current = setTimeout(() => {
        if (isOpen) {
          window.dispatchEvent(
            new CustomEvent("node-test-runner-state", {
              detail: { 
                isOpen: isOpen, 
                width: isMaximized ? window.innerWidth : 400, 
                instanceId: instanceId.current 
              },
            }),
          );
          
          // Trigger a resize event to update the layout
          window.dispatchEvent(new CustomEvent("sidebar-resize"));
        }
        
        // Clear resizing flag
        resizingRef.current = false;
        resizeTimeoutRef.current = null;
      }, 200);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [isOpen, isMaximized]);

  const runOperation = async (operationType: "test" | "run", command: string, params: URLSearchParams, endpoint: string, description: string) => {
     if (isRunning) return

     setIsRunning(true)
     setOutput(prev => [...prev, { type: "command", content: `${description}: ${command}` }, {type: "loading", content: "..."}])

     try {
       const response = await fetch(`${API_ENDPOINT}${endpoint}?${params.toString()}`, {
         method: "POST",
         headers: {
           "Content-Type": "application/json"
         },
         body: endpoint === "/test_javascript_code" ? JSON.stringify({
           code,
           test_code: testCode || undefined,
           framework
         }) : endpoint === "/run_node_app" ? JSON.stringify({
           directory: selectedDirectory || undefined,
           run_command: command
         }) : undefined,
       })

       setOutput(prev => prev.filter(item => item.type !== "loading"))

       if (!response.ok) {
         const errorText = await response.text();
         throw new Error(`HTTP error! Status: ${response.status} - ${errorText || response.statusText}`);
       }

       const result = await response.json()
       
       // For streaming endpoints, set up event source
       if (endpoint === "/run_node_app" && result.process_id) {
         setActiveProcessId(result.process_id)
         setupEventSource(result.process_id)
         setOutput(prev => [...prev, { 
           type: "system", 
           content: `Started process ${result.process_id}. Streaming output...` 
         }])
       } else {
         setOutput(prev => [...prev, { type: "result", content: result }])
         setIsRunning(false)
       }
     } catch (error) {
       console.error(`Error running ${operationType}:`, error)
       setOutput(prev => [
         ...prev.filter(item => item.type !== "loading"),
         {
           type: "system",
           content: `Operation failed: ${error instanceof Error ? error.message : String(error)}`
         }
       ])
       setIsRunning(false)
     }
  }

  const setupEventSource = (processId: string) => {
    // Close any existing event source
    if (eventSource) {
      eventSource.close()
    }

    const newEventSource = new EventSource(`${API_ENDPOINT}/node_app_output/${processId}`)
    
    // Add event listeners for each event type
    const eventTypes = ["stdout", "stderr", "error", "system", "command", "complete", "heartbeat"];
    
    eventTypes.forEach(eventType => {
      newEventSource.addEventListener(eventType, (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (eventType === "heartbeat") {
            // Ignore heartbeat messages
            return;
          }
          
          if (eventType === "complete") {
            setOutput(prev => [...prev, { type: "system", content: data.content }]);
            newEventSource.close();
            setEventSource(null);
            setActiveProcessId(null);
            setIsRunning(false);
            return;
          }
          
          setOutput(prev => [...prev, { 
            type: eventType as "stdout" | "stderr" | "error" | "system" | "command" | "heartbeat" | "complete", 
            content: data.content 
          }]);
          
          // Auto-scroll to bottom
          if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
          }
        } catch (error) {
          console.error(`Error parsing ${eventType} event data:`, error);
        }
      });
    });
    
    newEventSource.onerror = (error) => {
      console.error("EventSource error:", error);
      setOutput(prev => [...prev, { 
        type: "error", 
        content: "Connection error. Output streaming stopped." 
      }]);
      newEventSource.close();
      setEventSource(null);
      setActiveProcessId(null);
      setIsRunning(false);
    };
    
    setEventSource(newEventSource);
  }

  const stopRunningProcess = async () => {
    if (!activeProcessId) return
    
    try {
      const response = await fetch(`${API_ENDPOINT}/terminate_node_app`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          process_id: activeProcessId
        })
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! Status: ${response.status} - ${errorText || response.statusText}`)
      }
      
      const result = await response.json()
      setOutput(prev => [...prev, { type: "system", content: result.message || "Process terminated" }])
      
      // Clean up
      if (eventSource) {
        eventSource.close()
        setEventSource(null)
      }
      
      setActiveProcessId(null)
      setIsRunning(false)
    } catch (error) {
      console.error("Error stopping process:", error)
      setOutput(prev => [...prev, { 
        type: "error", 
        content: `Failed to stop process: ${error instanceof Error ? error.message : String(error)}` 
      }])
    }
  }

  // Clean up event source when component unmounts
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close()
      }
      
      // Attempt to terminate any active process when closing
      if (activeProcessId) {
        fetch(`${API_ENDPOINT}/terminate_node_app`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            process_id: activeProcessId
          })
        }).catch(error => {
          console.error("Error terminating process on unmount:", error)
        })
      }
      
      // Clear any pending timeouts
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    }
  }, [eventSource, activeProcessId])

  const runAppTests = () => {
    const params = new URLSearchParams()
    if (selectedDirectory) {
      params.append("directory", selectedDirectory)
    }
    params.append("test_command", testCommand)
    runOperation("test", `npm ${testCommand}`, params, "/run_node_tests", `Running npm ${testCommand}`)
  }

  const runApplication = () => {
    runOperation("run", runCommand, new URLSearchParams(), "/run_node_app", `Running npm ${runCommand}`)
  }

  const runSnippetTests = () => {
     const params = new URLSearchParams()
     runOperation("test", `Testing with ${framework}`, params, "/test_javascript_code", `Testing code snippet`)
  }

  const clearOutput = () => {
    setOutput([])
  }

  const copyOutput = () => {
    const text = output
      .map(item => {
        if (typeof item.content === "string") {
          return item.content
        } else {
          const result = item.content as TestOutput
          return `Success: ${result.success}\nExit Code: ${result.exit_code}\n\nStdout:\n${result.stdout}\nStderr:\n${result.stderr}\nError:\n${result.error || ""}`
        }
      })
      .join("\n\n")

    navigator.clipboard.writeText(text)
    toast.success("Output copied to clipboard")
  }

  const askAboutTests = () => {
    if (output.length === 0) return

    const lastOutputItem = output.findLast(item => item.type === "result")
    const lastErrorItem = output.findLast(item => item.type === "system")

    if (!lastOutputItem && !lastErrorItem) {
       toast.error("No recent results or errors to ask about.")
       return
    }

    let query = "Regarding the last Node.js runner output:\n\n";

    if (lastOutputItem && typeof lastOutputItem.content !== 'string') {
        const testOutput = lastOutputItem.content as TestOutput;
        query += `Success: ${testOutput.success ? "Yes" : "No"}\n`;
        if (testOutput.exit_code !== undefined) {
            query += `Exit code: ${testOutput.exit_code}\n`;
        }
        if (testOutput.stdout) {
            query += `\nStandard Output:\n\`\`\`\n${testOutput.stdout}\n\`\`\`\n`;
        }
        if (testOutput.stderr) {
            query += `\nStandard Error:\n\`\`\`\n${testOutput.stderr}\n\`\`\`\n`;
        }
         if (testOutput.error) {
            query += `\nError:\n\`\`\`\n${testOutput.error}\n\`\`\`\n`;
        }
    }

    if (lastErrorItem && typeof lastErrorItem.content === 'string') {
        if (lastOutputItem) query += "\n---\n"; // Separator if both exist
        query += `System Message:\n\`\`\`\n${lastErrorItem.content}\n\`\`\`\n`;
    }

    query += "\nCan you help me understand this result and suggest potential fixes or next steps?";

    handleSubmit(query)
    handleClose()
  }

  const handleMaximizeToggle = () => {
    // Set resizing flag to prevent other resize operations
    if (resizingRef.current) return;
    resizingRef.current = true;
    
    // Cancel any pending resize operations
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    
    // Update state
    setIsMaximized(!isMaximized);
    
    // Batch the resize operations
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("node-test-runner-state", {
          detail: { 
            isOpen: true, 
            width: !isMaximized ? window.innerWidth : 400, 
            instanceId: instanceId.current 
          },
        }),
      );
      
      window.dispatchEvent(new CustomEvent("sidebar-resize"));
      
      // Reset resizing flag after operations complete
      setTimeout(() => {
        resizingRef.current = false;
      }, 300);
    }, 50);
  };

  if (!isOpen) return null

  return (
    <div
      className={cn(
        "fixed bg-background border z-50 rounded-lg shadow-xl flex flex-col text-foreground",
        isMaximized
          ? "top-0 right-0 w-full h-full"
          : "top-0 right-0 w-full md:w-[400px] h-full"
      )}
    >
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <h3 className="text-sm font-medium flex items-center">
          <Package className="h-4 w-4 mr-2 text-primary" />
          Node.js Runner
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleMaximizeToggle}
            title={isMaximized ? "Minimize" : "Maximize"}
          >
            {isMaximized ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleClose} title="Close">
            <Square className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={testMode} className="flex-1 flex flex-col" onValueChange={(value) => setTestMode(value as "app" | "snippet")}>
        <div className="px-3 py-2 border-b bg-background">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="app">
              Application Tests
            </TabsTrigger>
            <TabsTrigger value="snippet">
              Code Snippet Tests
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="app" className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden data-[state=inactive]:hidden">
          <div className="flex flex-col gap-3">
             <Input
               placeholder="Directory path (leave empty for current)"
               value={selectedDirectory}
               onChange={(e) => setSelectedDirectory(e.target.value)}
               disabled={isRunning}
               className="text-sm"
             />
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label className="text-xs text-muted-foreground mb-1">Test command (npm)</label>
                  <Input
                     placeholder="e.g., test"
                     value={testCommand}
                     onChange={(e) => setTestCommand(e.target.value)}
                     disabled={isRunning}
                     className="text-sm"
                   />
                </div>
                <div className="flex flex-col">
                   <label className="text-xs text-muted-foreground mb-1">Run command (npm)</label>
                   <Input
                     placeholder="e.g., start"
                     value={runCommand}
                     onChange={(e) => setRunCommand(e.target.value)}
                     disabled={isRunning}
                     className="text-sm"
                   />
                </div>
             </div>
          </div>
          <div className="flex-1 border rounded-md bg-black text-gray-200 font-mono text-sm min-h-[40vh] max-h-[80vh] overflow-x-auto">
            <ScrollArea className="flex-1 h-full">
               <div
                 ref={outputRef}
                 className="p-3 whitespace-pre-wrap break-words overflow-x-hidden"
                 style={{ maxWidth: "100%", width: "100%" }}
               >
                 {output.length === 0 && !isRunning ? (
                   <div className="text-gray-500 italic">
                     Output will appear here. Run tests or application.
                   </div>
                 ) : (
                   output.map((item, index) => (
                     <div key={`app-output-${index}`} className="mb-2 last:mb-0 break-words">
                       {renderOutputContent(item, index)}
                     </div>
                   ))
                 )}
                {isRunning && !activeProcessId && (
                  <div className="flex items-center text-blue-400 italic">
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Running...
                  </div>
                )}
                {activeProcessId && (
                  <div className="flex items-center text-blue-400 italic">
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Running (streaming)...
                  </div>
                )}
               </div>
            </ScrollArea>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                onClick={clearOutput}
                variant="outline"
                size="sm"
                disabled={isRunning || output.length === 0}
                className="w-full sm:w-auto"
              >
                Clear
              </Button>
              <Button
                onClick={copyOutput}
                variant="outline"
                size="sm"
                disabled={isRunning || output.length === 0}
                 className="w-full sm:w-auto"
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copy
              </Button>

            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex-1">
              <Button
                onClick={runAppTests}
                disabled={isRunning}
                size="sm"
                variant="secondary"
                style={{ width: "100%" }}
                className={cn("w-full sm:w-auto", isRunning ? "opacity-70 cursor-not-allowed" : "")}
              >
                <Play className="h-4 " />
                Run Tests
              </Button>
              </div>
            </div>
            
          </div>
            <div className="flex-1 w-full">
            {activeProcessId && (
                <Button
                  onClick={stopRunningProcess}
                  variant="destructive"
                  size="sm"
                  className="w-full sm:w-auto"
                  style={{ width: "100%" }}
                >
                  <StopCircle className="h-3.5 w-3.5 mr-1" />
                  Stop
                </Button>
              )}
            </div>
            <div className="flex-1 w-full">
              <Button
                onClick={runApplication}
                disabled={isRunning}
                variant="default"
                style={{ width: "100%" }}
                className={cn("w-full sm:w-auto", isRunning ? "opacity-70 cursor-not-allowed" : "")}
              >
                <Rocket className="h-4 w-full mr-2" />
                Run App
              </Button> 
            </div>
        </TabsContent>

        <TabsContent value="snippet" className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden data-[state=inactive]:hidden">
          <div className="flex flex-col space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col">
                <label className="text-sm font-medium mb-3 block">Code</label>
                <Textarea
                  placeholder="Your JavaScript code here"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="font-mono h-32 text-sm resize-none"
                  disabled={isRunning}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium mb-3 block">Tests (optional)</label>
                <Textarea
                  placeholder="Test code (e.g. Jest, Mocha syntax)"
                  value={testCode}
                  onChange={(e) => setTestCode(e.target.value)}
                  className="font-mono h-32 text-sm resize-none"
                  disabled={isRunning}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="framework-select" className="text-sm font-medium">Framework:</label>
              <select
                id="framework-select"
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
                className="px-2 py-1 border rounded text-sm bg-background disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isRunning}
              >
                <option value="jest">Jest</option>
                <option value="mocha">Mocha</option>
              </select>
            </div>
          </div>
          <div className="flex-1 border rounded-md bg-black text-gray-200 font-mono text-sm min-h-[30vh] max-h-[35vh] overflow-x-auto">
            <ScrollArea className="flex-1 h-full">
              <div
                ref={outputRef}
                className="p-3 whitespace-pre-wrap break-words overflow-y-auto"
                style={{ maxWidth: "100%", width: "100%" }}
              >
                {output.length === 0 && !isRunning ? (
                  <div className="text-gray-500 italic">
                    Output will appear here. Run tests to see results.
                  </div>
                ) : (
                  output.map((item, index) => (
                    <div key={`snippet-output-${index}`} className="mb-2 last:mb-0 break-words">
                      {renderOutputContent(item, index)}
                    </div>
                  ))
                )}
                {isRunning && !activeProcessId && (
                  <div className="flex items-center text-blue-400 italic">
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Running...
                  </div>
                )}
                {activeProcessId && (
                  <div className="flex items-center text-blue-400 italic">
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Running (streaming)...
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
             <div className="flex items-center gap-2 w-full sm:w-auto">
               <Button
                 onClick={clearOutput}
                 variant="outline"
                 size="sm"
                 disabled={isRunning || output.length === 0}
                 className="w-full sm:w-auto"
               >
                 Clear
               </Button>
               <Button
                 onClick={copyOutput}
                 variant="outline"
                 size="sm"
                 disabled={isRunning || output.length === 0}
                 className="w-full sm:w-auto"
               >
                 <Copy className="h-3.5 w-3.5 mr-1" />
                 Copy
               </Button>
               {activeProcessId && (
                 <Button
                   onClick={stopRunningProcess}
                   variant="destructive"
                   size="sm"
                   className="w-full sm:w-auto"
                 >
                   <StopCircle className="h-3.5 w-3.5 mr-1" />
                   Stop
                 </Button>
               )}
             </div>

           </div>
           <Button
               onClick={runSnippetTests}
               disabled={isRunning || !code}
               size="sm"
               className={cn("w-full sm:w-auto", isRunning ? "opacity-70 cursor-not-allowed" : "")}
             >
               <Play className="mr-2" />
               Run Tests
             </Button>
        </TabsContent>
      </Tabs>

      {output.length > 0 && !output.some(item => item.type === 'loading') && (
        <div className="border-t p-2 flex items-center justify-between bg-muted/30">
          <Button variant="ghost" size="sm" onClick={askAboutTests} className="h-8 text-muted-foreground hover:text-foreground">
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            <span className="text-xs">Ask about results</span>
             <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}

function renderOutputContent(item: OutputItem, index: number) {
  // Helper function to format content with proper overflow handling
  const formatContent = (content: string | TestOutput): React.ReactElement => {
    if (typeof content !== 'string') {
      return <span className="break-words overflow-hidden" style={{ maxWidth: "100%", display: "inline-block" }}>{JSON.stringify(content)}</span>;
    }
    
    return (
      <div className="break-words overflow-hidden" style={{ maxWidth: "100%" }}>
        {content}
      </div>
    );
  };

  if (item.type === "command") {
    return <div className="text-blue-300 text-sm overflow-x-auto break-words">&gt; {formatContent(item.content)}</div>
  }

  if (item.type === "system") {
    return <div className="text-yellow-400 text-sm italic overflow-x-auto break-words">System: {formatContent(item.content)}</div>
  }

  if (item.type === "loading") {
    return null; // Loading indicator is handled outside the map
  }

  if (item.type === "stdout") {
    return <div className="text-green-300 text-sm overflow-x-auto break-words">stdout: {formatContent(item.content)}</div>
  }

  if (item.type === "stderr") {
    return <div className="text-red-300 text-sm overflow-x-auto break-words">stderr: {formatContent(item.content)}</div>
  }

  if (item.type === "error") {
    return <div className="text-red-400 text-sm font-bold overflow-x-auto break-words">Error: {formatContent(item.content)}</div>
  }

  if (item.type === "complete") {
    return <div className="text-blue-300 text-sm font-bold overflow-x-auto break-words">{formatContent(item.content)}</div>
  }

  const result = item.content as TestOutput
  return (
    <div className="space-y-2 border-t border-gray-700 pt-2 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2">
        <Badge variant={result.success ? "default" : "destructive"} className={result.success ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}>
           {result.success ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" /> Success
              </>
           ) : (
              <>
                 <XCircle className="h-3 w-3 mr-1" /> Failed
              </>
           )}
        </Badge>
        {result.exit_code !== undefined && (
          <Badge variant="outline" className="text-gray-400 border-gray-700">Exit code: {result.exit_code}</Badge>
        )}
      </div>
      {result.stdout && (
        <div>
          <div className="text-xs text-gray-400 mb-1">Standard Output:</div>
          <pre className="text-xs bg-gray-800 p-2 rounded overflow-x-auto text-gray-200 whitespace-pre-wrap break-words">{result.stdout}</pre>
        </div>
      )}
      {result.stderr && (
        <div>
          <div className="text-xs text-gray-400 mb-1">Standard Error:</div>
          <pre className="text-xs bg-gray-800 p-2 rounded overflow-x-auto text-red-400 whitespace-pre-wrap break-words">{result.stderr}</pre>
        </div>
      )}
      {result.error && (
        <div>
          <div className="text-xs text-gray-400 mb-1">Error:</div>
          <pre className="text-xs bg-gray-800 p-2 rounded overflow-x-auto text-red-400 whitespace-pre-wrap break-words">{result.error}</pre>
        </div>
      )}
    </div>
  )
}