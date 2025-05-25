"use client"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { API_ENDPOINT } from "@/config/constants"
import { Send, FileUp, Upload, Code, Mic, Square, X, Github } from "lucide-react"
import { OutputFormatToggle } from "./output-format-toggle"
import { useState, useRef, useEffect, useCallback } from "react"
import { useChat } from "@/context/chat-context"
import { MCP_OPTIONS } from "@/config/constants"
import type React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast-message"
import { CodeTemplates } from "./code-templates"
import { SUPPORTED_FILE_TYPES, isLikelyCode, detectCodeLanguage, formatCode, readFileAsText, detectLanguage } from "@/utils/file-utils"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { FileAttachment } from "./file-attachment"
import { ProjectModal } from "./project-modal"

export function ChatInput() {
  const [showTemplates, setShowTemplates] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [messageInput, setMessageInput] = useState("")
  const [charCount, setCharCount] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [processingFile, setProcessingFile] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const { toast } = useToast()

  const [fileAttachments, setFileAttachments] = useState<
    Array<{
      fileName: string
      fileSize: number
      content: string
      contentLength: number
      language: string
    }>
  >([])

  const [codeAttachments, setCodeAttachments] = useState<
    Array<{
      fileName: string
      content: string
      language: string
    }>
  >([])


  const {
    language,
    preferences,
    mcp,
    setMcp,
    setPreferences,
    isLoading,
    handleSubmit,
    handleCodeAction,
  } = useChat()

  const [showProjectModal, setShowProjectModal] = useState(false)
  const [projectStatus, setProjectStatus] = useState({ has_project: false, has_index: false })
  const cancelMessage = useCallback(() => {
    fetch(`${API_ENDPOINT}/cancel_message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to cancel message")
        }
        return response.json()
      })
      .then((data) => {
        console.log("Message cancelled successfully", data)
      })
      .catch((error) => {
        console.error("Failed to cancel message:", error)
        toast({
          title: "Cancellation Failed",
          description: "Could not cancel the message.",
          variant: "destructive",
        })
      })
  }, [toast])

  const processFiles = useCallback(
    async (files: File[]) => {
      const supportedFiles = files.filter((file) => {
        const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
        return SUPPORTED_FILE_TYPES.includes(extension)
      })

      if (supportedFiles.length === 0) {
        toast({
          title: "Unsupported File Type",
          description: "Please upload a text or code file.",
          variant: "destructive",
        })
        return
      }

      setProcessingFile(true)
      try {
        const newAttachments: Array<{
          fileName: string
          fileSize: number
          content: string
          contentLength: number
          language: string
        }> = []
        for (const file of supportedFiles) {
          try {
            const content = await readFileAsText(file)
            const fileLanguage = detectLanguage(file.name)
            const codeBlock = `File: ${file.name}\n\n\`\`\`${fileLanguage}\n${content}\n\`\`\``
            newAttachments.push({
              fileName: file.name,
              fileSize: file.size,
              content: codeBlock,
              contentLength: content.length,
              language: fileLanguage,
            })
          } catch (error) {
            console.error(`Error processing file ${file.name}:`, error)
            toast({
              title: `Error with file ${file.name}`,
              description: error instanceof Error ? error.message : "Failed to process file",
              variant: "destructive",
            })
          }
        }

        if (newAttachments.length > 0) {
          setFileAttachments((prev) => [...prev, ...newAttachments])
          toast({
            title: "Files Processed",
            description: `${newAttachments.length} file(s) attached to your message`,
            duration: 3000,
          })
        }
      } catch (error) {
        toast({
          title: "Error Processing Files",
          description: error instanceof Error ? error.message : "An unknown error occurred",
          variant: "destructive",
        })
      } finally {
        setProcessingFile(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    const fileContentLength = fileAttachments.reduce((total, file) => total + file.contentLength, 0)
    const codeContentLength = codeAttachments.reduce((total, code) => total + code.content.length, 0)
    setCharCount(messageInput.length + fileContentLength + codeContentLength)
  }, [messageInput, fileAttachments, codeAttachments])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [messageInput, fileAttachments, codeAttachments])

  useEffect(() => {
    const handleKeyboardShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        textareaRef.current?.focus()
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcut)
    return () => window.removeEventListener("keydown", handleKeyboardShortcut)
  }, [])

  useEffect(() => {
    const handleUseCode = (e: CustomEvent) => {
      if (e.detail && e.detail.code) {
        const code = e.detail.code
        const lang = e.detail.language || detectCodeLanguage(code) || "plaintext"
        const fileName = e.detail.fileName || `snippet.${lang}`
        setCodeAttachments((prev) => [
          ...prev,
          {
            fileName,
            content: code,
            language: lang,
          },
        ])
        if (textareaRef.current) {
          setTimeout(() => {
            textareaRef.current?.focus()
          }, 100)
        }
        toast({
          title: "Code Added",
          description: `File "${fileName}" attached to your message`,
          duration: 2000,
        })
      }
    }
    window.addEventListener("use-code", handleUseCode as EventListener)
    return () => window.removeEventListener("use-code", handleUseCode as EventListener)
  }, [toast])


  useEffect(() => {
    const fetchProjectStatus = async () => {
      try {
        const response = await fetch(`${API_ENDPOINT}/project_status/`)
        if (response.ok) {
          const data = await response.json()
          setProjectStatus(data)
        }
      } catch (error) {
        console.error("Failed to fetch project status:", error)
      }
    }

    fetchProjectStatus()
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (messageInput.trim() || fileAttachments.length > 0 || codeAttachments.length > 0) {
          submitMessage()
        }
      }
    },
    [messageInput, fileAttachments, codeAttachments],
  )

  const submitMessage = useCallback(() => {
    if (messageInput.trim() || fileAttachments.length > 0 || codeAttachments.length > 0) {
      const fileContent = fileAttachments.map((file) => file.content).join("\n\n")
      const codeContent = codeAttachments
        .map((code) => `File: ${code.fileName}\n\n\`\`\`${code.language}\n${code.content}\n\`\`\``)
        .join("\n\n")
      const fullMessage = [messageInput, fileContent, codeContent].filter(Boolean).join("\n\n")
      handleSubmit(fullMessage)
      setMessageInput("")
      setFileAttachments([])
      setCodeAttachments([])
      setShowTemplates(false)
    } else {
      toast({
        title: "Empty Message",
        description: "Please enter a message or attach a file before sending",
        variant: "destructive",
      })
    }
  }, [messageInput, fileAttachments, codeAttachments, handleSubmit, toast])

  const handleInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      const newValue = value.substring(messageInput.length)
      setMessageInput(value)
      if (newValue.length > 30 && isLikelyCode(newValue)) {
        let detectedLanguage = "plaintext"
        try {
          detectedLanguage = detectCodeLanguage(newValue) || "plaintext"
        } catch (err) {
          console.warn("Language detection failed, defaulting to plaintext", err)
        }

        let codeBlock = newValue; 
        try {
            if (preferences.inputPreference === "Autotag") {
                const formattedCode = await formatCode(newValue, detectedLanguage);
                codeBlock = "\n```" + detectedLanguage + "\n" + formattedCode + "\n```";
            } else {
                 codeBlock = "\n```" + detectedLanguage + "\n" + newValue + "\n```";
            }
            setMessageInput((prev) => prev.substring(0, prev.length - newValue.length) + codeBlock);
            toast({
                title: "Code Detected",
                description: `Formatted as ${detectedLanguage}`,
                duration: 3000,
            });
        } catch (err) {
            console.warn("Formatting failed, inserting raw code:", err);
            codeBlock = "\n```" + detectedLanguage + "\n" + newValue + "\n```";
            setMessageInput((prev) => prev.substring(0, prev.length - newValue.length) + codeBlock);
            toast({
                title: "Code Detected",
                description: `Added as ${detectedLanguage} (formatting skipped)`,
                variant: "warning",
                duration: 3000,
            });
        }
      }

      if (value.length > 8000 && charCount <= 8000) {
        toast({
          title: "Message is getting long",
          description: "Very long messages may be truncated or processed slowly.",
          variant: "destructive",
          duration: 5000,
        })
      }
    },
    [messageInput, charCount, toast, preferences.inputPreference],
  )


  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = e.clipboardData.getData("text")
      if (isLikelyCode(pastedText)) {
        e.preventDefault() 

        let detectedLanguage = "plaintext"
        try {
          detectedLanguage = detectCodeLanguage(pastedText) || "plaintext"
        } catch (err) {
          console.warn("Language detection failed on paste, defaulting to plaintext", err)
        }

        let codeBlock = pastedText;
        try {
            if (preferences.inputPreference === "Autotag") {
                const formattedCode = await formatCode(pastedText, detectedLanguage);
                codeBlock = "\n```" + detectedLanguage + "\n" + formattedCode + "\n```";
            } else {
                 codeBlock = "\n```" + detectedLanguage + "\n" + pastedText + "\n```";
            }

            const cursor = textareaRef.current?.selectionStart ?? messageInput.length;
            const before = messageInput.slice(0, cursor);
            const after = messageInput.slice(cursor);
            setMessageInput(before + codeBlock + after);

            toast({
                title: "Code Detected",
                description: `Formatted as ${detectedLanguage}`,
                duration: 3000,
            });
        } catch (err) {
            console.warn("Formatting failed on paste, inserting raw code:", err);
            codeBlock = "\n```" + detectedLanguage + "\n" + pastedText + "\n```";
            const cursor = textareaRef.current?.selectionStart ?? messageInput.length;
            const before = messageInput.slice(0, cursor);
            const after = messageInput.slice(cursor);
            setMessageInput(before + codeBlock + after);

            toast({
                title: "Code Detected",
                description: `Added as ${detectedLanguage} (formatting skipped)`,
                variant: "warning",
                duration: 3000,
            });
        }
      }
    },
    [messageInput, toast, preferences.inputPreference],
  )


  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        await processFiles(Array.from(e.dataTransfer.files))
      }
    },
    [processFiles],
  )

  const handleFileUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        await processFiles(Array.from(e.target.files))
        e.target.value = ""
      }
    },
    [processFiles],
  )

  const handleTemplateSelect = useCallback((templatePrompt: string) => {
    setMessageInput(templatePrompt)
    setShowTemplates(false)
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  const startRecording = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setRecordingError("Speech recognition is not supported in your browser")
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in your browser. Please type your message instead.",
        variant: "destructive",
      })
      return
    }
    setIsRecording(true)
    setRecordingError(null)
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"
    recognition.onresult = (event: any) => {
      let finalTranscript = ""
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        } else {
        }
      }
      if (finalTranscript) {
        setMessageInput((prev) => {
          const newValue = prev ? `${prev} ${finalTranscript}` : finalTranscript
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.selectionStart = textareaRef.current.value.length;
              textareaRef.current.selectionEnd = textareaRef.current.value.length;
            }
          }, 0);
          return newValue
        })
      }
    }
    recognition.onerror = (event: any) => {
      setRecordingError(`Error: ${event.error}`)
      setIsRecording(false)
      toast({
        title: "Recording Error",
        description: `Error: ${event.error}. Please try again or type your message.`,
        variant: "destructive",
      })
    }
    recognition.onend = () => {
      setIsRecording(false)
    }

    try {
      recognition.start()
      ;(window as any).speechRecognition = recognition
      toast({
        title: "Recording Started",
        description: "Speak now. Your speech will be converted to text.",
        duration: 3000,
      })
    } catch (error) {
      console.error("Failed to start recording:", error);
      setRecordingError("Failed to start recording")
      setIsRecording(false)
      toast({
        title: "Recording Failed",
        description: "Failed to start recording. Please try again or type your message.",
        variant: "destructive",
      })
    }
  }, [toast])

  const stopRecording = useCallback(() => {
    if ((window as any).speechRecognition) {
      try {
        (window as any).speechRecognition.stop()
        toast({
          title: "Recording Stopped",
          description: "Speech recording has been stopped.",
          duration: 2000,
        })
      } catch (error) {
        console.warn("Failed to stop recording:", error)
      } finally {
        ;(window as any).speechRecognition = null;
      }
    }
    setIsRecording(false)
  }, [toast])


  const applyCodeAction = useCallback(
    (action: string) => {
      if (messageInput.trim()) {
        handleCodeAction(action, messageInput, language)
        setMessageInput("")
      } else {
        toast({
          title: "No Code Provided",
          description: "Please enter or paste code first",
          variant: "destructive",
        })
      }
    },
    [messageInput, handleCodeAction, language, toast],
  )

  const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0
  const removeFileAttachment = useCallback((index: number) => {
    setFileAttachments((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const removeCodeAttachment = useCallback((index: number) => {
    setCodeAttachments((prev) => prev.filter((_, i) => i !== index))
  }, [])



  return (
    <TooltipProvider> 
      <div className="p-2 sm:p-4 border-t fixed bottom-0 left-0 right-0 bg-background md:relative ">
        <div className="flex flex-col gap-1 mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex flex-wrap items-center gap-1">
              <Select value={mcp} onValueChange={setMcp}>
                <SelectTrigger className="w-auto min-w-[3rem] h-8">
                  {(() => {
                    const selected = MCP_OPTIONS.find((opt) => opt.value === mcp)
                    return selected ? <selected.icon className={`w-4 h-4 mx-2 ${selected.color}`} /> : <SelectValue placeholder="✨ MCP ✨" />
                  })()}
                </SelectTrigger>
                <SelectContent>
                  {MCP_OPTIONS.map(({ value, label, icon: Icon, color }) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${color}`} />
                        <span>{label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs gap-1"
                    onClick={() => setShowTemplates(!showTemplates)}
                  >
                    <Code className="h-3.5 w-3.5 dark:text-blue-300 text-blue-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Browse code templates</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-red-500 dark:text-red-300 gap-1"
                    onClick={() => setShowProjectModal(true)}
                  >
                    <Github className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Manage project files</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-2">
              {charCount > 0 && (
                <Badge
                  variant={charCount > 50000 ? "destructive" : charCount > 25000 ? "secondary" : "outline"} 
                  className={cn(
                    "h-6 px-2 text-xs transition-colors hidden md:block",
                    charCount > 25000 && charCount <= 50000 && "bg-amber-500/20  text-amber-700 dark:text-amber-400 hover:bg-amber-500/20",
                  )}
                >
                  {charCount} / 100000
                </Badge>
              )}

              <OutputFormatToggle
                value={preferences.outputFormat}
                onChange={(value) => setPreferences({ ...preferences, outputFormat: value as typeof preferences.outputFormat })}
              />
            </div>
          </div>
          <div
            ref={dropZoneRef}
            className={cn(
              "relative flex flex-col gap-2",
              isDragging && "ring-2 ring-primary rounded-md",
              isRecording && "ring-2 ring-red-500 rounded-md",
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <AnimatePresence>
              {isDragging && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-md z-10"
                >
                  <div className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-primary rounded-md">
                    <FileUp className="h-8 w-8 text-primary" />
                    <p className="text-sm font-medium">Drop your file here</p>
                    <p className="text-xs text-muted-foreground text-center">
                      Supported file types: code, text, and configuration files
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {processingFile && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-md z-10"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 border-2 border-t-transparent border-primary rounded-full animate-spin" />
                    <p className="text-sm font-medium">Processing file...</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {isRecording && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute right-14 top-2 z-10 flex items-center gap-2 bg-red-500/10 px-3 py-1 rounded-full"
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.5 }}
                    className="h-2 w-2 rounded-full bg-red-500"
                  />
                  <span className="text-xs font-medium text-red-500">Recording...</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full" onClick={stopRecording}>
                    <X className="h-3 w-3" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileInputChange}
              multiple
              accept={SUPPORTED_FILE_TYPES.join(",")}
            />
            {(fileAttachments.length > 0 || codeAttachments.length > 0) && (
              <div className="flex flex-wrap gap-2 p-2 bg-muted/30 rounded-md">
                {fileAttachments.map((file, index) => (
                  <FileAttachment
                    key={`file-${file.fileName}-${index}`}
                    fileName={file.fileName}
                    fileSize={file.fileSize}
                    contentLength={file.contentLength}
                    language={file.language}
                    onRemove={() => removeFileAttachment(index)}
                  />
                ))}

                {codeAttachments.map((code, index) => (
                  <FileAttachment
                    key={`code-${code.fileName}-${index}`}
                    fileName={code.fileName}
                    fileSize={code.content.length}
                    contentLength={code.content.length}
                    language={code.language}
                    onRemove={() => removeCodeAttachment(index)}
                  />
                ))}
              </div>
            )}
            <div className="flex gap-2 items-end"> 
               <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-[44px] w-10 flex-shrink-0 relative"
                    onClick={handleFileUploadClick}
                    disabled={isLoading || processingFile || isRecording}
                  >
                    <Upload className="h-4 w-4" />
                    {(fileAttachments.length > 0 || codeAttachments.length > 0) && (
                      <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-primary text-primary-foreground text-xs rounded-full"> {/* Made badge round */}
                        {fileAttachments.length + codeAttachments.length}
                      </Badge>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Upload code or text file</p>
                </TooltipContent>
              </Tooltip>
              <Textarea
                ref={textareaRef}
                placeholder={`How can I help you to code today`}
                className="min-h-[22px] max-h-[44px] md:min-h-[44px] md:max-h-[200px] flex-1 resize-none overflow-y-auto" 
                value={messageInput}
                onChange={handleInputChange}
                autoFocus={true}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                aria-label="Message input"
                disabled={isRecording}
              />
              <div className="flex gap-1 flex-shrink-0"> 
                 <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={cn(
                        "h-[44px] w-10",
                        isRecording && "bg-red-500 text-white hover:bg-red-600",
                      )}
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isLoading || processingFile}
                    >
                      {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{isRecording ? "Stop recording" : "Voice input"}</p>
                  </TooltipContent>
                </Tooltip>
                 <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      onClick={isLoading ? cancelMessage : submitMessage}
                      className="px-4 h-[44px]"
                      disabled={
                        (!isLoading &&
                          !messageInput.trim() &&
                          fileAttachments.length === 0 &&
                          codeAttachments.length === 0) ||
                        isRecording
                      }
                    >
                      {isLoading ? <Square className="h-5 w-5 text-white" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Send message ({isMac ? "⌘" : "Ctrl"}+Enter)</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
          <AnimatePresence>
            {showTemplates && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-2 overflow-hidden"
              >
                <CodeTemplates onSelectTemplate={handleTemplateSelect} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <ProjectModal
          isOpen={showProjectModal}
          onClose={() => setShowProjectModal(false)}
          projectStatus={projectStatus}
        />
      </div>
    </TooltipProvider>
  )
}