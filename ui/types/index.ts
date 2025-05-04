import type React from "react"
import type { Message } from "ai"

export interface Preferences {
  outputFormat: "codeAndExplanation" | "codeOnly" | "explanationOnly"
  syntaxHighlighting: boolean
  showLineNumbers: boolean
  autoComplete: boolean
  inputPreference: "Autotag" | "NoTag"
  codeQuality: {
    linting: boolean
    formatting: boolean
    comments: boolean
    typeChecking: boolean
    bestPractices: boolean
  }
}

export interface CodeBlock {
  language: string
  code: string
}

export type ActiveView = "chat" | "prompts"

export interface ClientInfo {
  timezone: string
  locale: string
  userAgent: string
  screenSize: {
    width: number
    height: number
  }
}

export interface ApiRequest {
  message: string
  language?: string
  mcp?: string
  outputFormat?: string
  codeQuality?: {
    linting?: boolean
    formatting?: boolean
    typeChecking?: boolean
    bestPractices?: boolean
    comments?: boolean
  }
  syntaxHighlighting?: boolean
  showLineNumbers?: boolean
  autoComplete?: boolean
  customPrompt?: string
  personalInfo?: string
  clientInfo?: ClientInfo
}

export interface ApiResponse {
  result: string
  metadata?: {
    processingTime?: number
    modelUsed?: string
    tokensUsed?: number
    [key: string]: any
  }
}

export interface MemoryState {
  noComments: boolean
  forgetMemory: boolean
  rememberMemory: boolean
}

export interface ChatContextType {
  messages: Message[]
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement> | { target: { value: string } }) => void
  append: (message: { role: "user" | "assistant"; content: string }) => void
  reload: () => void
  setMessages: (messages: Message[]) => void
  isLoading: boolean
  language: string
  setLanguage: (language: string) => void
  preferences: Preferences
  setPreferences: (preferences: Preferences) => void
  memoryState: MemoryState
  setMemoryState: (state: MemoryState) => void
  handleSubmit: (message: string) => Promise<void>
  handleLoad: (message: string) =>  Promise<void>
  handleCodeAction: (action: string, code: string, lang?: string) => void
  activeView: ActiveView
  setActiveView: (view: ActiveView) => void
  customPrompt: string
  setCustomPrompt: (prompt: string) => void
  personalInfo: string
  setPersonalInfo: (info: string) => void
  error?: string | null
  currentChatId: string
  lastAutoSave?: Date | null
  mcp?: string
  setMcp: (mcp: string) => void
}

export interface ValidationResult {
  isValid: boolean
  message?: string
}
