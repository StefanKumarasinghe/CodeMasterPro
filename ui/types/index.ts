import type React from "react"

export type OutputFormat = "codeOnly" | "codeAndExplanation" | "explanationOnly"

export interface Preferences {
  outputFormat: OutputFormat
  syntaxHighlighting: boolean
  showLineNumbers: boolean
  autoComplete: boolean
  inputPreference: string
  providerModel: string
  freeModel: string
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

export interface PinnedFile {
  path: string
  name: string
  charCount?: number
}

export type ActiveView = "chat" | "settings" | "documentation"

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
  language: string
  mcp: string
  providerName: string
  freeModel: string
  outputFormat: string
  syntaxHighlighting: boolean
  showLineNumbers: boolean
  autoComplete: boolean
  customPrompt?: string
  personalInfo?: string
  chatId: string
  modelType: string
  pinnedFiles?: PinnedFile[]
  clientInfo: {
    timezone: string
    locale: string
    userAgent: string
    screenSize: {
      width: number
      height: number
    }
  }
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

export type MessageRole = "user" | "assistant" | "system" | "data";

export interface Message {
  id: string
  role: MessageRole
  content: string
  dataImage?: string
}

export interface ChatContextType {
  messages: Message[]
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement> | { target: { value: string } }) => void
  append: (message: Omit<Message, 'id'>) => void
  reload: () => void
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  isLoading: boolean
  language: string
  setLanguage: React.Dispatch<React.SetStateAction<string>>
  preferences: Preferences
  setPreferences: React.Dispatch<React.SetStateAction<Preferences>>
  memoryState: MemoryState
  setMemoryState: React.Dispatch<React.SetStateAction<MemoryState>>
  handleSubmit: (messageInput: string) => Promise<void>
  handleLoad: () => Promise<void>
  handleCodeAction: (action: string, code: string, lang?: string) => void
  activeView: ActiveView
  setActiveView: React.Dispatch<React.SetStateAction<ActiveView>>
  customPrompt: string
  setCustomPrompt: React.Dispatch<React.SetStateAction<string>>
  personalInfo: string
  setPersonalInfo: React.Dispatch<React.SetStateAction<string>>
  error: string | null
  chatId: string
  setChatId: React.Dispatch<React.SetStateAction<string>>
  lastAutoSave: Date | null
  mcp: string
  setMcp: React.Dispatch<React.SetStateAction<string>>
  modelType: string
  setModelType: React.Dispatch<React.SetStateAction<string>>
  providerName: string
  setProviderName: React.Dispatch<React.SetStateAction<string>>
  freeModel: string
  setFreeModel: React.Dispatch<React.SetStateAction<string>>
  pinnedFiles: PinnedFile[]
  addPinnedFile: (path: string, name: string) => void
  removePinnedFile: (path: string) => void
  clearPinnedFiles: () => void
  getTotalPinnedChars: () => number
}

export interface ValidationResult {
  isValid: boolean
  message?: string
}
