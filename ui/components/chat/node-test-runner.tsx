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
    if (resizingRef.current) return;
    resizingRef.current = true;
    
    // Add a class to prevent transitions during resize
    document.body.classList.add('resizing');
    
    window.dispatchEvent(
      new CustomEvent("node-test-runner-state", {
        detail: { isOpen: false, width: 0, instanceId: instanceId.current },
      }),
    );
    
    window.dispatchEvent(new CustomEvent("sidebar-resize"));
    
    onClose();
    
    const resizeSequence = () => {
      window.dispatchEvent(new CustomEvent("sidebar-resize"));
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("sidebar-resize"));
        
        // Force a layout reflow
        document.body.classList.add('sidebar-resize-complete');
        setTimeout(() => {
          document.body.classList.remove('sidebar-resize-complete');
          document.body.classList.remove('resizing');
          resizingRef.current = false;
        }, 50);
      }, 150);
    };
    
    setTimeout(resizeSequence, 100);
  }, [onClose, instanceId]);

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
      return;
    } else {
      if (resizingRef.current) return;
      
      resizingRef.current = true;
      
      const closeOtherComponents = async () => {
        window.dispatchEvent(
          new CustomEvent("code-editor-close", {
            detail: { forced: true },
          }),
        );
        
        window.dispatchEvent(
          new CustomEvent("python-shell-close", {
            detail: { forced: true },
          })
        );
        
        window.dispatchEvent(
          new CustomEvent("html-preview-close", {
            detail: { forced: true },
          })
        );
        
        // Add a small delay for other components to close
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Now update our state with appropriate width
        window.dispatchEvent(
          new CustomEvent("node-test-runner-state", {
            detail: { 
              isOpen: true, 
              width: isMaximized ? 9999 : 400,
              instanceId: instanceId.current,
              isFullscreen: isMaximized
            },
          }),
        );
        
        // Notify layout system
        window.dispatchEvent(new CustomEvent("sidebar-resize"));
        
        // Reset resizing flag after a delay
        setTimeout(() => {
          resizingRef.current = false;
        }, 200);
      };
      
      closeOtherComponents();
    }

    const handleForcedClose = (event: CustomEvent) => {
      if (event.detail?.forced && !resizingRef.current) {
        onClose();
      }
    }

    const handleNewRunner = (event: CustomEvent) => {
      if (event.detail?.isOpen && event.detail?.instanceId !== instanceId.current) {
        onClose();
      }
    }

    window.addEventListener("node-test-runner-close", handleForcedClose as EventListener);
    window.addEventListener("node-test-runner-state", handleNewRunner as EventListener);

    return () => {
      window.removeEventListener("node-test-runner-close", handleForcedClose as EventListener);
      window.removeEventListener("node-test-runner-state", handleNewRunner as EventListener);
      
      resizingRef.current = false;
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
        resizeTimeoutRef.current = null;
      }
    }
  }, [isOpen, isMaximized, onClose]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])


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
       
       if (endpoint === "/run_node_app" && result.process_id) {
         setActiveProcessId(result.process_id)
         setupEventSource(result.process_id)
         setOutput(prev => [...prev, { 
           type: "system", 
           content: `Started process ${result.process_id}. Streaming output...` 
         }])
       } else {
         setOutput(prev => {
           const maxOutputItems = 500;
           const newOutput = [...prev, { type: "result" as const, content: result }];
           
           if (newOutput.length > maxOutputItems) {
             return newOutput.slice(newOutput.length - maxOutputItems);
           }
           
           return newOutput;
         });
         setIsRunning(false)
       }
     } catch (error) {
       console.error(`Error running ${operationType}:`, error)
       setOutput(prev => {
         const maxOutputItems = 500;
         const filteredOutput = prev.filter(item => item.type !== "loading");
         const newOutput = [
           ...filteredOutput,
           {
             type: "system" as const,
             content: `Operation failed: ${error instanceof Error ? error.message : String(error)}`
           }
         ];
         
         if (newOutput.length > maxOutputItems) {
           return newOutput.slice(newOutput.length - maxOutputItems);
         }
         
         return newOutput;
       });
       setIsRunning(false)
     }
  }

  const setupEventSource = (processId: string) => {
    if (eventSource) {
      try {
        eventSource.close();
      } catch (error) {
        console.error("Error closing existing event source:", error);
      }
    }

    try {
      const newEventSource = new EventSource(`${API_ENDPOINT}/node_app_output/${processId}`);
      
      const eventTypes = ["stdout", "stderr", "error", "system", "command", "complete", "heartbeat"];
      
      eventTypes.forEach(eventType => {
        newEventSource.addEventListener(eventType, (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (eventType === "heartbeat") {
              return;
            }
            
            if (eventType === "complete") {
              setOutput(prev => [...prev, { type: "system", content: data.content }]);
              try {
                newEventSource.close();
              } catch (error) {
                console.error("Error closing event source on complete:", error);
              }
              setEventSource(null);
              setActiveProcessId(null);
              setIsRunning(false);
              return;
            }
            
            setOutput(prev => {
              const maxOutputItems = 500;
              const newOutput = [...prev, { 
                type: eventType as "stdout" | "stderr" | "error" | "system" | "command" | "heartbeat" | "complete", 
                content: data.content 
              }];
              
              if (newOutput.length > maxOutputItems) {
                return [...newOutput.slice(newOutput.length - maxOutputItems)];
              }
              
              return newOutput;
            });
            
            setTimeout(() => {
              if (outputRef.current) {
                outputRef.current.scrollTop = outputRef.current.scrollHeight;
              }
            }, 10);
          } catch (error) {
            console.error(`Error parsing ${eventType} event data:`, error);
          }
        });
      });
      
      newEventSource.onerror = (error) => {
        setOutput(prev => [...prev, { 
          type: "error", 
          content: "Connection error. Output streaming stopped." 
        }]);
        try {
          newEventSource.close();
        } catch (innerError) {
          console.error("Error closing event source on error:", innerError);
        }
        setEventSource(null);
        setActiveProcessId(null);
        setIsRunning(false);
      };
      
      setEventSource(newEventSource);
    } catch (error) {
      console.error("Error setting up event source:", error);
      setOutput(prev => [...prev, { 
        type: "error", 
        content: `Error setting up connection: ${error instanceof Error ? error.message : String(error)}` 
      }]);
      setIsRunning(false);
    }
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

  useEffect(() => {
    return () => {
      // This cleanup runs when component unmounts
      resizingRef.current = false;
      
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
        resizeTimeoutRef.current = null;
      }
      
      // Remove any classes we might have added
      document.body.classList.remove('resizing');
      document.body.classList.remove('sidebar-resize-complete');
      document.body.classList.remove('node-runner-fullscreen');
      document.documentElement.style.removeProperty('--node-runner-fullscreen');
      
      // Close event source
      if (eventSource) {
        try {
          eventSource.close();
        } catch (error) {
          console.error("Error closing event source on unmount:", error);
        }
        setEventSource(null);
      }
      
      if (activeProcessId) {
        try {
          fetch(`${API_ENDPOINT}/terminate_node_app`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              process_id: activeProcessId
            })
          }).catch(error => {
            console.error("Error terminating process on unmount:", error);
          });
        } catch (error) {
          console.error("Error sending termination request:", error);
        }
        
        setActiveProcessId(null);
      }
      
      window.dispatchEvent(
        new CustomEvent("node-test-runner-state", {
          detail: { isOpen: false, width: 0, instanceId: instanceId.current },
        }),
      );
      
      window.dispatchEvent(new CustomEvent("sidebar-resize"));
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("sidebar-resize"));
      }, 200);
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("sidebar-resize"));
      }, 400);
    }
  }, [eventSource, activeProcessId, instanceId]);

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
        if (lastOutputItem) query += "\n---\n";
        query += `System Message:\n\`\`\`\n${lastErrorItem.content}\n\`\`\`\n`;
    }

    query += "\nCan you help me understand this result and suggest potential fixes or next steps?";

    handleSubmit(query)
    handleClose()
  }

  const handleMaximizeToggle = () => {
    if (resizingRef.current) return;
    resizingRef.current = true;
    
    // Add a class to prevent transitions during resize
    document.body.classList.add('resizing');
    
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    
    const newMaximizedState = !isMaximized;
    setIsMaximized(newMaximizedState);
    
    const newWidth = newMaximizedState ? 9999 : 400;
    
    resizeTimeoutRef.current = setTimeout(() => {
      try {
        if (newMaximizedState) {
          document.body.classList.add('node-runner-fullscreen');
          document.documentElement.style.setProperty('--node-runner-fullscreen', 'true');
        } else {
          document.body.classList.remove('node-runner-fullscreen');
          document.documentElement.style.removeProperty('--node-runner-fullscreen');
        }
        
        window.dispatchEvent(
          new CustomEvent("node-test-runner-state", {
            detail: { 
              isOpen: true, 
              width: newWidth, 
              instanceId: instanceId.current,
              isFullscreen: newMaximizedState
            },
          }),
        );
        
        window.dispatchEvent(new CustomEvent("sidebar-resize"));
        
        // Dispatch a second resize event after a delay to ensure layout is updated
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("sidebar-resize"));
          
          // Force a layout reflow
          document.body.classList.add('sidebar-resize-complete');
          setTimeout(() => {
            document.body.classList.remove('sidebar-resize-complete');
            document.body.classList.remove('resizing');
          }, 50);
        }, 200);
      } catch (error) {
        console.error("Error during maximize toggle:", error);
      } finally {
        setTimeout(() => {
          resizingRef.current = false;
        }, 300);
      }
    }, 100);
  };

  // Add a window resize handler back for proper dimensions
  useEffect(() => {
    const handleWindowResize = () => {
      if (!isOpen || resizingRef.current) return;
      
      if (isMaximized) {
        // For fullscreen mode, we need to update on window resize
        window.dispatchEvent(
          new CustomEvent("node-test-runner-state", {
            detail: { 
              isOpen: true, 
              width: 9999, 
              instanceId: instanceId.current,
              isFullscreen: true
            },
          }),
        );
        
        // Ensure the layout updates
        window.dispatchEvent(new CustomEvent("sidebar-resize"));
      }
    };
    
    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [isOpen, isMaximized, instanceId]);

  if (!isOpen) return null

  return (
    <div
      className={cn(
        "fixed bg-background border z-[100] rounded-lg shadow-xl flex flex-col text-foreground",
        isMaximized
          ? "inset-0 m-0 rounded-none border-0"
          : "top-0 right-0 w-full md:w-[400px] h-full"
      )}
      style={{
        position: "fixed",
        zIndex: isMaximized ? 1000 : 100,
        height: isMaximized ? '100vh' : undefined,
        width: isMaximized ? '100vw' : undefined,
        minHeight: isMaximized ? '100vh' : undefined,
        transition: 'width 0.2s ease, height 0.2s ease, min-height 0.2s ease'
      }}
    >
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <h3 className="text-sm font-medium flex items-center">
          <Package className="h-4 w-4 mr-2 text-primary" />
          Node.js Runner {isMaximized ? "(Fullscreen Mode)" : ""}
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
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-muted-foreground hover:text-foreground" 
            onClick={(e) => {
              e.stopPropagation();
              if (!resizingRef.current) {
                handleClose();
              }
            }} 
            title="Close"
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs 
        value={testMode} 
        className="flex-1 flex flex-col" 
        onValueChange={(value) => setTestMode(value as "app" | "snippet")}
      >
        <div className={cn(
          "px-3 py-2 border-b bg-background",
          isMaximized && "sticky top-0 z-10"
        )}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="app">
              Application Tests
            </TabsTrigger>
            <TabsTrigger value="snippet">
              Code Snippet Tests
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent 
          value="app" 
          className={cn(
            "flex-1 flex flex-col p-4 space-y-4 overflow-hidden data-[state=inactive]:hidden",
            isMaximized && "max-w-6xl mx-auto w-full"
          )}
        >
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
          <div className={cn(
            "flex-1 border rounded-md bg-black text-gray-200 font-mono text-sm overflow-x-auto",
            isMaximized ? "min-h-[40vh] max-h-[50vh]" : "min-h-[30vh] max-h-[50vh]"
          )}>
            <ScrollArea className="flex-1 h-full">
               <div
                 ref={outputRef}
                 className="p-3 whitespace-pre-wrap break-words overflow-x-hidden"
                 style={{ 
                   maxWidth: "100%", 
                   width: "100%",
                   minHeight: isMaximized ? "40vh" : "30vh",
                   position: "relative"
                 }}
               >
                 {output.length === 0 && !isRunning ? (
                   <div className="text-gray-500 italic">
                     Output will appear here. Run tests or application.
                   </div>
                 ) : (
                   <div className="output-container" style={{ maxWidth: "100%" }}>
                     {output.map((item, index) => (
                       <div key={`app-output-${index}`} className="mb-2 last:mb-0 break-words">
                         {renderOutputContent(item, index)}
                       </div>
                     ))}
                   </div>
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

        <TabsContent 
          value="snippet" 
          className={cn(
            "flex-1 flex flex-col p-4 space-y-4 overflow-hidden data-[state=inactive]:hidden",
            isMaximized && "max-w-6xl mx-auto w-full"
          )}
        >
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
          <div className={cn(
            "flex-1 border rounded-md bg-black text-gray-200 font-mono text-sm overflow-x-auto",
            isMaximized ? "min-h-[30vh] max-h-[40vh]" : "min-h-[40vh] max-h-[80vh]"
          )}>
            <ScrollArea className="flex-1 h-full">
              <div
                ref={outputRef}
                className="p-3 whitespace-pre-wrap break-words overflow-x-hidden"
                style={{ 
                  maxWidth: "100%", 
                  width: "100%",
                  minHeight: isMaximized ? "30vh" : "40vh"
                }}
              >
                {output.length === 0 && !isRunning ? (
                  <div className="text-gray-500 italic">
                    Output will appear here. Run tests to see results.
                  </div>
                ) : (
                  <div className="output-container" style={{ maxWidth: "100%" }}>
                    {output.map((item, index) => (
                      <div key={`snippet-output-${index}`} className="mb-2 last:mb-0 break-words">
                        {renderOutputContent(item, index)}
                      </div>
                    ))}
                  </div>
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
  const formatContent = (content: string | TestOutput): React.ReactElement => {
    if (typeof content !== 'string') {
      return (
        <span className="break-words overflow-hidden overflow-ellipsis" style={{ 
          maxWidth: "100%", 
          display: "inline-block",
          whiteSpace: "pre-wrap"
        }}>
          {JSON.stringify(content, null, 2)}
        </span>
      );
    }
    
    return (
      <div className="break-words overflow-hidden overflow-ellipsis" style={{ 
        maxWidth: "100%",
        whiteSpace: "pre-wrap"
      }}>
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
    return null;
  }

  if (item.type === "stdout") {
    return <div className="text-green-300 text-sm overflow-x-auto break-words max-w-full">stdout: {formatContent(item.content)}</div>
  }

  if (item.type === "stderr") {
    return <div className="text-red-300 text-sm overflow-x-auto break-words max-w-full">stderr: {formatContent(item.content)}</div>
  }

  if (item.type === "error") {
    return <div className="text-red-400 text-sm font-bold overflow-x-auto break-words max-w-full">Error: {formatContent(item.content)}</div>
  }

  if (item.type === "complete") {
    return <div className="text-blue-300 text-sm font-bold overflow-x-auto break-words max-w-full">{formatContent(item.content)}</div>
  }

  const result = item.content as TestOutput
  return (
    <div className="space-y-2 border-t border-gray-700 pt-2 first:border-t-0 first:pt-0 max-w-full">
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
          <pre className="text-xs bg-gray-800 p-2 rounded overflow-x-auto text-gray-200 whitespace-pre-wrap break-words max-w-full">{result.stdout}</pre>
        </div>
      )}
      {result.stderr && (
        <div>
          <div className="text-xs text-gray-400 mb-1">Standard Error:</div>
          <pre className="text-xs bg-gray-800 p-2 rounded overflow-x-auto text-red-400 whitespace-pre-wrap break-words max-w-full">{result.stderr}</pre>
        </div>
      )}
      {result.error && (
        <div>
          <div className="text-xs text-gray-400 mb-1">Error:</div>
          <pre className="text-xs bg-gray-800 p-2 rounded overflow-x-auto text-red-400 whitespace-pre-wrap break-words max-w-full">{result.error}</pre>
        </div>
      )}
    </div>
  )
}