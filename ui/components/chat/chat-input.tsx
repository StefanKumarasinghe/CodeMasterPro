"use client"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { API_ENDPOINT } from "@/config/constants"
import { Send, FileUp, Upload, Code, Square, Github, Terminal } from "lucide-react"
import { OutputFormatToggle } from "./output-format-toggle"
import { useState, useRef, useEffect, useCallback } from "react"
import { useChat } from "@/context/chat-context"
import { MCP_OPTIONS } from "@/config/constants"
import type React from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast-message"
import { CodeTemplates } from "./code-templates"
import { SUPPORTED_FILE_TYPES, isLikelyCode, detectCodeLanguage, formatCode, readFileAsText, detectLanguage } from "@/utils/file-utils"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { FileAttachment } from "./file-attachment"
import { ProjectModal } from "./project-modal"
import { BashShell } from "./bash-shell"


export function ChatInput() {
  const [showTemplates, setShowTemplates] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [messageInput, setMessageInput] = useState("")
  const [charCount, setCharCount] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [processingFile, setProcessingFile] = useState(false)
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
      isLargeText?: boolean
    }>
  >([])

  const [showBashShell, setShowBashShell] = useState(false)

  const {
    language,
    preferences,
    mcp,
    setMcp,
    setPreferences,
    isLoading,
    handleSubmit,
    handleCodeAction,
    isPreview,
    setIsPreview
  } = useChat()

  const [showProjectModal, setShowProjectModal] = useState(false)
  const [projectStatus, setProjectStatus] = useState({ has_project: false, has_index: false })
  const [suggestion, setSuggestion] = useState("")
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastWordRef = useRef("")
  const [textareaHeight, setTextareaHeight] = useState("auto")

  const isAtWordBoundary = (text: string) => {
    return text.endsWith(" ") || text.endsWith("\n")
  }

  const getDisplayValue = () => {
    if (!suggestion || !messageInput) return messageInput
    return messageInput + suggestion
  }

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
      setTextareaHeight(`${textareaRef.current.scrollHeight}px`)
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

  const fetchSuggestions = useCallback(async (input: string) => {
    if (!input.trim() || input.length < 20) {
      setSuggestion("")
      return
    }

    if (!isAtWordBoundary(input)) {
      return
    }

    try {
      setIsLoadingSuggestions(true)
      const response = await fetch(`${API_ENDPOINT}/get_recommendation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: input,
          history: [],
          recent_messages: []
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const newSuggestion = data.suggestions?.[0] || ""
        if (newSuggestion && newSuggestion !== input) {
          setSuggestion(newSuggestion)
        }
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error)
    } finally {
      setIsLoadingSuggestions(false)
    }
  }, [])

  const handleInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      setMessageInput(value)
      setSuggestion("")

      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current)
      }

      if (isAtWordBoundary(value)) {
        suggestionTimeoutRef.current = setTimeout(() => {
          fetchSuggestions(value)
        }, 500)
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
    [charCount, toast, fetchSuggestions],
  )

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = e.clipboardData.getData("text")
      if (pastedText.length > 200) {
        e.preventDefault()
        const fileName = `pasted_content_${new Date().getTime()}.txt`
        const detectedLang = detectCodeLanguage(pastedText) || "plaintext"
        
        setCodeAttachments(prev => [...prev, {
          fileName,
          content: pastedText,
          language: detectedLang,
          isLargeText: true 
        }])
        return
      }

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

  const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0
  const removeFileAttachment = useCallback((index: number) => {
    setFileAttachments((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const removeCodeAttachment = useCallback((index: number) => {
    setCodeAttachments((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    if (submitter && submitter.getAttribute('type') !== 'submit') {
      return
    }
    if (isLoading || !messageInput.trim()) return
    await submitMessage()
  }

  const handleFileContentChange = (newContent: string, index: number) => {
    setFileAttachments(prev => prev.map((file, i) => 
      i === index ? { ...file, content: newContent, contentLength: newContent.length } : file
    ));
  }

  const handleCodeContentChange = (newContent: string, index: number) => {
    setCodeAttachments(prev => prev.map((code, i) => 
      i === index ? { ...code, content: newContent } : code
    ));
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (suggestion && e.key === 'Tab') {
        e.preventDefault()
        setMessageInput(prev => prev + suggestion)
        setSuggestion("")
        return
      }

      if (!['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
        setSuggestion("")
      }

      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (messageInput.trim() || fileAttachments.length > 0 || codeAttachments.length > 0) {
          submitMessage()
        }
      }
    },
    [messageInput, fileAttachments, codeAttachments, suggestion],
  )

  const submitMessage = useCallback(() => {
    if (isPreview) {
      toast({
        title: "Ensure that you have saved your changes",
        description: "Preview mode is enabled. Please disable it to send messages.",
        variant: "destructive",
      })
      return;
    }
    if (messageInput.trim() || fileAttachments.length > 0 || codeAttachments.length > 0) {
      const fileContent = fileAttachments.map((file) => file.content).join("\n\n")
      const codeContent = codeAttachments
        .map((code) => {
          if (code.isLargeText) {
            return `\`\`\`context\n${code.content}\n\`\`\``
          } else {
            return `File: ${code.fileName}\n\n\`\`\`${code.language}\n${code.content}\n\`\`\``
          }
        })
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

  useEffect(() => {
    return () => {
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="relative">
      {showBashShell && (
        <BashShell
          isOpen={showBashShell}
          onClose={() => setShowBashShell(false)}
        />
      )}
      <div className="flex items-center gap-2 py-3">
        <form onSubmit={handleFormSubmit} className="w-full max-w-4xl px-1 mx-auto">
          <div className="flex flex-col gap-1 mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex flex-wrap items-center gap-1">
                <Select 
                  value={mcp} 
                  onValueChange={setMcp} 
                  onOpenChange={(open) => { 
                    const event = window.event
                    if (event && open) {
                      event.preventDefault()
                    }
                  }}
                >
                  <SelectTrigger className="w-auto min-w-[3rem] h-8" onClick={(e) => e.preventDefault()}>
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
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2   border text-xs gap-1"
                      onClick={(e) => {
                        e.preventDefault()
                        setShowTemplates(!showTemplates)
                      }}
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
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs border text-red-500 dark:text-red-300 gap-1"
                      onClick={(e) => {
                        e.preventDefault()
                        setShowProjectModal(true)
                      }}
                    >
                      <Github className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Manage project files</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      type="button"
                      variant="outline" 
                      size="icon" 
                      className="h-8 px-2 text-xs gap-1" 
                      onClick={(e) => {
                        e.preventDefault()
                        setShowBashShell(true)
                      }}
                    >
                      <Terminal className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Open bash shell</p>
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
                  onChange={(value) => {
                    setPreferences({ ...preferences, outputFormat: value as typeof preferences.outputFormat })
                  }}
                />
              </div>
            </div>
            <div
              ref={dropZoneRef}
              className={cn(
                "relative flex flex-col gap-2",
                isDragging && "ring-2 ring-primary rounded-md",
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

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileInputChange}
                multiple
                accept={SUPPORTED_FILE_TYPES.join(",")}
              />
              {(fileAttachments.length > 0 || codeAttachments.length > 0) && (
                <div className="flex flex-wrap gap-2 p-2 bg-muted/30 rounded-md border-2 border-dashed ">
                  {fileAttachments.map((file, index) => (
                    <FileAttachment
                      key={`file-${file.fileName}-${index}`}
                      fileName={file.fileName}
                      fileSize={file.fileSize}
                      contentLength={file.contentLength}
                      content={file.content}
                      language={file.language}
                      onRemove={() => removeFileAttachment(index)}
                      onContentChange={(newContent) => handleFileContentChange(newContent, index)}
                    />
                  ))}

                  {codeAttachments.map((code, index) => (
                    <FileAttachment
                      key={`code-${code.fileName}-${index}`}
                      fileName={code.fileName}
                      fileSize={code.content.length}
                      contentLength={code.content.length}
                      content={code.content}
                      language={code.language}
                      isLargeText={code.isLargeText}
                      onRemove={() => removeCodeAttachment(index)}
                      onContentChange={(newContent) => handleCodeContentChange(newContent, index)}
                    />
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-end relative"> 
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-[44px] w-10 flex-shrink-0 relative"
                      onClick={handleFileUploadClick}
                      disabled={isLoading || processingFile}
                    >
                      <Upload className="h-4 w-4" />
                      {(fileAttachments.length > 0 || codeAttachments.length > 0) && (
                        <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-primary text-primary-foreground text-xs rounded-full"> 
                          {fileAttachments.length + codeAttachments.length}
                        </Badge>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>Upload code or text file</p>
                  </TooltipContent>
                </Tooltip>
                <div className="relative flex-1">
                  <div className="relative">
                    <div className="relative">
                      <Textarea
                        ref={textareaRef}
                        placeholder={`How can I help you to code today`}
                        className="min-h-[22px] max-h-[44px] md:min-h-[44px] md:max-h-[200px] flex-1 resize-none overflow-y-auto pr-12 font-mono relative z-10 bg-transparent" 
                        value={messageInput}
                        onChange={handleInputChange}
                        autoFocus={true}
                        onPaste={handlePaste}
                        onKeyDown={handleKeyDown}
                        aria-label="Message input"
                      />
                      {suggestion && (
                        <div className="absolute inset-0 pointer-events-none">
                          <Textarea
                            className="flex-1 resize-none overflow-y-auto pr-12 font-mono text-muted-foreground/30 border-transparent bg-transparent"
                            style={{ 
                              height: textareaHeight,
                              minHeight: textareaHeight,
                              maxHeight: textareaHeight
                            }}
                            value={getDisplayValue()}
                            readOnly
                            aria-hidden="true"
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <span className="text-[10px] text-muted-foreground/20 bg-muted/10 px-1 rounded">
                              tab
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0"> 
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
                            codeAttachments.length === 0)
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
        </form>
      </div>
      <ProjectModal
        isOpen={showProjectModal}
        onClose={() => setShowProjectModal(false)}
        projectStatus={projectStatus}
      />
    </div>
  )
}