"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback, memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { QuickActionBar } from "./quick-action-bar"
import { Copy, Check, Download, ExternalLink, ArrowDown, Play, Shield } from "lucide-react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import { Button } from "@/components/ui/button"
import { toast } from "@/utils/toast-util"
import { cn } from "@/lib/utils"
import { HtmlPreview } from "./html-preview"
import { PythonShell } from "./python-shell"
import { CodeSast } from "./code-sast"


export interface SavedSnippet {
  id: string
  name: string
  description: string
  code: string
}

interface MessageContentProps {
  content: string
  syntaxHighlighting: boolean
  showLineNumbers: boolean
  onCodeAction: (action: string, code: string, lang: string) => void
  isInteractive?: boolean
}

interface PreformattedCodeProps {
  code: string
  language?: string
  darkMode?: boolean
}

const PreformattedCode = ({ code, language = "text", darkMode = true }: PreformattedCodeProps) => {
  const style = darkMode ? oneDark : oneLight
  const [pythonShellInstance, setPythonShellInstance] = useState<React.ReactNode | null>(null)

  return (
    <SyntaxHighlighter
      language={language}
      style={style}
      showLineNumbers={false}
      wrapLines={true}
      PreTag="div"
      className="overflow-x-auto m-0"
      customStyle={{
        margin: 0,
        borderRadius: "0 0 0.375rem 0.375rem",
        fontSize: "0.875rem",
      }}
    >
      {code}
    </SyntaxHighlighter>
  )
}

const normalizeLang = (lang: string): string => {
  const map: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    jsx: "javascript",
    tsx: "typescript",
    sh: "bash",
    shell: "bash",
    md: "markdown",
    yml: "yaml",
    py: "python",
    rb: "ruby",
    csharp: "csharp",
    html: "html",
    css: "css",
    json: "json",
    go: "go",
    cpp: "cpp",
    c: "c",
  }
  return map[lang.toLowerCase()] || lang.toLowerCase()
}

// Function to check if code is HTML
const isHtmlCode = (code: string, lang: string): boolean => {
  // Check if language is explicitly HTML
  if (lang === "html") return true

  // Check for HTML patterns if language is not specified or is text/markup
  if (["text", "markup", "xml"].includes(lang) || !lang) {
    // Look for common HTML patterns
    return (
      /<html|<!DOCTYPE html|<body|<head|<div|<span|<p>|<a\s|<img\s|<ul>|<ol>|<li>|<table>|<form>|<input\s/i.test(
        code,
      ) && /<\/[a-z]+>/i.test(code)
    )
  }

  return false
}



