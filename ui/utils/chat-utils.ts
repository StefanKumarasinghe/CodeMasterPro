import type { CodeBlock, Preferences, ValidationResult } from "@/types"
import { STORAGE_KEYS } from "@/config/constants"

// Extract code blocks from input content
export const extractCodeBlocks = (content: string): CodeBlock[] => {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
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

// Provide message for output format
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

// Create prompt from action, without sanitizing input
export const createPromptFromAction = (action: string, code: string, lang: string): string => {
  switch (action) {
    case "explain-code":
      return `Explain this ${lang} code in detail:\n\n\`\`\`${lang}\n${code}\n\`\`\``
    case "debug-code":
      return `Fix this ${lang} code and identify any issues and give me the corrected code:\n\n\`\`\`${lang}\n${code}\n\`\`\``
    case "optimize-code":
      return `Optimize this ${lang} code for better performance:\n\n\`\`\`${lang}\n${code}\n\`\`\``
    case "refactor-code":
      return `Refactor this ${lang} code to improve readability and maintainability:\n\n\`\`\`${lang}\n${code}\n\`\`\``
    case "format-code":
      return `Format this ${lang} code according to best practices:\n\n\`\`\`${lang}\n${code}\n\`\`\``
    case "add-comments":
      return `Add detailed comments to this ${lang} code:\n\n\`\`\`${lang}\n${code}\n\`\`\``
    case "convert-code":
      return `Convert this ${lang} code to ${lang} while maintaining the same functionality:\n\n\`\`\`${lang}\n${code}\n\`\`\``
    case "generate-tests":
      return `Generate comprehensive tests for this ${lang} code:\n\n\`\`\`${lang}\n${code}\n\`\`\``
    case "complete-code":
      return `Complete this ${lang} code snippet:\n\n\`\`\`${lang}\n${code}\n\`\`\``
    case "no-comments":
      return `Remove all comments from this ${lang} code and return only the clean code:\n\n\`\`\`${lang}\n${code}\n\`\`\``
    default:
      return ""
  }
}

// Load user preferences from localStorage - safely
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

// Save user preferences to localStorage - safely
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

// Validate user input
export const validateInput = (input: string): ValidationResult => {
  if (!input || !input.trim()) {
    return {
      isValid: false,
      message: "Please enter a message",
    }
  }

  if (input.length > 50000) {
    return {
      isValid: false,
      message: "Message is too long. Please keep it under 10,000 characters.",
    }
  }

  return { isValid: true }
}

// Debounce function to limit the rate of function execution
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
