export const API_ENDPOINT = "http://127.0.0.1:8000"
export const APP_NAME = "Tars"
export const APP_VERSION = "v1.1.1"
export const LANGUAGE_OPTIONS = [
  { value: "general", label: "General" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "csharp", label: "C#" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "sql", label: "SQL" },
  { value: "html", label: "HTML/CSS" },
]

export const STORAGE_KEYS = {
  PREFERENCES: "codeAssistPreferences",
  CHAT_MEMORY: "chatMemory",
  CUSTOM_PROMPT: "customPrompt",
  PERSONAL_INFO: "personalInfo",
  LANGUAGE: "preferredLanguage",
  THEME: "theme",
  MODEL_TYPE: "modelType",
  SIDEBAR_STATE: "sidebarState",
  DEVELOPER_SETTINGS: "developerSettings",
}

export const DEFAULT_PREFERENCES = {
  outputFormat: "codeOnly",
  syntaxHighlighting: true,
  showLineNumbers: true,
  autoComplete: true,
  inputPreference: "Autotag",
  codeQuality: {
    linting: true,
    formatting: true,
    comments: true,
    typeChecking: false,
    bestPractices: true,
  },
}

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  COMMAND_PALETTE: { key: "k", modifier: "ctrl/cmd" },
  EXPLAIN_CODE: { key: "e", modifier: "ctrl/cmd" },
  DEBUG_CODE: { key: "d", modifier: "ctrl/cmd" },
  OPTIMIZE_CODE: { key: "o", modifier: "ctrl/cmd" },
  REFACTOR_CODE: { key: "r", modifier: "ctrl/cmd" },
  SUBMIT: { key: "Enter", modifier: "ctrl/cmd" },
  NEW_LINE: { key: "Enter", modifier: "shift" },
  TOGGLE_SIDEBAR: { key: "b", modifier: "ctrl/cmd" }, // Added this shortcut
}

export const QUICK_START_TEMPLATES = [
  {
    id: "architecture-tradeoffs",
    name: "Architecture Trade-offs",
    prompt:
      "Describe the potential trade-offs and considerations when choosing between a microservices and a monolithic architecture for a [specific application domain, e.g., e-commerce platform].",
  },
  {
    id: "solid-principles",
    name: "SOLID Principles",
    prompt:
      "Explain the SOLID principles of object-oriented design and provide a concrete example of how violating one of these principles could lead to maintainability issues in a [specific programming language] project.",
  },
  {
    id: "system-design-high-level",
    name: "High-Level System Design",
    prompt:
      "Outline a high-level design for a system that [specific functionality, e.g., handles real-time chat for thousands of users]. Consider scalability, reliability, and security.",
  },
  {
    id: "code-refactoring",
    name: "Code Refactoring",
    prompt:
      "Given this code snippet [insert code], refactor it to improve its readability and maintainability. Explain the reasoning behind your changes.",
  },
  {
    id: "tech-comparison",
    name: "Technology Comparison",
    prompt:
      "Compare and contrast the advantages and disadvantages of using [technology A, e.g., React] versus [technology B, e.g., Angular] for building the front-end of a [specific type of application].",
  },
  {
    id: "production-debugging",
    name: "Production Debugging Approach",
    prompt:
      "You are receiving intermittent errors in your production system related to [specific error description]. Describe your systematic approach to diagnose and resolve this issue.",
  },
  {
    id: "stack-trace-analysis",
    name: "Stack Trace Analysis",
    prompt:
      "Analyze the following stack trace [insert stack trace] and identify the most likely cause of the error. Explain your reasoning.",
  },
  {
    id: "memory-leak-strategies",
    name: "Memory Leak Strategies",
    prompt:
      "Describe a scenario where a memory leak could occur in a [specific programming language] application and outline strategies for detecting and preventing such leaks.",
  },
  {
    id: "race-condition-example",
    name: "Race Condition Example",
    prompt:
      "Explain the concept of race conditions in concurrent programming and provide an example of how one might occur in a [specific context, e.g., updating a shared counter].",
  },
  {
    id: "performance-optimization",
    name: "Performance Optimization",
    prompt:
      "Given this performance bottleneck [describe the bottleneck and provide relevant metrics], suggest several potential optimization strategies and discuss their potential impact.",
  },
  {
    id: "testing-types",
    name: "Software Testing Types",
    prompt:
      "Describe different types of software testing (e.g., unit, integration, end-to-end) and explain when each type is most appropriate in the development lifecycle of a [specific type of project].",
  },
  {
    id: "test-case-generation",
    name: "Test Case Generation",
    prompt:
      "Write a set of test cases for the following function [insert function signature and description] to ensure its correctness under various conditions, including edge cases.",
  },
  {
    id: "tdd-benefits",
    name: "Test-Driven Development",
    prompt:
      "Explain the benefits of test-driven development (TDD) and outline the typical steps involved in this process.",
  },
  {
    id: "distributed-system-reliability",
    name: "Distributed System Reliability",
    prompt:
      "Describe strategies for ensuring the reliability and resilience of a distributed system in the face of network failures or service outages.",
  },
  {
    id: "security-vulnerability-identification",
    name: "Security Vulnerability Identification",
    prompt:
      "Identify potential security vulnerabilities in the following code snippet [insert code] and suggest ways to mitigate them.",
  },
  {
    id: "owasp-top-ten-example",
    name: "OWASP Top Ten Example",
    prompt:
      "Explain the OWASP Top Ten vulnerabilities and provide a specific example of how one of these vulnerabilities could be exploited in a web application.",
  },
  {
    id: "credential-security",
    name: "Credential Security",
    prompt: "Describe best practices for securely storing and managing user credentials in a software application.",
  },
  {
    id: "ci-cd-pipeline",
    name: "CI/CD Pipeline",
    prompt:
      "Outline a continuous integration and continuous delivery (CI/CD) pipeline for a [specific type of application] and describe the key stages involved.",
  },
  {
    id: "deployment-strategies",
    name: "Deployment Strategies",
    prompt:
      "Compare and contrast different deployment strategies (e.g., blue/green, canary deployments) and discuss when each might be most suitable.",
  },
  {
    id: "infrastructure-as-code",
    name: "Infrastructure as Code",
    prompt:
      "Explain the benefits of using infrastructure-as-code (IaC) tools and provide an example of how you might use one to provision a [specific infrastructure component, e.g., a database].",
  },
  {
    id: "secure-coding-practices",
    name: "Simple SAST checkser",
    prompt:
      "Ensure the code is secure against most attacks and is not vulnerable to common vulnerabilities and  suggest improvements to make it more secure and also check for malicious intent",
  },
]
