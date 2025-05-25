import type { OutputFormat } from "@/types";
export const API_ENDPOINT = process.env.NEXT_PUBLIC_API_ENDPOINT || "http://localhost:8000";
export const APP_NAME = "CodeMasterPro"
export const APP_VERSION = "v2.0.1"

import {
  Brain,
  Monitor,
  FileCode2,
  ShieldCheck,
  BarChart4,
  Zap,
  SearchCheck,
  Github,
  Globe2,
  Home,
  Flame,
  Bot,
  NotebookIcon,
  Laugh,
  Terminal
} from "lucide-react";


export const MCP_OPTIONS = [
  { value: "context", label: "Project Context", icon: Brain, color: "text-blue-300" },
  { value: "computer", label: "Compute", icon: Monitor, color: "text-blue-600" },
  { value: "python", label: "PyRun", icon: FileCode2, color: "text-green-600" },
  { value: "sast", label: "Bandit", icon: ShieldCheck, color: "text-red-600" },
  { value: "visualization", label: "Visualize", icon: BarChart4, color: "text-pink-600" },
  { value: "quick", label: "Lightning", icon: Zap, color: "text-yellow-500" },
  { value: "code_analysis", label: "Deep Analysis", icon: SearchCheck, color: "text-cyan-500" },
  { value: "github", label: "GitHub", icon: Github, color: "text-gray-400" },
  { value: "web", label: "Web", icon: Globe2, color: "text-blue-500" },
  { value: "internal", label: "Internal Resources", icon: Home, color: "text-orange-500" },
  { value: "stack", label: "StackOverflow", icon: Flame, color: "text-red-300" },
  { value: "node", label: "JsRunner", icon: NotebookIcon, color: "text-green-600" },
  { value: "reddit", label: "Reddit", icon: Laugh, color: "text-red-600" },
  { value: "bash", label: "Bash", icon: Terminal, color: "text-blue-600" },
  { value: "auto", label: "Auto Detect", icon: Bot, color: "text-purple-400" },
];


export const FREE_MODELS = [
  "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
  "Qwen/Qwen3-235B-A22B-fp8-tput",
  "Qwen/QwQ-32B",
  "deepseek-ai/DeepSeek-R1",
  "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
  "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
  "deepseek-ai/DeepSeek-V3",
  "meta-llama/Llama-4-Scout-17B-16E-Instruct",
  "meta-llama/Llama-Vision-Free",
  "Qwen/Qwen2.5-Coder-32B-Instruct",
  "Qwen/Qwen2.5-72B-Instruct-Turbo",
  "mistralai/Mistral-Small-24B-Instruct-2501",
  "google/gemma-3-27b-it"
];

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
  CURRENT_CHAT: "currentChat",
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