const TextBlock = memo(({ content }: { content: string }) => {
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return (
      <div className="w-full p-4 bg-red-100 border border-red-400 text-red-700 rounded-md my-4">
        <p>
          Oops! Something went wrong while rendering the content. We're displaying this message to
          prevent the app from breaking.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto break-words bg-card rounded-md my-4 prose prose-zinc dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => <h1 {...props} className="text-2xl font-bold mt-6 mb-4" />,
          h2: ({ node, ...props }) => <h2 {...props} className="text-xl font-bold mt-5 mb-3" />,
          h3: ({ node, ...props }) => <h3 {...props} className="text-lg font-bold mt-4 mb-2" />,
          h4: ({ node, ...props }) => (
            <h4 {...props} className="text-base font-semibold mt-3 mb-2" />
          ),
          p: ({ node, ...props }) => <p {...props} className="my-3 leading-relaxed" />,
          ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-6 ml-4 my-3" />,
          ol: ({ node, ...props }) => <ol {...props} className="list-decimal pl-6 ml-4 my-3" />,
          li: ({ node, ...props }) => <li {...props} className="my-1" />,
          blockquote: ({ node, ...props }) => (
            <blockquote {...props} className="border-l-4 border-primary/30 pl-4 italic my-3" />
          ),
          code: ({ node, inline, className, children, ...props }) => {
            if (inline) {
              return (
                <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                  {children}
                </code>
              )
            }
            return null
          },
          a: ({ node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              {props.children}
              <ExternalLink className="h-3 w-3 inline" />
            </a>
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table {...props} className="border-collapse table-auto w-full text-sm" />
            </div>
          ),
          thead: ({ node, ...props }) => <thead {...props} className="bg-muted" />,
          tbody: ({ node, ...props }) => <tbody {...props} />,
          tr: ({ node, ...props }) => <tr {...props} className="border-b border-border" />,
          th: ({ node, ...props }) => (
            <th {...props} className="border px-4 py-2 text-left font-bold" />
          ),
          td: ({ node, ...props }) => <td {...props} className="border px-4 py-2" />,
        }}
        onError={() => {
          setHasError(true)
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})


const CodeBlock = memo(
  ({
    code,
    lang,
    fileName,
    blockIndex,
    copiedBlockIndex,
    onCopy,
    onAction,
    isInteractive,
  }: {
    code: string
    lang: string
    fileName?: string
    showLineNumbers: boolean
    blockIndex: number
    copiedBlockIndex: number | null
    onCopy: (code: string, blockIndex: number) => void
    onAction: (action: string, code: string, lang: string) => void
    isInteractive?: boolean
  }) => {
    const [isHovered, setIsHovered] = useState(false)
    const [showHtmlPreview, setShowHtmlPreview] = useState(false)
    const [showPythonShell, setShowPythonShell] = useState(false)
    const [showSastAnalysis, setShowSastAnalysis] = useState(false)
    const isHtml = isHtmlCode(code, lang)

    const languageExtensions = {
      javascript: "js",
      python: "py",
      java: "java",
      c: "c",
      cpp: "cpp",
      "c++": "cpp",
      csharp: "cs",
      "c#": "cs",
      php: "php",
      typescript: "ts",
      html: "html",
      css: "css",
      json: "json",
      xml: "xml",
      markdown: "md",
      text: "txt",
      ruby: "rb",
      go: "go",
      swift: "swift",
      kotlin: "kt",
      scala: "scala",
      perl: "pl",
      bash: "sh",
      shell: "sh",
      sql: "sql",
    }

    const downloadCode = useCallback(() => {
      const fileExtension = languageExtensions[lang as keyof typeof languageExtensions] || "txt"
      const filename = fileName || `code-snippet.${fileExtension}`
      const blob = new Blob([code], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success("Code downloaded successfully!")
    }, [code, lang, fileName])

    // Run SAST analysis
    const runSastAnalysis = () => {
      setShowSastAnalysis(true)
    }

    return (
      <div
        className={cn(
          "relative mb-0 mt-0 group shadow-md w-full overflow-x-auto",
          isInteractive && "hover:ring-1 hover:ring-primary/50 transition-all duration-200",
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Action bar above code block */}
        {isInteractive && (
          <div
            className={cn(
              "bg-zinc-800/90 border-b border-zinc-700 p-1 transition-opacity duration-200",
              isHovered ? "opacity-100" : "opacity-0",
            )}
          >
            <QuickActionBar onAction={(action) => onAction(action, code, lang)} language={lang} code={code} />
          </div>
        )}

        <div className="bg-zinc-800 text-zinc-300 text-xs px-4 py-2 flex justify-between items-center font-mono">
          <div className="flex bg-zinc-800 items-center gap-2">
            {fileName ? (
              <span>
                {fileName} <span className="opacity-50">({lang})</span>
              </span>
            ) : (
              <span>{lang}</span>
            )}
            {isHtml && <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded text-xs">HTML</span>}
            {lang === "python" && (
              <span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded text-xs">Python</span>
            )}
          </div>
          <div className="flex bg-zinc-800 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 text-zinc-400 "
              onClick={() => onCopy(code, blockIndex)}
              aria-label="Copy code"
            >
              {copiedBlockIndex === blockIndex ? (
                <Check className="h-3.5 w-3.5 text-green-800" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 text-zinc-400 "
              onClick={downloadCode}
              aria-label="Download code"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            {isHtml && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-emerald-400 hover:text-emerald-600 text-xs"
                onClick={() => setShowHtmlPreview(true)}
              >
                <Play className="h-3.5 w-3.5 mr-1" />
                Run
              </Button>
            )}
            {/* Python run button */}
            {lang === "python" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-blue-400 hover:text-blue-500 text-xs"
                onClick={() => setShowPythonShell(true)}
              >
                <Play className="h-3.5 w-3.5 mr-1" />
                Run
              </Button>
            )}
            {/* SAST analysis button */}
            {(lang === "javascript" || lang === "typescript" || lang === "python" || lang === "java") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-purple-400 hover:text-purple-500 text-xs"
                onClick={runSastAnalysis}
              >
                <Shield className="h-3.5 w-3.5 mr-1" />
                SAST
              </Button>
            )}
            {isInteractive && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-zinc-400 text-xs"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("use-code", {
                      detail: {
                        code,
                        language: lang,
                        fileName:
                          fileName || `code.${languageExtensions[lang as keyof typeof languageExtensions] || "txt"}`,
                      },
                    }),
                  )
                }
              >
                <ArrowDown className="h-3.5 w-3.5 mr-1" />
                Use
              </Button>
            )}
            <span className="text-xs opacity-70 hidden sm:inline-block">
              {copiedBlockIndex === blockIndex ? "Copied!" : "Click to copy"}
            </span>
          </div>
        </div>
        <PreformattedCode code={code} language={lang} darkMode={true} />
        {isInteractive && (
          <div className="absolute bottom-2 right-2 text-xs text-zinc-400 bg-zinc-800/70 px-2 py-1 rounded-md">
            Actions available
          </div>
        )}
        {showHtmlPreview && (
          <HtmlPreview htmlContent={code} isOpen={showHtmlPreview} onClose={() => setShowHtmlPreview(false)} />
        )}
        {lang === "python" && showPythonShell && (
          <PythonShell code={code} isOpen={showPythonShell} onClose={() => setShowPythonShell(false)} />
        )}
        {showSastAnalysis && <CodeSast code={code} language={lang} onClose={() => setShowSastAnalysis(false)} />}
      </div>
    )
  },
)

