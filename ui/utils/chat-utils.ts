import type { CodeBlock, Preferences, ValidationResult, Message } from "@/types" // Added Message type
import { STORAGE_KEYS } from "@/config/constants"

const CHAT_HISTORY_STORAGE_KEY = "tars-chat-history";

export const extractCodeBlocks = (content: string): CodeBlock[] => {
  const codeBlockRegex = /```(\w+)?[\r\n]([\s\S]*?)```/g
  const blocks: CodeBlock[] = []

  let match
  while ((match = codeBlockRegex.exec(content)) !== null) {
    blocks.push({
      language: match[1] || "text",
      code: match[2].trim(),
    })
  }
  return blocks
}

export const getOutputFormatMessage = (format: string): string => {
  switch (format) {
    case "codeAndExplanation":
      return "Provide code and explanation only."
    case "codeOnly":
      return "Output must contain only code in the requested language, without explanations."
    default:
      return "Provide explanations only, without any code."
  }
}

export const createPromptFromAction = (action: string, code: string, lang: string): string => {
  switch (action) {
    case "explain-code":
      return `Explain this ${lang} code in detail:

\`\`\`${lang}
${code}
\`\`\``
    case "debug-code":
      return `Fix this ${lang} code and identify any issues and give me the corrected code:

\`\`\`${lang}
${code}
\`\`\``
    case "optimize-code":
      return `Optimize this ${lang} code for better performance:

\`\`\`${lang}
${code}
\`\`\``
    case "refactor-code":
      return `Refactor this ${lang} code to improve readability and maintainability:

\`\`\`${lang}
${code}
\`\`\``
    case "format-code":
      return `Format this ${lang} code according to best practices:

\`\`\`${lang}
${code}
\`\`\``
    case "add-comments":
      return `Add detailed comments to this ${lang} code:

\`\`\`${lang}
${code}
\`\`\``
    case "convert-code":
      return `Convert this ${lang} code to ${lang} while maintaining the same functionality:

\`\`\`${lang}
${code}
\`\`\``
    case "generate-tests":
      return `Generate comprehensive tests for this ${lang} code:

\`\`\`${lang}
${code}
\`\`\``
    case "complete-code":
      return `Complete this ${lang} code snippet:

\`\`\`${lang}
${code}
\`\`\``
    case "no-comments":
      return `Remove all comments from this ${lang} code and return only the clean code:

\`\`\`${lang}
${code}
\`\`\``
    default:
      return ""
  }
}

export const loadPreferences = (): Preferences | null => {
  if (typeof window === "undefined") return null

  try {
    const savedPrefs = localStorage.getItem(STORAGE_KEYS.PREFERENCES)
    if (!savedPrefs) return null
    return JSON.parse(savedPrefs)
  } catch (e) {
    console.error("Failed to parse preferences:", e)
    return null
  }
}

export const savePreferences = (preferences: Preferences): boolean => {
  if (typeof window === "undefined") return false

  try {
    localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences))
    return true
  } catch (e) {
    console.error("Failed to save preferences:", e)
    return false
  }
}

export const validateInput = (input: string): ValidationResult => {
  if (!input || !input.trim()) {
    return {
      isValid: false,
      message: "Please enter a message",
    }
  }

  if (input.length > 100000) {
    return {
      isValid: false,
      message: "Message is too long. Please keep it under 100,000 characters.",
    }
  }

  return { isValid: true }
}

export const debounce = <F extends (...args: any[]) => any>(
  func: F,
  waitFor: number,
): ((...args: Parameters<F>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<F>): void => {
    if (timeout !== null) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => func(...args), waitFor)
  }
}

export const saveChatToHistory = (messages: any[], title: string): boolean => {
  if (typeof window === "undefined" || !messages.length) return false

  try {
    const chatItem = {
      id: Date.now().toString(),
      title: title || `Chat from ${new Date().toLocaleDateString()}`,
      date: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      preview: messages[0].content.substring(0, 100) + (messages[0].content.length > 100 ? "..." : ""),
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    }

    const existingHistory = JSON.parse(localStorage.getItem(CHAT_HISTORY_STORAGE_KEY) || "[]")

    const updatedHistory = [chatItem, ...existingHistory]

    localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory))

    return true
  } catch (error) {
    console.error("Failed to save chat:", error)
    return false
  }
}

export const loadChatHistory = () => {
  if (typeof window === "undefined") return []

  try {
    const savedHistory = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY)
    if (savedHistory) {
      return JSON.parse(savedHistory)
    }
    return []
  } catch (error) {
    console.error("Failed to load chat history:", error)
    return []
  }
}

export const deleteChatFromHistory = (chatId: string): boolean => {
  if (typeof window === "undefined") return false

  try {
    const existingHistory = JSON.parse(localStorage.getItem(CHAT_HISTORY_STORAGE_KEY) || "[]")
    const updatedHistory = existingHistory.filter((chat: any) => chat.id !== chatId)
    localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory))
    return true
  } catch (error) {
    console.error("Failed to delete chat:", error)
    return false
  }
}

export interface ChatSession {
  id: string;
  messages: Message[];
  timestamp: string;
}

export const loadCurrentChat = (): ChatSession | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const serializedSession = localStorage.getItem(STORAGE_KEYS.CURRENT_CHAT);
    if (serializedSession === null) {
      return null;
    }
    const sessionData: ChatSession = JSON.parse(serializedSession);
    // Basic validation of the loaded data structure
    if (sessionData && sessionData.id && Array.isArray(sessionData.messages) && sessionData.timestamp) {
      return sessionData;
    } else {
      console.error("Invalid chat session data found in localStorage.");
      localStorage.removeItem(STORAGE_KEYS.CURRENT_CHAT); // Clear invalid data
      return null;
    }
  } catch (error) {
    console.error("Failed to load or parse current chat session:", error);
    // Optionally clear potentially corrupted data
    // localStorage.removeItem(STORAGE_KEYS.CURRENT_CHAT);
    return null;
  }
}

export const autoSaveCurrentChat = (messages: any[], chatId: string): boolean => {
  if (typeof window === "undefined" || !messages.length) return false

  try {
    const sessionData = {
      id: chatId,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      timestamp: new Date().toISOString(),
    }

    localStorage.setItem(STORAGE_KEYS.CURRENT_CHAT, JSON.stringify(sessionData))
    return true
  } catch (error) {
    console.error("Failed to auto-save chat:", error)
    return false
  }
}
