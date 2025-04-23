"use client"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { API_ENDPOINT } from "@/config/constants"
import {
  Lightbulb,
  Send,
  Sparkles,
  FileUp,
  Upload,
  Code,
  Zap,
  Bug,
  RefreshCw,
  Braces,
  FileCode,
  Wand2,
  Mic,
  Square,
  X,
  AlertTriangle,
  Shield,
} from "lucide-react"
import { OutputFormatToggle } from "./output-format-toggle"
import { useState, useRef, useEffect, useCallback } from "react"
import { useChat } from "@/context/chat-context"
import { LANGUAGE_OPTIONS, QUICK_START_TEMPLATES } from "@/config/constants"
import type React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast-message"
import { CodeTemplates } from "./code-templates"
import {
  SUPPORTED_FILE_TYPES,
  isLikelyCode,
  detectCodeLanguage,
  formatCode,
  readFileAsText,
  detectLanguage,
} from "@/utils/file-utils"
import { processSensitiveCode } from "@/utils/security-utils"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { FileAttachment } from "./file-attachment"
import { Alert, AlertDescription } from "@/components/ui/alert"
export function ChatInput() {
  const [showTemplates, setShowTemplates] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [messageInput, setMessageInput] = useState("")
  const [charCount, setCharCount] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [processingFile, setProcessingFile] = useState(false)
  const [showPromptButtons, setShowPromptButtons] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [securityWarning, setSecurityWarning] = useState<string | null>(null)
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

  // Update the file to handle code attachments as file indicators
  // First, add a new state for code attachments
  const [codeAttachments, setCodeAttachments] = useState<
    Array<{
      fileName: string
      content: string
      language: string
    }>
  >([])

  const {
    language,
    setLanguage,
    preferences,
    setPreferences,
    isLoading,
    handleSubmit,
    handleCodeAction,
    handleInputChange: handleChatContextInputChange,
  } = useChat()

  const cancelMessage = useCallback(() => {
    //I need to make an api call  post to /cancel_message
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
        const newAttachments = []

        for (const file of supportedFiles) {
          try {
            // Read the file content
            const content = await readFileAsText(file)
            const fileLanguage = detectLanguage(file.name)

            if (fileLanguage && fileLanguage !== "plaintext") {
              setLanguage(fileLanguage)
            }

            // Check for sensitive information
            const { code: processedContent, containedSensitiveInfo } = processSensitiveCode(content)

            if (containedSensitiveInfo) {
              setSecurityWarning("You may have pasted sensitive information. Be careful!")
            }

            const codeBlock = `File: ${file.name}\n\n\`\`\`${fileLanguage}\n${processedContent}\n\`\`\``

            // Add to attachments
            newAttachments.push({
              fileName: file.name,
              fileSize: file.size,
              content: codeBlock,
              contentLength: processedContent.length,
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
    [toast, setLanguage],
  )

  // Update character count when input changes
  useEffect(() => {
    const fileContentLength = fileAttachments.reduce((total, file) => total + file.contentLength, 0)
    setCharCount(messageInput.length + fileContentLength)
  }, [messageInput, fileAttachments])

  

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [messageInput])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyboardShortcut = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to focus the textarea
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        textareaRef.current?.focus()
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcut)
    return () => window.removeEventListener("keydown", handleKeyboardShortcut)
  }, [])

  // Listen for code usage events
  // Then, update the useEffect for the "use-code" event
  useEffect(() => {
    const handleUseCode = (e: CustomEvent) => {
      if (e.detail && e.detail.code) {
        const code = e.detail.code
        const lang = e.detail.language || detectCodeLanguage(code) || "plaintext"
        const fileName = e.detail.fileName || `snippet.${lang}`

        // Auto-select the language in the dropdown
        if (lang && lang !== "plaintext") {
          setLanguage(lang)
        }

        // Check for sensitive information
        const { code: processedCode, containedSensitiveInfo } = processSensitiveCode(code)

        if (containedSensitiveInfo) {
          setSecurityWarning("Did you paste sensitive information? Be careful!")
        }

        // Instead of adding to the input, add to codeAttachments
        setCodeAttachments((prev) => [
          ...prev,
          {
            fileName,
            content: processedCode,
            language: lang,
          },
        ])

        // Focus the textarea
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
  }, [toast, setLanguage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (messageInput.trim() || fileAttachments.length > 0) {
          submitMessage()
        }
      }
    },
    [messageInput, fileAttachments],
  )

  // Update the submitMessage function to include code attachments
  const submitMessage = useCallback(() => {
    if (messageInput.trim() || fileAttachments.length > 0 || codeAttachments.length > 0) {
      // Combine message input with file attachments and code attachments
      const fileContent = fileAttachments.map((file) => file.content).join("\n\n")
      const codeContent = codeAttachments
        .map((code) => `File: ${code.fileName}\n\n\`\`\`${code.language}\n${code.content}\n\`\`\``)
        .join("\n\n")

      const fullMessage = [messageInput, fileContent, codeContent].filter(Boolean).join("\n\n")
      
      handleSubmit(fullMessage)
      setMessageInput("")
      setFileAttachments([])
      setCodeAttachments([])
      setSecurityWarning(null)
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

      // Check for sensitive information
      const { code: processedValue, containedSensitiveInfo } = processSensitiveCode(value)

      if (containedSensitiveInfo) {
        setSecurityWarning("Seems like you pasted sensitive information. Be careful!")
        setMessageInput(processedValue)
        return
      }

      // only try to format if user has just pasted/typed a chunk of code
      if (value.length > messageInput.length + 30) {
        const newContent = value.substring(messageInput.length)

        if (isLikelyCode(newContent)) {
          let detectedLanguage = "plaintext"
          try {
            detectedLanguage = detectCodeLanguage(newContent) || "plaintext"
          } catch (err) {
            console.warn("Language detection failed, defaulting to plaintext", err)
          }

          try {
            const formattedCode = await formatCode(newContent, detectedLanguage)
            const codeBlock = "\n" + "```" + detectedLanguage + "\n" + formattedCode + "\n```"

            setMessageInput((prev) => prev + codeBlock)

            toast({
              title: "Code Detected",
              description: `Formatted as ${detectedLanguage}`,
              duration: 3000,
            })
          } catch (err) {
            // Fallback to unformatted code if formatting fails
            console.warn("Formatting failed, inserting raw code:", err)
            const codeBlock = ["```" + detectedLanguage, newContent, "```"].join("\n")
            setMessageInput((prev) => prev + codeBlock)
            toast({
              title: "Code Detected",
              description: `Added as ${detectedLanguage} (formatting skipped)`,
              variant: "warning",
              duration: 3000,
            })
          }

          return
        }
      }

      setMessageInput(value)

      if (value.length > 8000 && charCount <= 8000) {
        toast({
          title: "Message is getting long",
          description: "Very long messages may be truncated or processed slowly.",
          variant: "destructive",
          duration: 5000,
        })
      }
    },
    [messageInput, charCount, toast, setLanguage],
  )

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = e.clipboardData.getData("text")

      // Check for sensitive information
      const { code: processedText, containedSensitiveInfo } = processSensitiveCode(pastedText)

      if (containedSensitiveInfo) {
        setSecurityWarning("Probably pasted sensitive information. Be careful! Could be a false positive.")
      }

      if (isLikelyCode(processedText)) {
        e.preventDefault()

        // 1) Detect language with better error handling
        let detectedLanguage = "plaintext"
        try {
          detectedLanguage = detectCodeLanguage(processedText) || "plaintext"
        } catch (err) {
          console.warn("Language detection failed on paste, defaulting to plaintext", err)
          // Continue with plaintext as fallback
        }

        // 2) Format with graceful fallback
        try {
          const formattedCode = await formatCode(processedText, detectedLanguage)
          const codeBlock = "\n" + "```" + detectedLanguage + "\n" + formattedCode + "\n```"
          const cursor = textareaRef.current?.selectionStart ?? 0
          const before = messageInput.slice(0, cursor)
          const after = messageInput.slice(cursor)
          setMessageInput(before + codeBlock + after)

          toast({
            title: "Code Formatted",
            description: `Detected ${detectedLanguage} and formatted it`,
            duration: 3000,
          })
        } catch (err) {
          // Fallback to unformatted code if formatting fails
          console.warn("Formatting failed on paste, inserting raw code:", err)
          const codeBlock = ["```" + detectedLanguage, processedText, "```"].join("\n")

          const cursor = textareaRef.current?.selectionStart ?? 0
          const before = messageInput.slice(0, cursor)
          const after = messageInput.slice(cursor)
          setMessageInput(before + codeBlock + after)

          toast({
            title: "Code Detected",
            description: "Inserted code without formatting",
            variant: "warning",
            duration: 3000,
          })
        }
      }
    },
    [messageInput, toast, setLanguage],
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

  const applyQuickStartTemplate = useCallback((templateId: string) => {
    const template = QUICK_START_TEMPLATES.find((t) => t.id === templateId)
    if (template) {
      setMessageInput(template.prompt)
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }
  }, [])

  const handleTemplateSelect = useCallback((templatePrompt: string) => {
    setMessageInput(templatePrompt)
    setShowTemplates(false)
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  // Speech recognition with better browser compatibility
  const startRecording = useCallback(() => {
    // Check if browser supports the Web Speech API
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      // Fallback to a simple message if speech recognition is not supported
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

    // Create speech recognition instance with browser compatibility
    // @ts-ignore - SpeechRecognition is not in the TypeScript types
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onresult = (event: any) => {
      let finalTranscript = ""
      let interimTranscript = ""

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        } else {
          interimTranscript += event.results[i][0].transcript
        }
      }

      // Update the input with the final transcript
      if (finalTranscript) {
        setMessageInput((prev) => {
          const newValue = prev ? `${prev} ${finalTranscript}` : finalTranscript
          return newValue
        })
      }
    }

    recognition.onerror = (event: any) => {
      //console.error("Speech recognition error", event)
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

      // Store recognition instance to stop it later
      // @ts-ignore
      window.speechRecognition = recognition

      toast({
        title: "Recording Started",
        description: "Speak now. Your speech will be converted to text.",
        duration: 3000,
      })
    } catch (error) {
      //console.error("Speech recognition start error:", error)
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
    // @ts-ignore
    if (window.speechRecognition) {
      try {
        // @ts-ignore
        window.speechRecognition.stop()
        toast({
          title: "Recording Stopped",
          description: "Speech recording has been stopped.",
          duration: 2000,
        })
      } catch (error) {
        //console.error("Error stopping speech recognition:", error)
      }
    }
    setIsRecording(false)
  }, [toast])

  const quickActionButtons = [
    { icon: <Code className="h-4 w-4" />, text: "Explain Code", action: "explain-code" },
    { icon: <Bug className="h-4 w-4" />, text: "Debug Code", action: "debug-code" },
    { icon: <Zap className="h-4 w-4" />, text: "Optimize Code", action: "optimize-code" },
    { icon: <RefreshCw className="h-4 w-4" />, text: "Refactor Code", action: "refactor-code" },
    { icon: <Braces className="h-4 w-4" />, text: "Format Code", action: "format-code" },
    { icon: <FileCode className="h-4 w-4" />, text: "Add Comments", action: "add-comments" },
    { icon: <Wand2 className="h-4 w-4" />, text: "Generate Tests", action: "generate-tests" },
    { icon: <Shield className="h-4 w-4" />, text: "Run SAST", action: "run-sast" },
  ]

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

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0

  const removeFileAttachment = useCallback((index: number) => {
    setFileAttachments((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const removeCodeAttachment = useCallback((index: number) => {
    setCodeAttachments((prev) => prev.filter((_, i) => i !== index))
  }, [])

  return (
    <div className="p-2 sm:p-4 border-t">
      <div className="flex flex-col gap-2 mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-[120px] sm:w-[140px] h-8">
                <SelectValue placeholder="Select Language" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs gap-1"
                    onClick={() => setShowTemplates(!showTemplates)}
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Saved Snippets</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Browse code templates</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

          </div>

          <div className="flex items-center gap-2">
            {charCount > 0 && (
              <Badge
                variant={charCount > 15000 ? "destructive" : "outline"}
                className={cn(
                  "h-6 text-xs transition-colors",
                  charCount > 5000 &&
                    charCount <= 8000 &&
                    "bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20",
                )}
              >
                {charCount} / 100000
              </Badge>
            )}

            <OutputFormatToggle
              value={preferences.outputFormat}
              onChange={(value) => setPreferences({ ...preferences, outputFormat: value })}
            />
          </div>
        </div>


        {securityWarning && (
          <Alert variant="destructive" className="mb-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{securityWarning}</AlertDescription>
          </Alert>
        )}

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
          {/* Drag and drop overlay */}
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
                  <p className="text-xs text-muted-foreground">
                    Supported file types: code, text, and configuration files
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Processing overlay */}
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

          {/* Recording indicator */}
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

          {/* File attachments section */}
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

          <div className="flex gap-2">
            {/* Upload button */}
            <TooltipProvider>
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
                      <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-primary text-primary-foreground text-xs">
                        {fileAttachments.length + codeAttachments.length}
                      </Badge>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Upload code or text file</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Textarea
              ref={textareaRef}
              placeholder={`Ask a coding question or paste code here... Press ${isMac ? "⌘" : "Ctrl"}+Enter to send`}
              className="min-h-[44px] max-h-32 flex-1 resize-none"
              value={messageInput}
              onChange={handleInputChange}
              autoFocus={true}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              aria-label="Message input"
              disabled={isRecording}
            />

            <div className="flex gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={cn(
                        "h-[44px] w-10 flex-shrink-0",
                        isRecording && "bg-red-500 text-white hover:bg-red-600",
                      )}
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isLoading || processingFile}
                    >
                      {isRecording ? <X className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{isRecording ? "Stop recording" : "Voice input"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      onClick={isLoading ? cancelMessage : submitMessage}
                      className="px-4 h-[44px] flex-shrink-0"
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
              </TooltipProvider>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-1">
            <FileUp className="h-3 w-3" />
            Drag & drop files or paste code for automatic formatting
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setShowPromptButtons(!showPromptButtons)}
          >
            {showPromptButtons ? "Hide Prompts" : "Show Prompts"}
          </Button>
        </div>

        <AnimatePresence>
          {showPromptButtons && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {quickActionButtons.map((button, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="flex items-center justify-start gap-2 h-auto py-2 transition-all hover:bg-primary hover:text-primary-foreground"
                    onClick={() => applyCodeAction(button.action)}
                  >
                    <div className="bg-primary/10 p-1.5 rounded-md">{button.icon}</div>
                    <span className="truncate">{button.text}</span>
                  </Button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
    </div>
  )
}