CodeBlock.displayName = "CodeBlock"
TextBlock.displayName = "TextBlock"

function MessageContent({
  content,
  syntaxHighlighting,
  showLineNumbers,
  onCodeAction,
  isInteractive,
}: MessageContentProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [copiedBlockIndex, setCopiedBlockIndex] = useState<number | null>(null)
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) return
      const selectedNode = selection.anchorNode?.parentElement
      const codeBlock = selectedNode?.closest("pre")
      if (codeBlock) {
        e.preventDefault()
        const selectedText = selection.toString()
        const lines = selectedText.split("\n")
        const cleanedLines = lines.map((line) => {
          return line.replace(/^\s*\d+(?:\s{2,}|\t+)/, "")
        })
        const cleanedText = cleanedLines.join("\n")
        e.clipboardData?.setData("text/plain", cleanedText)
      }
    }

    document.addEventListener("copy", handleCopy)
    return () => document.removeEventListener("copy", handleCopy)
  }, [showLineNumbers])

  

    const getSavedSnippets = (): SavedSnippet[] =>{
      try {
        const raw = localStorage.getItem("code-snippets")
        return raw ? JSON.parse(raw) : []
      } catch (error) {
        console.error("Error reading snippets:", error)
        return []
      }
    }
  
    const saveSnippets = (snippets: SavedSnippet[]) => {
      try {
        localStorage.setItem("code-snippets", JSON.stringify(snippets))
      } catch (error) {
        console.error("Error saving snippets:", error)
      }
    }
  
    const addSnippet = (snippet: SavedSnippet)=>{
      const snippets = getSavedSnippets()
      snippets.push(snippet)
      saveSnippets(snippets)
    }
  
    const addSnippetToLocalStorage = (snippetName: string, snippetDescription: string, code: string) => {
      const humanReadableDate = new Date().toLocaleString()
      addSnippet({
      id: Date.now().toString(),
      name: snippetName,
      description: `${snippetDescription} - ${humanReadableDate}`,
      code: code
      })
      toast.success("Snippet added to local storage!")
    }

  const copyCodeBlock = useCallback((code: string, blockIndex: number) => {
    const lines = code.split("\n")

    // Detect if every non-empty line starts with a number + 2+ spaces or tab
    const isLineNumbered = lines.every((line) => line.trim() === "" || /^\s*\d+(?:\s{2,}|\t+)/.test(line))

    const cleanedLines = isLineNumbered ? lines.map((line) => line.replace(/^\s*\d+(?:\s{2,}|\t+)/, "")) : lines

    const cleanedCode = cleanedLines.join("\n")

    navigator.clipboard
      .writeText(cleanedCode)
      .then(() => {
        setCopiedBlockIndex(blockIndex)
        toast.success("Code was copied")
        setTimeout(() => setCopiedBlockIndex(null), 2000)
      })
      .catch((err) => {
        console.error("Failed to copy code:", err)
        toast.error("Failed to copy the code")
      })
  }, [])

  const handleCodeSelection = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    const selectedText = selection.toString().trim()
    if (!selectedText) return

    const isLikelyCode = (text: string) => {
      return text.length > 10 && text.split("\n").length > 1
    }

    const detectCodeLanguage = (text: string) => {
      if (text.includes("import React")) return "javascript"
      if (text.includes("def ")) return "python"
      return null
    }

    if (isLikelyCode(selectedText)) {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const menu = document.createElement("div")
      menu.className = "fixed z-50 bg-background border rounded-md shadow-md p-1 flex gap-1"
      menu.style.left = `${rect.left}px`
      menu.style.top = `${rect.bottom + 5}px`
      const actions = [
        {
          label: "Explain part of code",
          icon: "MessageSquare",
          action: () => onCodeAction("explain-code", selectedText, detectCodeLanguage(selectedText) || "text"),
        },
        {
          label: "Modify",
          icon: "Edit",
          action: () => {
            window.dispatchEvent(
              new CustomEvent("use-code", {
                detail: {
                  code: selectedText,
                  language: detectCodeLanguage(selectedText) || "text",
                  fileName: `snippet.${detectCodeLanguage(selectedText) || "txt"}`,
                },
              }),
            )
          },
        },
        {
          label: "Add to code templates",
          icon: "Plus",
          action: () => {
            addSnippetToLocalStorage("Partial Code Snippet","Description", selectedText)
          },
        }
      ]

      actions.forEach((action) => {
        const button = document.createElement("button")
        button.className = "px-2 py-1 text-xs rounded hover:bg-muted flex items-center gap-1"
        button.innerHTML = `<span>${action.label}</span>`
        button.onclick = () => {
          action.action()
          if (document.body.contains(menu)) {
            document.body.removeChild(menu)
          }        
        }
        menu.appendChild(button)
      })
      const closeButton = document.createElement("button")
      closeButton.className = "px-1 text-xs rounded hover:bg-muted"
      closeButton.innerHTML = "×"
      closeButton.onclick = () => {
        if (document.body.contains(menu)) {
          document.body.removeChild(menu)
        }        
      }
      menu.appendChild(closeButton)
      document.body.appendChild(menu)

      const handleClickOutside = (e: MouseEvent) => {
        if (!menu.contains(e.target as Node)) {
          if (document.body.contains(menu)) {
            document.body.removeChild(menu)
          }
          document.removeEventListener("mousedown", handleClickOutside)
        }
      }
      document.addEventListener("mousedown", handleClickOutside)
    }
  }
  useEffect(() => {
    const handleMouseUp = () => {
      handleCodeSelection()
    }

    contentRef.current?.addEventListener("mouseup", handleMouseUp)

    return () => {
      contentRef.current?.removeEventListener("mouseup", handleMouseUp)
    }
  }, [onCodeAction])

  if (!syntaxHighlighting) {
    return (
      <div
        ref={contentRef}
        className="w-full overflow-x-auto break-words rounded-md p-4 text-sm prose prose-zinc dark:prose-invert max-w-none shadow-sm"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ node, ...props }) => (
              <a
                {...props}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                {props.children}
                <ExternalLink className="h-3 w-3 inline" />
              </a>
            ),
            p: ({ node, ...props }) => <p {...props} className="my-2 leading-relaxed" />,
            ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-6 my-3" />,
            ol: ({ node, ...props }) => <ol {...props} className="list-decimal pl-6 my-3" />,
            li: ({ node, ...props }) => <li {...props} className="my-1" />,
            blockquote: ({ node, ...props }) => (
              <blockquote {...props} className="border-l-4 border-primary/30 pl-4 italic my-3" />
            ),
            code: ({ node, inline, className, children, ...props }) => {
              if (inline) {
                return (
                  <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                    {children}
                  </code>
                )
              }
              return null
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    )
  }
  const multilineRegex = /^(`{3,})(\w*)\n([\s\S]*?)\n?\1 *$/gm
  const inlineSameLineRegex = /(`{3,})(\w+)?\s+(.*?)(?:\s*\1)/g

  const parts: React.ReactNode[] = []
  const safeContent = typeof content === "string" ? content : ""

  let lastIndex = 0
  let match: RegExpExecArray | null
  let blockIndex = 0

  // --- Process multiline code blocks first ---
  while ((match = multilineRegex.exec(safeContent)) !== null) {
    const [fullMatch, backticks, langRaw = "text", rawCode] = match

    if (match.index > lastIndex) {
      const beforeCode = safeContent.slice(lastIndex, match.index).trim()
      if (beforeCode) {
        parts.push(<TextBlock key={`text-${blockIndex}`} content={beforeCode} />)
        blockIndex++
      }
    }

    const lang = normalizeLang(langRaw.trim() || "text")
    let code = rawCode.trim()

    let fileName = ""
    if (code.startsWith("File:")) {
      const firstLineBreak = code.indexOf("\n")
      if (firstLineBreak !== -1) {
        fileName = code.substring(5, firstLineBreak).trim()
        code = code.substring(firstLineBreak + 1).trim()
      }
    }

    parts.push(
      <CodeBlock
        key={`code-${blockIndex}`}
        code={code}
        lang={lang}
        fileName={fileName}
        showLineNumbers={showLineNumbers}
        blockIndex={blockIndex}
        copiedBlockIndex={copiedBlockIndex}
        onCopy={copyCodeBlock}
        onAction={onCodeAction}
        isInteractive={isInteractive}
      />,
    )

    lastIndex = match.index + fullMatch.length
    blockIndex++
  }

  let trailing = safeContent.slice(lastIndex).trim()

  while ((match = inlineSameLineRegex.exec(trailing)) !== null) {
    const [fullMatch, backticks, langRaw = "text", rawCode] = match

    const beforeInline = trailing.slice(0, match.index).trim()
    if (beforeInline) {
      parts.push(<TextBlock key={`text-${blockIndex}`} content={beforeInline} />)
      blockIndex++
    }

    parts.push(
      <CodeBlock
        key={`inline-${blockIndex}`}
        code={rawCode.trim()}
        lang={normalizeLang(langRaw.trim() || "text")}
        showLineNumbers={false}
        blockIndex={blockIndex}
        copiedBlockIndex={copiedBlockIndex}
        onCopy={copyCodeBlock}
        onAction={onCodeAction}
        isInteractive={isInteractive}
      />,
    )

    trailing = trailing.slice(match.index + fullMatch.length).trim()
    inlineSameLineRegex.lastIndex = 0
    blockIndex++
  }

  if (trailing.trim()) {
    parts.push(<TextBlock key={`text-${blockIndex}`} content={trailing.trim()} />)
  }

  return (
    <div ref={contentRef} className="w-full overflow-x-auto break-words">
      {parts.length > 0 ? (
        parts.map((part, index) => (
          <div key={index} className="mb-4 last:mb-0 overflow-x-auto">
            {part}
          </div>
        ))
      ) : (
        <div className="text-muted-foreground">No content to display</div>
      )}
    </div>
  )
}

export default memo(MessageContent)
