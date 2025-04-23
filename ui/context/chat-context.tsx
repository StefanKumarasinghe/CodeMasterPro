"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useChat as useAIChat } from "ai/react"
import type { Preferences, MemoryState, ChatContextType, ActiveView } from "@/types"
import { STORAGE_KEYS, API_ENDPOINT, DEFAULT_PREFERENCES } from "@/config/constants"
import { createPromptFromAction, validateInput } from "@/utils/chat-utils"
import { prepareApiRequest } from "@/utils/api"
import { toast } from "@/utils/toast-util"
import { ErrorBoundary } from "@/components/error-boundary"
import { v4 as uuidv4 } from "uuid"
import { autoSaveCurrentChat } from "@/utils/chat-utils"

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<string>("general")
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)

  // Use the default preferences from constants
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [memoryState, setMemoryState] = useState<MemoryState>({
    noComments: false,
    forgetMemory: false,
    rememberMemory: false,
  })
  const [activeView, setActiveView] = useState<ActiveView>("chat")
  const [customPrompt, setCustomPrompt] = useState<string>("")
  const [personalInfo, setPersonalInfo] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  // Add to the ChatProvider function, after the existing state declarations
  const [currentChatId, setCurrentChatId] = useState<string>(uuidv4())
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null)

  const {
    messages,
    input,
    handleInputChange,
    append,
    reload,
    setMessages,
    isLoading: aiLoading,
  } = useAIChat({
    body: {
      language,
      preferences,
      customPrompt,
      personalInfo,
    },
  })

  const isLoading = aiLoading || isProcessing

  // Set mounted state after component mounts
  useEffect(() => {
    setHasMounted(true)
  }, [])

  // Load preferences from localStorage after component mounts
  useEffect(() => {
    if (!hasMounted) return

    try {
      // Load preferences from localStorage
      const savedPrefs = localStorage.getItem(STORAGE_KEYS.PREFERENCES)
      if (savedPrefs) {
        try {
          const parsedPrefs = JSON.parse(savedPrefs)
          // Merge with default preferences to ensure all fields exist
          setPreferences((prev) => ({
            ...DEFAULT_PREFERENCES,
            ...parsedPrefs,
            codeQuality: {
              ...DEFAULT_PREFERENCES.codeQuality,
              ...(parsedPrefs.codeQuality || {}),
            },
          }))
        } catch (parseError) {
          console.error("Failed to parse preferences:", parseError)
          // If parsing fails, use default preferences
          setPreferences(DEFAULT_PREFERENCES)
        }
      }

      // Load custom prompt
      const savedCustomPrompt = localStorage.getItem(STORAGE_KEYS.CUSTOM_PROMPT)
      if (savedCustomPrompt) setCustomPrompt(savedCustomPrompt)

      // Load personal info
      const savedPersonalInfo = localStorage.getItem(STORAGE_KEYS.PERSONAL_INFO)
      if (savedPersonalInfo) setPersonalInfo(savedPersonalInfo)
    } catch (error) {
      console.error("Failed to load preferences:", error)
    }
  }, [hasMounted])

  // Add this effect after the preferences loading effect
  // Auto-save chat when messages change
  useEffect(() => {
    if (messages.length > 0) {
      autoSaveCurrentChat(messages, currentChatId)
      setLastAutoSave(new Date())
    }
  }, [messages, currentChatId])

  // Handle memory state changes
  useEffect(() => {
    if (memoryState.forgetMemory) {
      setMessages([])
      setMemoryState((prev) => ({ ...prev, forgetMemory: false }))
      toast.success("Conversation memory has been cleared")
    }

    if (memoryState.rememberMemory) {
      try {
        // Save preferences to localStorage
        const prefsToSave = JSON.stringify(preferences)
        localStorage.setItem(STORAGE_KEYS.PREFERENCES, prefsToSave)

        // Save custom prompt
        if (customPrompt) {
          localStorage.setItem(STORAGE_KEYS.CUSTOM_PROMPT, customPrompt)
        }

        // Save personal info
        if (personalInfo) {
          localStorage.setItem(STORAGE_KEYS.PERSONAL_INFO, personalInfo)
        }

        setMemoryState((prev) => ({ ...prev, rememberMemory: false }))
        toast.success("All preferences have been saved")
      } catch (error) {
        console.error("Failed to save preferences:", error)
        toast.error("Failed to save preferences. Please try again.")
      }
    }
  }, [memoryState, preferences, customPrompt, personalInfo, setMessages])

  const handleLoad = async () => {
    try {
      append({
        role: "user",
        content: "Loading chat history...",
      })
    } catch (error) {
      console.error("Failed to load chat history:", error)
      toast.error("Failed to load chat history. Please try again.")
    }
  }


  const handleSubmit = async (messageInput: string) => {
    const validation = validateInput(messageInput)
    console.log("Validation result:", validation)
    if (!validation.isValid) {
      toast.error(validation.message ?? "Please enter a valid message")
      return
    }
    if (messageInput.length > 15000) {
      toast.error("This message will be processed by CodeMasterProAnalyst. it will take a long time so please let TARS think and come back later")
    }
    if (!language) {
      toast.error("Please select a programming language before submitting.")
      return
    }
    if (!preferences.outputFormat) {
      toast.error("Please select an output format before submitting.")
      return
    }
   
    setIsProcessing(true)
    try {
      if (messageInput.length > 15000) {
        append({
          role: "assistant",
          content: "This message will be processed by CodeMasterProAnalyst. it will take a long time so please let TARS think and come back later",
        })
      }else {
        append({
          role: "user",
          content: messageInput,
        })
      }
      
      const request = prepareApiRequest(messageInput, language, preferences, customPrompt, personalInfo)
  
      const response = await fetch(`${API_ENDPOINT}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        if (response.status === 499) {
          toast.error("Well, I guess you changed your mind. No worries!")
          return
        }
        if (response.status === 429) {
          toast.error("Rate limit exceeded. Please try again later.")
          return
        }
        if (response.status === 500) {
          toast.error("Internal server error. Please try again later.")
          return
        }
        if (response.status === 503) {
          toast.error("Service unavailable. Please try again later.")
          return
        }
      }

      const data = await response.json()
      append({
        role: "assistant",
        content: data.result,
      })
    } catch (error: any) {
      console.error("Failed to process message:", error)
      setError(error.message || "An unknown error occurred")
      toast.error(error.message || "Failed to process your message. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }


  
  const handleCodeAction = (action: string, code: string, lang: string = language) => {
    if (!code.trim()) {
      toast.error("Please provide code to perform this action on.")
      return
    }
    if (code.length > 100000) {
      toast.error("The code is too long. Please provide a shorter snippet.")
      return
    }

    // Get the action prompt but don't show it to the user
    const prompt = createPromptFromAction(action, code, lang)
    if (!prompt) {
      toast.error("The selected action is not supported.")
      return
    }

    if (action === "no-comments") {
      setMemoryState((prev) => ({
        ...prev,
        noComments: !prev.noComments,
      }))
      toast.success(memoryState.noComments ? "Comments will now be included" : "Comments will be removed")
    }

    // Create a user-friendly action name
    const actionMap: Record<string, string> = {
      "explain-code": "Explaining the code",
      "debug-code": "Debugging the code",
      "optimize-code": "Optimizing the code",
      "refactor-code": "Refactoring the code",
      "format-code": "Formatting the code",
      "add-comments": "Adding comments to the code",
      "convert-code": "Converting the code",
      "generate-tests": "Generating tests for the code",
      "complete-code": "Completing the code",
      "run-sast": "Run static analysis on the code and provide feedback",
      "no-comments": "Removing comments from the code",
    }

    // Show a user-friendly message in the chat
    const userMessage = actionMap[action] || `Performing ${action} on the code`

    // For the UI, we'll show a simple message
    append({
      role: "user",
      content: userMessage,
    })

    // But we'll send the full prompt to the API
    setIsProcessing(true)

    try {
      const request = prepareApiRequest(prompt, language, preferences, customPrompt, personalInfo)
      fetch(`${API_ENDPOINT}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Failed to process code action")
          }
          return response.json()
        })
        .then((data) => {
          append({
            role: "assistant",
            content: data.result,
          })
        })
        .catch((error) => {
          console.error("Failed to process code action:", error)
          toast.error(error.message || "Failed to process your code. Please try again.")
        })
        .finally(() => {
          setIsProcessing(false)
        })
    } catch (error: any) {
      console.error("Failed to process code action:", error)
      setIsProcessing(false)
      toast.error(error.message || "Failed to process your code. Please try again.")
    }
  }

  const value: ChatContextType = {
    messages,
    input,
    handleInputChange,
    append,
    reload,
    setMessages,
    isLoading,
    language,
    setLanguage,
    preferences,
    setPreferences,
    memoryState,
    setMemoryState,
    handleSubmit,
    handleLoad,
    handleCodeAction,
    activeView,
    setActiveView,
    customPrompt,
    setCustomPrompt,
    personalInfo,
    setPersonalInfo,
    error,
    currentChatId,
    lastAutoSave,

  }

  return (
    <ErrorBoundary>
      <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
    </ErrorBoundary>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider")
  }
  return context
}
