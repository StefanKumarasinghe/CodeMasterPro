import prettier from "prettier/standalone"
import parserBabel from "prettier/parser-babel"
import parserHtml from "prettier/parser-html"
import parserCss from "prettier/parser-postcss"
import parserMarkdown from "prettier/parser-markdown"
import parserTypescript from "prettier/parser-typescript"
import hljs from "highlight.js"


export const SUPPORTED_FILE_TYPES = [
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".html",
  ".css",
  ".scss",
  ".json",
  ".md",
  ".py",
  ".rb",
  ".java",
  ".c",
  ".cpp",
  ".cs",
  ".go",
  ".rs",
  ".php",
  ".sql",
  ".txt",
  ".csv",
  ".xml",
  ".yaml",
  ".yml",
  ".sh",
  ".bat",
  ".ps1",
  ".env",
  ".gitignore",
  ".eslintrc",
  ".prettierrc",
  ".babelrc",
]

export const MAX_FILE_SIZE = 5 * 1024 * 1024

export const sanitizeInput = (code: string): string => code

export const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) =>
      e.target?.result ? resolve(e.target.result as string) : reject(new Error("Failed to read file"))
    reader.onerror = () => reject(new Error("Error reading file"))
    reader.readAsText(file)
  })

export const detectLanguage = (fileName: string): string => {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase()
  const map: Record<string, string> = {
    ".js": "javascript",
    ".jsx": "jsx",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".json": "json",
    ".md": "markdown",
    ".py": "python",
    ".rb": "ruby",
    ".java": "java",
    ".c": "c",
    ".cpp": "cpp",
    ".cs": "csharp",
    ".go": "go",
    ".rs": "rust",
    ".php": "php",
    ".sql": "sql",
    ".sh": "bash",
    ".bat": "batch",
    ".ps1": "powershell",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".xml": "xml",
    ".env": "ini",
    ".gitignore": "plaintext",
    ".eslintrc": "json",
    ".prettierrc": "json",
    ".babelrc": "json",
  }
  return map[ext] || "plaintext"
}

const ALLOWED_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "java",
  "c",
  "cpp",
  "go",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "rust",
  "bash",
  "json",
  "html",
  "css",
  "yaml",
  "xml",
  "sql",
  "ruby",
  "csharp",
  "bash"
]


export const detectCodeLanguage = (code: string): string => {

  const result = hljs.highlightAuto(code, ALLOWED_LANGUAGES)
  if (result.language && ALLOWED_LANGUAGES.includes(result.language)) {
    return result.language
  }

  return "code"
}

export const formatCode = async (code: string, language: string): Promise<string> => {
  const lang = language || "plaintext"
  const text = sanitizeInput(code)

  try {
    const parserMap: Record<string, string> = {
      javascript: "babel",
      jsx: "babel",
      typescript: "typescript",
      tsx: "typescript",
      html: "html",
      css: "css",
      scss: "scss",
      json: "json",
      markdown: "markdown",
    }
    const parser = parserMap[lang]
    if (parser) {
      return await prettier.format(text, {
        parser,
        plugins: [parserBabel, parserHtml, parserCss, parserMarkdown, parserTypescript],
        printWidth: 80,
        tabWidth: 2,
        singleQuote: true,
        trailingComma: "es5",
        bracketSpacing: true,
        semi: true,
      })
    }
    return text
  } catch (err) {
    console.warn(`Prettier failed on ${lang}, falling back:`, err)
    return text
  }
}

export const isLikelyCode = (text: string): boolean => {
  const pats = [
    /function\s+\w+\s*\(/i,
    /class\s+\w+/i,
    /import\s+.*from/i,
    /export\s+/i,
    /<\w+>.*<\/\w+>/i,
    /const\s+\w+\s*=/i,
    /let\s+\w+\s*=/i,
    /var\s+\w+\s*=/i,
    /if\s*$$.*$$\s*\{/,
    /for\s*$$.*$$\s*\{/,
    /while\s*$$.*$$\s*\{/,
    /switch\s*$$.*$$\s*\{/,
    /\w+\s*=>/,
    /def\s+\w+\s*\(/i,
    /public\s+class/i,
    /SELECT\s+.*\s+FROM/i,
    /CREATE\s+TABLE/i,
    /^\s*@\w+/m,
    /^\s*#include/m,
    /^\s*package\s+\w+/m,
    /^\s*using\s+\w+/m,
  ]
  const hasP = pats.some((r) => r.test(text))
  const hasB = /[{};]/.test(text)
  const hasI = /^( {2,}|\t+)/m.test(text)
  const multi = text.includes("\n")
  return (hasP && (hasB || hasI || multi)) || (hasI && hasB)
}

export const processDroppedFile = async (
  file: File,
): Promise<{ content: string; language: string; fileName: string }> => {
  if (file.size > MAX_FILE_SIZE) throw new Error(`File too large (max ${MAX_FILE_SIZE / 1e6}MB)`)
  const content = await readFileAsText(file)
  const language = detectLanguage(file.name)
  return { content, language, fileName: file.name }
}

export const createCodeBlockFromFile = async (file: File): Promise<string> => {
  const { content, language, fileName } = await processDroppedFile(file)
  const formatted = await formatCode(content, language).catch(() => content)
  return `File: ${fileName}\n\n\`\`\`${language}\n${formatted}\n\`\`\``
}

export const formatPastedCode = async (code: string): Promise<{ formattedCode: string; language: string }> => {
  const language = detectCodeLanguage(code)
  const formattedCode = await formatCode(code, language)
  return { formattedCode, language }
}

export const isSupportedFile = (fileName: string): boolean =>
  SUPPORTED_FILE_TYPES.includes(fileName.slice(fileName.lastIndexOf(".")).toLowerCase())

export const getLanguageFriendlyName = (lang: string): string => {
  const names: Record<string, string> = {
    javascript: "JavaScript",
    jsx: "React JSX",
    typescript: "TypeScript",
    tsx: "React TSX",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    json: "JSON",
    markdown: "Markdown",
    python: "Python",
    ruby: "Ruby",
    java: "Java",
    c: "C",
    cpp: "C++",
    csharp: "C#",
    go: "Go",
    rust: "Rust",
    php: "PHP",
    sql: "SQL",
    bash: "Bash",
    plaintext: "Plain Text",
    code: "Code (unable to detect)",
    ini: "INI",
    yaml: "YAML",
    gitignore: "Gitignore",
    eslint: "ESLint",
    prettier: "Prettier",
    babel: "Babel",
    xml: "XML",
    csv: "CSV",
    shell: "Shell",
    powershell: "PowerShell",
    batch: "Batch",
    env: "Environment Variables",
    txt: "Text File",
  }
  return names[lang] || lang.charAt(0).toUpperCase() + lang.slice(1)
}
