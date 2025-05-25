"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { Editor, type Monaco } from "@monaco-editor/react"
import { Button } from "@/components/ui/button"
import { API_ENDPOINT } from "@/config/constants"
import { Copy, Download, Save, Maximize, Minimize, Loader2, X, Code, SparkleIcon } from "lucide-react"
import { toast } from "@/utils/toast-util"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useHotkeys } from "react-hotkeys-hook"

interface CodeEditorCanvasProps {
  code: string
  language: string
  isOpen: boolean
  onClose: () => void
  onSave?: (code: string) => void
  onContentChange?: (newContent: string) => void
  filename?: string
  safeView?: boolean
}

const extensionToMonacoLanguage: { [key: string]: string } = {
  py: "python",
  js: "javascript",
  ts: "typescript",
  jsx: "javascript",
  tsx: "typescript",
  html: "html",
  css: "css",
  json: "json",
  md: "markdown",
  bash: "shell",
  sh: "shell",
  yaml: "yaml",
  yml: "yaml",
  xml: "xml",
  sql: "sql",
  java: "java",
  c: "c",
  cpp: "cpp",
  cs: "csharp",
  go: "go",
  rs: "rust",
  php: "php",
  rb: "ruby",
  swift: "swift",
  kt: "kotlin",
  scala: "scala",
  pl: "perl",
  r: "r",
  m: "matlab",
  txt: "plaintext",
}

const monacoLanguageToDisplayName: { [key: string]: string } = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  html: "HTML",
  css: "CSS",
  json: "JSON",
  markdown: "Markdown",
  shell: "Bash/Shell",
  yaml: "YAML",
  xml: "XML",
  sql: "SQL",
  java: "Java",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  go: "Go",
  rust: "Rust",
  php: "PHP",
  ruby: "Ruby",
  swift: "Swift",
  kotlin: "Kotlin",
  scala: "Scala",
  perl: "Perl",
  r: "R",
  matlab: "MATLAB",
  plaintext: "Plain Text",
}

const useFullscreen = () => {
  const [isFullScreen, setIsFullScreen] = useState(false)
  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => {
          setIsFullScreen(true)
        })
        .catch((err) => console.error("Error entering fullscreen:", err))
    } else if (document.exitFullscreen) {
      document
        .exitFullscreen()
        .then(() => {
          setIsFullScreen(false)
        })
        .catch((err) => console.error("Error exiting fullscreen:", err))
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange)
    document.addEventListener("mozfullscreenchange", handleFullscreenChange)
    document.addEventListener("MSFullscreenChange", handleFullscreenChange)

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange)
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange)
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange)
    }
  }, [])

  return { isFullScreen, toggleFullScreen }
}

const getLanguageFromFilename = (filename: string): string => {
  const extension = filename.split(".").pop()?.toLowerCase() || ""
  return extensionToMonacoLanguage[extension] || "plaintext"
}

const getLanguageFromProp = (languageProp: string): string => {
  if (monacoLanguageToDisplayName[languageProp.toLowerCase()]) {
    return languageProp.toLowerCase()
  }
  if (extensionToMonacoLanguage[languageProp.toLowerCase()]) {
    return extensionToMonacoLanguage[languageProp.toLowerCase()]
  }
  return "plaintext"
}

