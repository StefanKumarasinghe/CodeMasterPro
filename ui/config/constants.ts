import type { OutputFormat } from "@/types";

export const API_ENDPOINT = process.env.NEXT_PUBLIC_API_ENDPOINT || "http://localhost:8000";
export const APP_NAME = "CodeMasterPro"
export const APP_VERSION = "v2.0.1"

export const MCP_OPTIONS = [
  { value: "context", label: "🤔 Project Context" },
  { value: "computer", label: "💻 Compute" },
  { value: "python", label: "🐍 PyRun" },
  { value: "sast", label: "🛡️ Bandit" },
  { value: "visualization", label: "📊 Visualize" },
  { value: "quick", label: "⚡ Lightning" },
  { value: "code_analysis", label: "🔍 Deep Analysis" },
  { value: "github", label: "🌐 GitHub" },
  { value: "web", label: "🕸️ Web" },
  { value: "internal", label: "🏠 Internal Resources" },
  { value: "stack", label: "🔥 StackOverflow" },
  { value: "auto", label: "🤖 Auto Detect (Agentic)" },
]

export const STORAGE_KEYS = {
  PREFERENCES: "preferences",
  CHAT_MEMORY: "chatMemory",
  CUSTOM_PROMPT: "customPrompt",
  PERSONAL_INFO: "personalInfo",
  LANGUAGE: "preferredLanguage",
  THEME: "theme",
  MODEL_TYPE: "modelType",
  SIDEBAR_STATE: "sidebarState",
  DEVELOPER_SETTINGS: "developerSettings",
  PINNED_FILES: "pinnedFiles",
}

export const DEFAULT_PREFERENCES = {
  outputFormat: "codeAndExplanation" as OutputFormat,
  syntaxHighlighting: true,
  showLineNumbers: true,
  autoComplete: true,
  inputPreference: "Autotag",
  providerModel: "gemini",
  freeModel: "",
  codeQuality: {
    linting: true,
    formatting: true,
    comments: true,
    typeChecking: true,
    bestPractices: true,
  },
}