export const CodeEditorCanvas: React.FC<CodeEditorCanvasProps> = ({
  code: initialCode,
  language: initialLanguageProp,
  isOpen,
  onClose,
  onSave,
  onContentChange,
  filename,
  safeView = false,
}) => {
  const [code, setCode] = useState(initialCode)
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const editorRef = useRef<any>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const [isMonacoLoaded, setIsMonacoLoaded] = useState(false)
  const { theme } = useTheme()
  const { isFullScreen, toggleFullScreen } = useFullscreen()
  const actualTheme =
    theme === "system"
      ? typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme

  const [selectedLanguage, setSelectedLanguage] = useState<string>("plaintext")
  const [key, setKey] = useState(0)
  const instanceId = useRef(`code-editor-${Date.now()}`)

  const availableLanguages = useMemo(() => {
    return Object.entries(monacoLanguageToDisplayName)
      .sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB))
      .map(([monacoId, displayName]) => ({
        monacoId,
        displayName,
      }))
  }, [])

  useEffect(() => {
    setCode(initialCode)
    let finalLanguage = "plaintext"

    const langFromProp = getLanguageFromProp(initialLanguageProp)
    if (langFromProp !== "plaintext") {
      finalLanguage = langFromProp
    }
    
    else if (filename) {
      const langFromFile = getLanguageFromFilename(filename)
      if (langFromFile !== "plaintext") {
        finalLanguage = langFromFile
      }
    }
    
    else {
      const savedLanguage = localStorage.getItem("editor-monaco-language")
      if (savedLanguage && monacoLanguageToDisplayName[savedLanguage]) {
        finalLanguage = savedLanguage
      }
    }

    if (finalLanguage !== selectedLanguage) {
      setSelectedLanguage(finalLanguage)
      localStorage.setItem("editor-monaco-language", finalLanguage)
      setKey((prev) => prev + 1)
    }

    const savedLanguageCheck = localStorage.getItem("editor-monaco-language")
    if (savedLanguageCheck && !monacoLanguageToDisplayName[savedLanguageCheck]) {
      localStorage.removeItem("editor-monaco-language")
    }
  }, [initialCode, initialLanguageProp, filename])

  useHotkeys(
    "ctrl+s, cmd+s",
    (e) => {
      e.preventDefault()
      if (isDirty && onSave) {
        handleSave()
      } else if (!onSave) {
        toast.error("Save functionality not available for this item.")
      }
    },
    { enableOnFormTags: true },
  )

  const handleClose = useCallback(() => {
    if (isFullScreen) {
      toggleFullScreen()
    }
    window.dispatchEvent(
      new CustomEvent("code-editor-state", {
        detail: { isOpen: false, width: 0, instanceId: instanceId.current },
      }),
    )

    onClose()
  }, [isFullScreen, toggleFullScreen, onClose])


  useEffect(() => {
    if (!isOpen) {
      return
    }

    window.dispatchEvent(
      new CustomEvent("python-shell-close", {
        detail: { forced: true },
      }),
    )

    window.dispatchEvent(
      new CustomEvent("code-editor-close", {
        detail: { forced: true },
      }),
    )
    window.dispatchEvent(
      new CustomEvent("node-test-runner-close", {
        detail: { forced: true },
      }),
    )

    setTimeout(() => {
      let width
      if (window.innerWidth < 768) {
        width = window.innerWidth
      } else if (window.innerWidth < 1024) {
        width = Math.min(window.innerWidth * 0.4, 600)
      } else {
        width = Math.min(window.innerWidth * 0.33, 800)
      }
      width = Math.max(width, 300)

      window.dispatchEvent(
        new CustomEvent("code-editor-state", {
          detail: { isOpen: true, width, instanceId: instanceId.current },
        }),
      )
      window.dispatchEvent(new CustomEvent("sidebar-resize"))
    }, 100)
  }, [isOpen, filename])

  
  useEffect(() => {
    if (!editorContainerRef.current || !isOpen) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width
        window.dispatchEvent(
          new CustomEvent("editor-resize", {
            detail: {
              width,
              x: entry.target.getBoundingClientRect().x,
              y: entry.target.getBoundingClientRect().y,
            },
          }),
        )

        document.documentElement.style.setProperty("--right-sidebar-width", `${width}px`)
        window.dispatchEvent(new CustomEvent("sidebar-resize"))
      }
    })

    resizeObserver.observe(editorContainerRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [isOpen])

  useEffect(() => {
    const handleForcedClose = (event: CustomEvent) => {
      if (event.detail?.forced) {
        handleClose()
      }
    }

    const handleNewEditor = (event: CustomEvent) => {
      if (event.detail?.isOpen && event.detail?.instanceId !== instanceId.current) {
        handleClose()
      }
    }

    const handleMemoryCleared = () => {
      onClose()
    }

    window.addEventListener("code-editor-close", handleForcedClose as EventListener)
    window.addEventListener("code-editor-state", handleNewEditor as EventListener)
    window.addEventListener("memory-cleared", handleMemoryCleared)

    return () => {
      window.removeEventListener("code-editor-close", handleForcedClose as EventListener)
      window.removeEventListener("code-editor-state", handleNewEditor as EventListener)
      window.removeEventListener("memory-cleared", handleMemoryCleared)
    }
  }, [onClose, handleClose])

  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(actualTheme === "dark" ? "vs-dark" : "vs")
    }
  }, [actualTheme, isMonacoLoaded])

  const handleEditorDidMount = useCallback(
    (editor: any, monaco: Monaco) => {
      editorRef.current = editor
      monacoRef.current = monaco
      setIsMonacoLoaded(true)

      monaco.editor.setTheme(actualTheme === "dark" ? "vs-dark" : "vs")

      if (monaco.languages.typescript) {
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
          ...monaco.languages.typescript.typescriptDefaults.getCompilerOptions(),
          jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
          allowJsx: true,
        })

        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
          ...monaco.languages.typescript.javascriptDefaults.getCompilerOptions(),
          jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
          allowJsx: true,
        })
      }
      
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        if (isDirty && onSave) handleSave()
      })
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
        toggleFullScreen()
      })
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
        editor.getAction("editor.action.commentLine").run()
      })
      editor.addCommand(monaco.KeyCode.Escape, () => {
        handleClose()
      })

      editor.onDidChangeModelContent(() => {
        setIsDirty(true)
        const currentCode = editor.getValue()
        if (onContentChange) {
          onContentChange(currentCode)
        }
      })
    },
    [selectedLanguage, actualTheme, toggleFullScreen, handleClose, onSave, onContentChange, API_ENDPOINT],
  )

  const handleEditorChange = useCallback((value: string | undefined) => {}, [])

  const handleSave = useCallback(async () => {
    if (!onSave) return
    handleClose()
    setIsSaving(true)
    try {
      const currentCode = editorRef.current?.getValue() || code
      await onSave(currentCode)
      setIsDirty(false)
    } catch (error) {
      toast.error("Failed to save code")
      console.error("Save error:", error)
    } finally {
      setIsSaving(false)
    }
  }, [onSave, code])

  const handleLanguageChange = useCallback((monacoId: string) => {
    if (monacoLanguageToDisplayName[monacoId]) {
      setSelectedLanguage(monacoId)
      localStorage.setItem("editor-monaco-language", monacoId)
      setKey((prev) => prev + 1)
    } else {
      console.error("Attempted to set unknown language:", monacoId)
      toast.error("Invalid language selected.")
    }
  }, [])

  const handleCopy = useCallback(() => {
    const currentCode = editorRef.current?.getValue() || code
    navigator.clipboard
      .writeText(currentCode)
      .then(() => {
        toast.success("Code copied to clipboard")
      })
      .catch(() => {
        toast.error("Failed to copy code")
      })
  }, [code])

  const handleDownload = useCallback(() => {
    const currentCode = editorRef.current?.getValue() || code
    const blob = new Blob([currentCode], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url

    const extension =
      Object.keys(extensionToMonacoLanguage).find((ext) => extensionToMonacoLanguage[ext] === selectedLanguage) ||
      selectedLanguage

    link.download = filename ? `${filename}.${extension}` : `code.${extension}`

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success("Code downloaded")
  }, [code, selectedLanguage, filename])

  const ModifyCode = useCallback(() => {
    const currentCode = editorRef.current?.getValue() || code
    window.dispatchEvent(
      new CustomEvent("use-code", {
        detail: {
          code: currentCode,
          language: selectedLanguage,
          fileName: filename || `snippet.${selectedLanguage}`,
        },
      }),
    )
  }, [code, selectedLanguage, filename])

  if (!isOpen) return null

  const containerClasses = cn(
    "border-l shadow-xl flex flex-col transition-all duration-300",
    actualTheme === "dark" ? "bg-zinc-900 border-zinc-700" : "bg-zinc-50 border-zinc-300",
    isOpen ? "fixed z-50 top-0 right-0 h-full" : "hidden",
  )

  const headerClasses = cn(
    "flex flex-col border-b",
    actualTheme === "dark" ? "bg-zinc-800 border-zinc-700" : "bg-zinc-100 border-zinc-300",
  )

  const textClasses = cn("text-lg font-semibold", actualTheme === "dark" ? "text-white" : "text-zinc-900")

  const filenameClasses = cn("text-sm", actualTheme === "dark" ? "text-muted-foreground" : "text-zinc-600")

  const buttonClasses = (baseClasses = "") =>
    cn(
      baseClasses,
      "h-8 px-2",
      actualTheme === "dark"
        ? "text-zinc-400 hover:bg-zinc-700 hover:text-zinc-50 disabled:opacity-50"
        : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 disabled:opacity-50",
    )

  const selectTriggerClasses = cn(
    "w-[150px] h-8 px-2",
    actualTheme === "dark"
      ? "bg-zinc-700 text-zinc-50 border-zinc-600 focus:ring-zinc-500"
      : "bg-zinc-200 text-zinc-900 border-zinc-300 focus:ring-blue-500",
  )

  const selectContentClasses = cn(
    actualTheme === "dark" ? "bg-zinc-800 border-zinc-700 text-zinc-50" : "bg-white border-zinc-300 text-zinc-900",
  )

  const selectItemClasses = cn(actualTheme === "dark" ? "focus:bg-zinc-700" : "focus:bg-zinc-200")

  return (
    <div
      ref={editorContainerRef}
      className={cn(
        "border-l shadow-xl flex flex-col transition-all duration-300",
        actualTheme === "dark" ? "bg-zinc-900 border-zinc-700" : "bg-zinc-50 border-zinc-300",
        isOpen ? "fixed z-50 top-0 right-0 h-full" : "hidden",
      )}
      style={{
        width: isOpen ? (window.innerWidth < 768 ? "100%" : window.innerWidth < 1024 ? "40%" : "33.333%") : "0",
        minWidth: isOpen ? "300px" : "0",
        maxWidth: isOpen ? (window.innerWidth < 1024 ? "600px" : "800px") : "0",
      }}
    >
      <div className={headerClasses}>
        <div className="flex items-center justify-between p-2">
          <div className="flex items-center gap-2">
            <h2 className={textClasses}>
              {" "}
              {safeView ? (
                <SparkleIcon
                  className={cn("inline-block", actualTheme === "dark" ? "text-blue-400" : "text-blue-600")}
                />
              ) : (
                <Code
                  className={cn("inline-block h-5 w-5", actualTheme === "dark" ? "text-blue-400" : "text-blue-600")}
                />
              )}{" "}
              {safeView ? "SafeView" : "Editor"}
            </h2>
            {filename && (
              <span className={`${filenameClasses} truncate overflow-hidden px-3 mt-1 whitespace-nowrap max-w-[300px]`}>
                {filename}
              </span>
            )}

          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleClose} className={buttonClasses()}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {!safeView && (
          <>
            <div
              className={cn(
                "flex flex-wrap items-center gap-1 p-2 border-t",
                actualTheme === "dark" ? "border-zinc-700" : "border-zinc-300",
              )}
            >
              <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                <SelectTrigger className={selectTriggerClasses}>
                  <SelectValue placeholder="Select Language">
                    {monacoLanguageToDisplayName[selectedLanguage] || "Select Language"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className={selectContentClasses}>
                  {availableLanguages.map(({ monacoId, displayName }) => (
                    <SelectItem key={monacoId} value={monacoId} className={selectItemClasses}>
                      {displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="ghost" size="sm" onClick={handleCopy} className={buttonClasses()}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDownload} className={buttonClasses()}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="ghost" size="sm" onClick={ModifyCode} className={buttonClasses()}>
                <SparkleIcon className="h-4 w-4 mr-2" />
                Modify
              </Button>
              <Button variant="ghost" size="sm" onClick={toggleFullScreen} className={buttonClasses()}>
                {isFullScreen ? <Minimize className="h-4 w-4 mr-2" /> : <Maximize className="h-4 w-4 mr-2" />}
                {isFullScreen ? "Minimize" : "Maximize"}
              </Button>
              {onSave && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving || !isDirty}
                  className={buttonClasses()}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save {isDirty && " - Modified"}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <Editor
          key={key}
          height="100%"
          language={selectedLanguage}
          value={code}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            padding: { top: 10, bottom: 10 },
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: "on",
            lineNumbers: "on",
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            automaticLayout: true,
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            parameterHints: { enabled: true },
            snippetSuggestions: "inline",
            wordBasedSuggestions: true,
            suggest: {
              showMethods: true,
              showFunctions: true,
              showConstructors: true,
              showFields: true,
              showVariables: true,
              showClasses: true,
              showStructs: true,
              showInterfaces: true,
              showModules: true,
              showProperties: true,
              showEvents: true,
              showOperators: true,
              showUnits: true,
              showValues: true,
              showConstants: true,
              showEnums: true,
              showEnumMembers: true,
              showKeywords: true,
              showWords: true,
              showColors: true,
              showFiles: true,
              showReferences: true,
              showFolders: true,
              showTypeParameters: true,
              showSnippets: true,
            },
            tabCompletion: "on",
            theme: actualTheme === "dark" ? "vs-dark" : "vs",
            formatOnPaste: true,
            formatOnType: true,
            autoClosingBrackets: "languageDefined",
            autoClosingQuotes: "languageDefined",
            autoIndent: "full",
            bracketPairColorization: { enabled: true },
            guides: {
              bracketPairs: true,
              indentation: true,
              highlightActiveBracketPair: true,
            },
            folding: {
              enabled: true,
              strategy: "indentation",
              highlight: true,
              importsByDefault: true,
              ranges: true,
              indent: true,
              showLineNumbers: true,
            },
          }}
        />
      </div>
    </div>
  )
}
