"use client";

import type React from "react";
import { useEffect, useRef, useState, useCallback, memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { useTheme } from "next-themes";
import remarkGfm from "remark-gfm";
import { QuickActionBar } from "./quick-action-bar";
import {Copy,Check,Download,ExternalLink,ArrowDown,Play,Shield,Edit} from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {oneDark,oneLight} from "react-syntax-highlighter/dist/esm/styles/prism";
import { Button } from "@/components/ui/button";
import { toast } from "@/utils/toast-util";
import { cn } from "@/lib/utils";
import { HtmlPreview } from "./html-preview";
import { PythonShell } from "./python-shell";
import { CodeSast } from "./code-sast";
import Markdown from "react-markdown";
import { CodeEditorCanvas } from "@/components/canvas/code-editor-canvas";
import { NodeTestRunner } from "./node-test-runner";

type TextBlockProps = {
  content: string;
  imageData?: string;
};

export interface SavedSnippet {
  id: string;
  name: string;
  description: string;
  code: string;
}

interface CodeBlockInfo {
  code: string;
  language: string;
  index: number;
}

interface MessageContentProps {
  content: string;
  imageData: string;
  syntaxHighlighting: boolean;
  showLineNumbers: boolean;
  onCodeAction: (action: string, code: string, lang: string) => void;
  isInteractive?: boolean;
  onContentUpdate?: (newContent: string) => void;
  editorInfo?: {
    x: number;
    y: number;
    width: number;
  };
}

interface PreformattedCodeProps {
  code: string;
  language?: string;
  darkMode?: boolean;
  className?: string;
  customStyle?: React.CSSProperties;
}

const PreformattedCode = ({
  code,
  language = "plaintext",
  darkMode = true,
  className,
  customStyle
}: PreformattedCodeProps) => {
  const syntaxStyle = darkMode ? oneDark : oneLight;
  const lowerCasedLang = language.toLowerCase();
  const plainTextLangs = ["block", "plaintext", "text", "general", "output", ""];

  if (plainTextLangs.includes(lowerCasedLang)) {
    return <p className={cn("p-4 rounded-md my-4 whitespace-pre-wrap break-words font-scale-base", className)} style={{border: "1px solid #374151", borderRadius: "0 0 0.375rem 0.375rem", ...customStyle}}>{code}</p>;
  } else {
    return (
      <SyntaxHighlighter
        language={language}
        style={syntaxStyle}
        showLineNumbers={false}
        wrapLines={true}
        PreTag="div"
        className="overflow-x-auto m-0 max-w-prose scrollbar-hide"
        customStyle={{
          margin: 0,
          border: darkMode ? "1px solid #374151" : "1px solid rgb(105, 105, 105)",
          borderRadius: "0 0 0.375rem 0.375rem",
          fontSize: "inherit",
          transition: "font-size 0.3s ease-in-out",
          boxSizing: "border-box",
          ...customStyle,
          maxWidth: "100%",
        }}
      >
        {code.trim()}
      </SyntaxHighlighter>
    );
  }
};

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
    java: "java",
    sql: "sql",
    dockerfile: "dockerfile",
    kotlin: "kotlin",
    swift: "swift",
    scala: "scala",
    pl: "perl",
    bat: "batch",
    rust: "rust",
    php: "php",
    xml: "xml",
  };
  const lowerLang = lang.toLowerCase();
  return map[lowerLang] || lowerLang;
};


const isHtmlCode = (code: string, lang: string): boolean => {
  if (lang === "html") return true;
  if (["text", "markup", "xml"].includes(lang) || !lang) {
    return (
      /<html|<!DOCTYPE html|<body|<head|<div|<span|<p>|<a\s|<img\s|<ul>|<ol>|<li>|<table>|<form|<input/i.test(
        code
      ) && /<\/[a-z]+>/i.test(code)
    );
  }
  return false;
};

const calculateFontSize = () => {
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  if (windowWidth < 768) {
    return "14px";
  }
  return "16px";
};

const TextBlock = memo(({ content, imageData }: TextBlockProps) => {
  const [hasError, setHasError] = useState(false);
  const textBlockRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    setHasError(false);
  }, [content]);

  useEffect(() => {
    const element = textBlockRef.current;
    if (!element) return;
  
    const scrollViewport = element.closest('[data-radix-scroll-area-viewport]');
    const getBestWidth = () => {
      if (scrollViewport instanceof HTMLElement && scrollViewport.offsetWidth > 0) {
        return Math.max(scrollViewport.offsetWidth , 300);
      }
  
      const fallback =
        element.closest('.message-container') ||
        element.closest('.chat-message-list') ||
        element.parentElement;
  
      if (fallback instanceof HTMLElement && fallback.offsetWidth > 0) {
        return Math.max(fallback.offsetWidth , 300);
      }
  
      let parent = element.parentElement;
      let bestWidth = 0;
      while (parent) {
        if (parent instanceof HTMLElement && parent.offsetWidth > bestWidth) {
          bestWidth = parent.offsetWidth;
        }
        parent = parent.parentElement;
      }
  
      return Math.max(bestWidth , 300);
    };
  
    const updateWidth = () => {
      const newWidth = getBestWidth();
      setContainerWidth(prev => {
        if (Math.abs(newWidth - prev) > 10) return newWidth;
        return prev;
      });
    };
  
    const debouncedUpdateWidth = () => {
      clearTimeout(debouncedUpdateWidth.timeout);
      debouncedUpdateWidth.timeout = setTimeout(updateWidth, 100);
    };
    debouncedUpdateWidth.timeout = null as unknown as NodeJS.Timeout;
  
    const resizeObserver = new ResizeObserver(debouncedUpdateWidth);
    resizeObserver.observe(element);
    if (scrollViewport) resizeObserver.observe(scrollViewport);
  
    window.addEventListener('resize', debouncedUpdateWidth);
    window.addEventListener('sidebar-resize', debouncedUpdateWidth);
    window.addEventListener('node-test-runner-state', debouncedUpdateWidth as EventListener);
    window.addEventListener('code-editor-state', debouncedUpdateWidth as EventListener);
  
    updateWidth();
  
    return () => {
      clearTimeout(debouncedUpdateWidth.timeout);
      resizeObserver.disconnect();
      window.removeEventListener('resize', debouncedUpdateWidth);
      window.removeEventListener('sidebar-resize', debouncedUpdateWidth);
      window.removeEventListener('node-test-runner-state', debouncedUpdateWidth as EventListener);
      window.removeEventListener('code-editor-state', debouncedUpdateWidth as EventListener);
    };
  }, []); 

  const handleError = () => {
    setHasError(true);
  };

  const getOptimalTextWidth = useMemo(() => {
    if (containerWidth > 0) {
      if (containerWidth < 500) {
        return `${Math.min(containerWidth, 450)}px`;
      } else if (containerWidth < 700) {
        return `${Math.min(containerWidth, 650)}px`;
      } else {
        return `${Math.min(containerWidth, 800)}px`;
      }
    }
    return "100%";
  }, [containerWidth]);

  if (hasError) {
    return (
      <div className="w-full p-4 bg-red-100 border border-red-400 text-red-700 rounded-md my-4">
        <p>
          There was an error rendering this content. The markdown might be malformed.
        </p>
        <pre className="mt-2 p-2 bg-white rounded overflow-auto max-w-full whitespace-pre-wrap break-all">
          {content.substring(0, 500)}{content.length > 500 ? '...' : ''}
        </pre>
      </div>
    );
  }

  return (
    <div 
      ref={textBlockRef}
      className="w-full break-words bg-card rounded-md my-4 prose prose-zinc dark:prose-invert max-w-full overflow-hidden" 
      style={{ 
        fontSize: calculateFontSize(),
        overflowWrap: "break-word",
        wordWrap: "break-word",
        wordBreak: "break-word",
        maxWidth: getOptimalTextWidth,
        width: "100%",
        transition: "max-width 0.3s ease-in-out"
      }}
    >
      {imageData && (
        <div>
        <p className="text-xl font-bold mt-5 mb-3">Generated Visualization from Python</p>
        <img className="w-100 my-3 rounded-md" src={imageData} alt="Visualization generated" />
        <p className="text-md dark:text-green-400 bg-yellow-100 dark:bg-background inline mx-auto text-red-600 my-3">Visualization generated may be incorrect, so use it with Caution</p>
        </div>
      )}

      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 {...props} className="text-2xl font-bold mt-6 mb-4 max-w-full overflow-hidden break-words" />
          ),
          h2: ({ node, ...props }) => (
            <h2 {...props} className="text-xl font-bold mt-5 mb-3 max-w-full overflow-hidden dark:text-green-400 break-words" />
          ),
          h3: ({ node, ...props }) => (
            <h3 {...props} className="text-lg font-bold mt-4 mb-2 max-w-full overflow-hidden  dark:text-green-400 break-words" />
          ),
          h4: ({ node, ...props }) => (
            <h4 {...props} className="text-base dark:text-red-400 font-semibold mt-3 mb-2 max-w-full overflow-hidden break-words" />
          ),
          p: ({ node, ...props }) => (
            <p {...props} className="my-2 mb-3 leading-relaxed break-words max-w-full overflow-hidden" />
          ),
          ul: ({ node, ...props }) => (
            <ul {...props} className="list-disc pl-6 ml-4 my-3 max-w-full overflow-hidden" />
          ),
          ol: ({ node, ...props }) => (
            <ol {...props} className="list-decimal pl-6 ml-4 my-3 max-w-full overflow-hidden" />
          ),
          li: ({ node, ...props }) => <li {...props} className="my-1 max-w-full overflow-hidden break-words" />,
          blockquote: ({ node, ...props }) => (
            <blockquote
              {...props}
              className="border-l-4 border-primary/30 pl-4 italic my-3 text-muted-foreground"
            />
          ),
          code({ node, className, children, ...props }) {
            const isInlineCode = !className || !/language-(\w+)/.test(className);
            return (
              <code
                className="bg-zinc-100 dark:bg-zinc-800 text-pink-600 dark:text-pink-400 px-1.5 py-0.5 rounded font-mono text-sm font-scale-sm"
                {...props}
              >
                {children?.toString().trim()}
              </code>
            );
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
              <table
                {...props}
                className="border-collapse table-auto w-full text-sm"
              />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead {...props} className="bg-muted" />
          ),
          tbody: ({ node, ...props }) => <tbody {...props} />,
          tr: ({ node, ...props }) => (
            <tr {...props} className="border-b border-border" />
          ),
          th: ({ node, ...props }) => (
            <th {...props} className="border px-4 py-2 text-left font-bold" />
          ),
          td: ({ node, ...props }) => (
            <td {...props} className="border px-4 py-2" />
          ),
          hr: ({ node, ...props }) => (
            <hr {...props} className="border-t border-border my-4" />
          ),
          img: ({ node, ...props }) => (
            <img
              {...props}
              className="max-w-full h-auto rounded-md my-4"
              onError={handleError}
            />
          ),
          strong: ({ node, ...props }) => (
            <strong {...props} className="font-semibold" />
          ),
          em: ({ node, ...props }) => (
            <em {...props} className="italic" />
          ),
          del: ({ node, ...props }) => (
            <del {...props} className="line-through" />
          ),
          mark: ({ node, ...props }) => (
            <mark {...props} className="bg-yellow-200" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

const CodeBlock = memo(
  ({
    code: initialCode,
    lang,
    fileName,
    blockIndex,
    copiedBlockIndex,
    onCopy,
    onAction,
    isInteractive,
    onCodeUpdate,
  }: {
    code: string;
    lang: string;
    fileName?: string;
    showLineNumbers: boolean;
    blockIndex: number;
    copiedBlockIndex: number | null;
    onCopy: (code: string, blockIndex: number) => void;
    onAction: (action: string, code: string, lang: string) => void;
    isInteractive?: boolean;
    onCodeUpdate?: (newCode: string, blockIndex: number) => void;
  }) => {
    const [code, setCode] = useState(initialCode);
    const [isHovered, setIsHovered] = useState(false);
    const [showHtmlPreview, setShowHtmlPreview] = useState(false);
    const [showPythonShell, setShowPythonShell] = useState(false);
    const [showSastAnalysis, setShowSastAnalysis] = useState(false);
    const [showTestRunner, setShowTestRunner] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const codeBlockRef = useRef<HTMLDivElement>(null);
    const [blockWidth, setBlockWidth] = useState<number | null>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    
    useEffect(() => {
      if (codeBlockRef.current) {
        let parentElement = codeBlockRef.current.parentElement;
        
        while (parentElement) {
          if (parentElement.closest('[data-radix-scroll-area-viewport]') || 
              parentElement.closest('.chat-message-list')) {
            if (parentElement instanceof HTMLElement) {
              const containerWidth = parentElement.offsetWidth;
              setContainerWidth(Math.max(containerWidth - 48, 300));
              break;
            }
          }
          
          if (parentElement.classList.contains('message-container') || 
              parentElement.classList.contains('prose') || 
              (parentElement instanceof HTMLElement && parentElement.offsetWidth > 0)) {
            if (parentElement instanceof HTMLElement) {
              const containerWidth = parentElement.offsetWidth;
              setContainerWidth(Math.max(containerWidth - 32, 300));
              break;
            }
          }
          parentElement = parentElement.parentElement;
        }
        
        const updateWidth = () => {
          if (!codeBlockRef.current) return;
          
          let parent = codeBlockRef.current.closest('[data-radix-scroll-area-viewport]');
          
          if (parent instanceof HTMLElement && parent.offsetWidth > 100) {
            const newWidth = Math.max(parent.offsetWidth - 48, 300);
            if (Math.abs(newWidth - containerWidth) > 10) {
              setContainerWidth(newWidth);
            }
            return;
          }
          
          parent = codeBlockRef.current.parentElement;
          while (parent) {
            if (parent instanceof HTMLElement && parent.offsetWidth > 100) {
              const newWidth = Math.max(parent.offsetWidth -48, 300); 
              if (Math.abs(newWidth - containerWidth) > 10) {
                setContainerWidth(newWidth);
              }
              break;
            }
            parent = parent.parentElement;
          }
          
          if (codeBlockRef.current) {
            setBlockWidth(codeBlockRef.current.offsetWidth);
          }
        };
        
        let resizeTimeout: NodeJS.Timeout;
        const debouncedUpdateWidth = () => {
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(updateWidth, 100);
        };
        
        const resizeObserver = new ResizeObserver(() => {
          debouncedUpdateWidth();
        });

        if (codeBlockRef.current) {
          resizeObserver.observe(codeBlockRef.current);
          
          const parent = codeBlockRef.current.parentElement;
          if (parent) {
            resizeObserver.observe(parent);
          }
          
          const scrollViewport = codeBlockRef.current.closest('[data-radix-scroll-area-viewport]');
          if (scrollViewport) {
            resizeObserver.observe(scrollViewport);
          }
        }
        
        window.addEventListener('sidebar-resize', debouncedUpdateWidth);
        window.addEventListener('node-test-runner-state', debouncedUpdateWidth as EventListener);
        window.addEventListener('code-editor-state', debouncedUpdateWidth as EventListener);
        
        return () => {
          clearTimeout(resizeTimeout);
          resizeObserver.disconnect();
          window.removeEventListener('sidebar-resize', debouncedUpdateWidth);
          window.removeEventListener('node-test-runner-state', debouncedUpdateWidth as EventListener);
          window.removeEventListener('code-editor-state', debouncedUpdateWidth as EventListener);
        }
      }
    }, [containerWidth]);

    const { theme } = useTheme();
    const isSystemDark = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const actualDarkMode = theme === "dark" || (theme === "system" && isSystemDark);

    const isHtml = isHtmlCode(code, lang);
    const isJavaScript = lang === "javascript" || lang === "typescript" || lang === "jsx" || lang === "tsx" || lang === "js" || lang === "ts";
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
    };

    useEffect(() => {
      setCode(initialCode);
    }, [initialCode]);

    const calculateCodeFontSize = useCallback(() => {
      return `calc(0.9rem * var(--font-scale, 1))`;
    }, [blockWidth]);

    const downloadCode = useCallback(() => {
      const fileExtension =
        languageExtensions[lang as keyof typeof languageExtensions] || "txt";
      const resolvedFileName = fileName || `code-snippet.${fileExtension}`;
      const blob = new Blob([code], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = resolvedFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Code downloaded successfully!");
    }, [code, lang, fileName]);

    const runSastAnalysis = () => {
      setShowSastAnalysis(true);
    };
    
    const runTests = () => {
      setShowTestRunner(true);
    };

    const handleCodeSave = (newCode: string) => {
      setCode(newCode);
      if (onCodeUpdate) {
        onCodeUpdate(newCode, blockIndex);
      }
      setShowEditor(false);
    };

    const handleEditorOpen = () => {
      window.dispatchEvent(
        new CustomEvent("python-shell-close", {
          detail: { forced: true },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("node-test-runner-close", {
          detail: { forced: true },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("html-preview-close", {
          detail: { forced: true },
        }),
      );
      
      setTimeout(() => {
        setShowEditor(true);
      }, 100);
    };

    const getOptimalWidth = useMemo(() => {
      if (containerWidth > 0) {
        if (containerWidth < 500) {
          return `${Math.min(containerWidth, 450)}px`;
        } else if (containerWidth < 700) {
          return `${Math.min(containerWidth, 600)}px`;
        } else {
          return `${Math.min(containerWidth, 800)}px`;
        }
      }
      
      return "min(100%, 600px)";
    }, [containerWidth]);

    return (
      <div
        ref={codeBlockRef}
        className={cn(
          "relative mb-0 mt-0 group shadow-md rounded-md",
          isInteractive &&
            "hover:ring-1 hover:ring-primary/50 transition-all duration-200"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          fontSize: calculateCodeFontSize(),
          transition: "font-size 0.3s ease-in-out, max-width 0.3s ease-in-out",
          maxWidth: getOptimalWidth,
          width: "100%"
        }}
      >
        {isInteractive && (
          <div
            className={cn(
              "bg-zinc-800/90 border-b border-zinc-700 p-1  transition-opacity duration-200",
              isHovered ? "opacity-100" : "opacity-0 "
            )}
          >
            <QuickActionBar
              onAction={(action) => onAction(action, code, lang)}
              language={lang}
              code={code}
            />
          </div>
        )}

        <div className="bg-zinc-800  text-zinc-300 text-xs px-4 py-2 flex justify-between items-center font-mono overflow-x-auto scrollbar-hide">
          <div className="flex bg-zinc-800 border-2 border-zinc-700  items-center gap-2">
            {fileName ? (
              <span className="px-2 font-scale-sm">
                {fileName} <span className="opacity-50 px-2">({lang})</span>
              </span>
            ) : (
              <span className="px-2 font-scale-sm">{lang}</span>
            )}
            {isHtml && (
              <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded text-xs">
                HTML
              </span>
            )}
            {lang === "python" && (
              <span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded text-xs">
                Python
              </span>
            )}
          </div>
          <div className="flex bg-zinc-800 items-center gap-2">
            {isHtml && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-emerald-400  text-xs"
                onClick={() => {
                  setShowHtmlPreview(true);
                }}
              >
                <Play className="h-3.5 w-3.5 mr-1" />
                Run
              </Button>
            )}
            {lang === "python" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-blue-400 text-xs"
                onClick={() => {
                  setTimeout(() => {
                    setShowPythonShell(true);
                  }, 100);
                }}
              >
                <Play className="h-3.5 w-3.5 mr-1" />
                Run
              </Button>
            )}
            
            {isJavaScript && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-amber-400 text-xs"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("python-shell-close", {
                      detail: { forced: true },
                    }),
                  );
                  window.dispatchEvent(
                    new CustomEvent("code-editor-close", {
                      detail: { forced: true },
                    }),
                  );
                  setTimeout(() => {
                    runTests();
                  }, 100);
                }}
              >
                <Play className="h-3.5 w-3.5 mr-1" />
                Test
              </Button>
            )}
            
            {(lang === "javascript" ||
              lang === "typescript" ||
              lang === "python" ||
              lang === "java") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-purple-400  text-xs"
                onClick={() => {
                  runSastAnalysis();
                }}
              >
                <Shield className="h-3.5 w-3.5 mr-1" />
                SAST
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-zinc-400 text-xs"
              onClick={() => {
                setTimeout(() => {
                  handleEditorOpen();
                }, 100);
              }}
            >
              <Edit className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
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
                          fileName ||
                          `code.${
                            languageExtensions[
                              lang as keyof typeof languageExtensions
                            ] || "txt"
                          }`,
                      },
                    })
                  )
                }
              >
                <ArrowDown className="h-3.5 w-3.5 mr-1" />
                Use
              </Button>
            )}
            <span className="text-xs opacity-70 hidden sm:inline-block">
              {copiedBlockIndex === blockIndex ? "Copied..." : ""}
            </span>
          </div>
        </div>
        <PreformattedCode
          code={code}
          language={lang}
          darkMode={actualDarkMode}
          className="font-scale-base"
          customStyle={{
            fontSize: "inherit",
            maxWidth: "100%",
            transition: "font-size 0.3s ease-in-out",
          }}
        />
        {showHtmlPreview && (
          <HtmlPreview
            htmlContent={code}
            isOpen={showHtmlPreview}
            onClose={() => setShowHtmlPreview(false)}
          />
        )}
        {lang === "python" && showPythonShell && (
          <PythonShell
            code={code}
            isOpen={showPythonShell}
            onClose={() => setShowPythonShell(false)}
          />
        )}
        {showSastAnalysis && (
          <CodeSast
            code={code}
            language={lang}
            onClose={() => setShowSastAnalysis(false)}
          />
        )}
        {showTestRunner && (
          <NodeTestRunner
            isOpen={showTestRunner}
            onClose={() => setShowTestRunner(false)}
            codeSnippet={code}
          />
        )}
        {showEditor && (
          <CodeEditorCanvas
           
            code={code}
            language={lang}
            isOpen={showEditor}
            onClose={() => setShowEditor(false)}
            onSave={handleCodeSave}
          />
        )}
      </div>
    );
  }
);

CodeBlock.displayName = "CodeBlock";
TextBlock.displayName = "TextBlock";

function MessageContent({
  content: initialContent,
  imageData,
  showLineNumbers,
  onCodeAction,
  isInteractive,
  onContentUpdate,
}: MessageContentProps) {
  const [content, setContent] = useState(initialContent);
  const textRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [safeMode, setSafeMode] = useState(false);
  const [safeModeContent, setSafeModeContent] = useState("");
  const [showLongContentWarning, setShowLongContentWarning] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const [hasRenderError, setHasRenderError] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  
  const sanitizeContent = useCallback((rawContent: string): string => {
    if (!rawContent || typeof rawContent !== 'string') return ""
    
    try {
      const countBackticks = (str: string): number => {
        return (str.match(/```/g) || []).length;
      };
      
      let fixedContent = rawContent;
      
      if (countBackticks(fixedContent) % 2 !== 0) {
        fixedContent += "\n```";
      }
      
      const codeBlockRegex = /```([^`]*?)(?!```)/g;
      fixedContent = fixedContent.replace(codeBlockRegex, (match, code) => {
        if (!match.endsWith('```')) {
          return `${match}\n\`\`\``;
        }
        return match;
      });
      
      fixedContent = fixedContent.replace(/````+/g, '```');
      
      fixedContent = fixedContent.replace(/```(\w+)/g, '``` $1');
      
      const maxLineLength = 2000;
      fixedContent = fixedContent.split('\n').map(line => {
        if (line.length > maxLineLength) {
          return line.substring(0, maxLineLength) + '... [line truncated]';
        }
        return line;
      }).join('\n');
      
      const maxContentLength = 100000;
      if (fixedContent.length > maxContentLength) {
        fixedContent = fixedContent.substring(0, maxContentLength) + '\n\n... [content truncated for performance]';
      }
      
      return fixedContent;
    } catch (e) {
      console.error("Error sanitizing content:", e);
      setErrorDetails(e instanceof Error ? e.message : "Unknown error");
      return rawContent.substring(0, 1000) + "... [Error processing content]";
    }
  }, []);
  
  useEffect(() => {
    try {
      if (!initialContent) {
        setContent("");
        return;
      }
      
      const contentStr = typeof initialContent === 'string' ? initialContent : JSON.stringify(initialContent);
      
      if (contentStr.length > 50000) {
        setSafeMode(true);
        setSafeModeContent(contentStr.substring(0, 500) + "... [Content truncated for performance]");
        setShowLongContentWarning(true);
      } else {
        const sanitized = sanitizeContent(contentStr);
        setContent(sanitized);
        setSafeMode(false);
      }
      
      setHasRenderError(false);
      setErrorDetails(null);
    } catch (e) {
      console.error("Error processing content:", e);
      setHasRenderError(true);
      setErrorDetails(e instanceof Error ? e.message : "Unknown error");
      setSafeMode(true);
      setSafeModeContent("Error processing content. Please try refreshing the page.");
    }
  }, [initialContent, sanitizeContent]);
  
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      event.preventDefault();
      setHasRenderError(true);
      setErrorDetails(event.error?.message || event.message || "Unknown error");
      setSafeMode(true);
      
      const contentStr = typeof initialContent === 'string' ? initialContent : 
                         (initialContent ? JSON.stringify(initialContent) : "");
      setSafeModeContent(contentStr.substring(0, 500) + "... [Content truncated due to render issues]");
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [initialContent]);

  const [copiedBlockIndex, setCopiedBlockIndex] = useState<number | null>(null);

  const calculateFontScale = useCallback(() => {
    if (containerWidth) {
      if (containerWidth < 400) return 0.85;
      if (containerWidth < 600) return 0.9;
      if (containerWidth < 800) return 0.95;
      if (containerWidth < 1024) return 1.0;
      return 1.05;
    }

    return 1;
  }, [containerWidth]);


  const getOptimalContentWidth = useMemo(() => {
    if (containerWidth > 0) {
      return `${Math.min(containerWidth - 16, 850)}px`;
    }
    return "100%";
  }, [containerWidth]);

  const handleCodeUpdate = (newCode: string, blockIndexToUpdate: number) => {
    const codeBlockRegex = /^(```(?:[\s\S]*?)```)/gm;
    let currentBlockIdx = 0;
    const newContent = content.replace(codeBlockRegex, (matchedBlock) => {
      if (currentBlockIdx === blockIndexToUpdate) {
        currentBlockIdx++;
        const firstLineBreak = matchedBlock.indexOf('\n');
        const header = firstLineBreak !== -1 ? matchedBlock.substring(0, firstLineBreak) : matchedBlock;
        return `${header}\n${newCode.trim()}\n\`\`\``;
      }
      currentBlockIdx++;
      return matchedBlock;
    });

    setContent(newContent);
    if (onContentUpdate) {
      onContentUpdate(newContent);
    }
  };

  useEffect(() => {
    const handleCopyEvent = (e: ClipboardEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const selectedNode = selection.anchorNode?.parentElement;
      const codeBlockElement = selectedNode?.closest("div[class*='react-syntax-highlighter'] pre, div > p[class*='bg-muted']");


      if (codeBlockElement) {
        const isSyntaxHighlightedBlock = codeBlockElement.tagName === 'PRE';

        if (showLineNumbers && isSyntaxHighlightedBlock) {
            e.preventDefault();
            const selectedText = selection.toString();
            const lines = selectedText.split("\n");
            const cleanedLines = lines.map((line) => {

            return line.replace(/^\s*\d+(?:\s{2,}|\t)\s*/, "");
            });
            const cleanedText = cleanedLines.join("\n");
            e.clipboardData?.setData("text/plain", cleanedText);
        }

      }
    };

    document.addEventListener("copy", handleCopyEvent);
    return () => document.removeEventListener("copy", handleCopyEvent);
  }, [showLineNumbers]);


  const getSavedSnippets = (): SavedSnippet[] => {
    try {
      const raw = localStorage.getItem("code-snippets");
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      console.error("Error reading snippets:", error);
      return [];
    }
  };

  const saveSnippets = (snippets: SavedSnippet[]) => {
    try {
      localStorage.setItem("code-snippets", JSON.stringify(snippets));
    } catch (error) {
      console.error("Error saving snippets:", error);
    }
  };

  const addSnippet = (snippet: SavedSnippet) => {
    const snippets = getSavedSnippets();
    snippets.push(snippet);
    saveSnippets(snippets);
  };

  const addSnippetToLocalStorage = (
    snippetName: string,
    snippetDescription: string,
    codeToAdd: string
  ) => {
    const humanReadableDate = new Date().toLocaleString();
    addSnippet({
      id: Date.now().toString(),
      name: snippetName,
      description: `${snippetDescription} - ${humanReadableDate}`,
      code: codeToAdd,
    });
    toast.success("Snippet added to local storage!");
  };

  const copyCodeBlock = useCallback((codeToCopy: string, blockIndex: number) => {
    navigator.clipboard
      .writeText(codeToCopy)
      .then(() => {
        setCopiedBlockIndex(blockIndex);
        toast.success("Code was copied");
        setTimeout(() => setCopiedBlockIndex(null), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy code:", err);
        toast.error("Failed to copy the code");
      });
  }, []);

  const isLikelyCode = (text: string) => {

    if (text.length < 10) return false;

    const codePatterns = [
      /\b(if|else|for|while|function|class|import|export|return|const|let|var)\b/,
      /[{}[\](),;:]/,
      /=>|\+\+|--|\+=|-=|\*=|\/=/,
      /\/\/|\/\*|\*\//,
      /[a-zA-Z_][a-zA-Z0-9_]*\s*\(/,
      /[a-zA-Z_][a-zA-Z0-9_]*\s*=/,
    ];

    const matches = codePatterns.filter(pattern => pattern.test(text));
    if (matches.length < 2) return false;

    const brackets = text.match(/[{}[\]]/g) || [];
    const stack: string[] = [];
    const pairs: Record<string, string> = { '{': '}', '[': ']' };

    for (const bracket of brackets) {
      if (bracket in pairs) {
        stack.push(bracket);
      } else {
        const last = stack.pop();
        if (!last || pairs[last] !== bracket) {
          return false;
        }
      }
    }

    return stack.length === 0;
  };

  const detectCodeLanguage = (text: string): string | null => {
    const patterns: Record<string, RegExp[]> = {
      javascript: [
        /\b(import|export|const|let|var|function|class)\b/,
        /=>|\{|\}/,
        /console\.log/,
      ],
      typescript: [
        /\b(interface|type|enum|namespace)\b/,
        /: (string|number|boolean|any|void|never)/,
        /\b(import|export|const|let|var|function|class)\b/,
      ],
      python: [
        /\b(def|class|import|for|while|if|else|elif|return)\b/,
        /:/,
        /\b(True|False|None)\b/,
      ],
      java: [
        /\b(public|private|protected|class|static|void|String|int|System\.out\.println)\b/,
        /[{};]/,
      ],
      html: [
        /<[a-z][^>]*>/i,
        /<\/[a-z][^>]*>/i,
        /<[a-z][^>]*\/>/i,
      ],
      css: [
        /[a-zA-Z-]+\s*:/,
        /{[^}]*}/,
        /#[0-9a-fA-F]{3,6}/,
      ],
    };

    const scores: Record<string, number> = {};
    for (const [lang, langPatterns] of Object.entries(patterns)) {
      scores[lang] = langPatterns.filter(pattern => pattern.test(text)).length;
    }

    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) return null;

    return Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] || null;
  };

  const handleCodeSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    const anchorNode = selection.anchorNode as Element;
    const codeBlockElement = anchorNode?.closest?.("div[class*='react-syntax-highlighter'] pre, div > p[class*='bg-muted']");
    if (codeBlockElement) return;

    if (isLikelyCode(selectedText)) {
      const detectedLang = detectCodeLanguage(selectedText);
      if (!detectedLang) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const menu = document.createElement("div");
      menu.className = "fixed z-50 bg-background border rounded-md shadow-lg p-1 flex gap-1";
      menu.style.left = `${Math.max(0, rect.left)}px`;
      menu.style.top = `${rect.bottom + 5}px`;

      const actions = [
        {
          label: "Explain",
          action: () => onCodeAction("explain-code", selectedText, detectedLang),
        },
        {
          label: "Modify",
          action: () => {
            window.dispatchEvent(
              new CustomEvent("use-code", {
                detail: {
                  code: selectedText,
                  language: detectedLang,
                  fileName: `snippet.${detectedLang}`,
                },
              })
            );
          },
        },
        {
          label: "Save Snippet",
          action: () => {
            addSnippetToLocalStorage(
              "Selected Code Snippet",
              `Saved from selection (${detectedLang})`,
              selectedText
            );
          },
        },
      ];

      actions.forEach((actionItem) => {
        const button = document.createElement("button");
        button.className =
          "px-2 py-1 text-xs rounded hover:bg-muted flex items-center gap-1";
        button.textContent = actionItem.label;
        button.onclick = (e) => {
          e.stopPropagation();
          actionItem.action();
          if (document.body.contains(menu)) {
            document.body.removeChild(menu);
          }
        };
        menu.appendChild(button);
      });

      const closeButton = document.createElement("button");
      closeButton.className = "px-1.5 py-0.5 text-xs rounded hover:bg-muted flex items-center justify-center";
      closeButton.innerHTML = "&times;";
      closeButton.setAttribute("aria-label", "Close menu");
      closeButton.onclick = (e) => {
        e.stopPropagation();
        if (document.body.contains(menu)) {
          document.body.removeChild(menu);
        }
      };
      menu.appendChild(closeButton);
      document.body.appendChild(menu);

      const handleClickOutside = (e: MouseEvent) => {
        if (!menu.contains(e.target as Node)) {
          if (document.body.contains(menu)) {
            document.body.removeChild(menu);
          }
          document.removeEventListener("mousedown", handleClickOutside);
          window.removeEventListener("blur", handleBlur);
        }
      };
      const handleBlur = () => {
         if (document.body.contains(menu)) {
            document.body.removeChild(menu);
          }
          document.removeEventListener("mousedown", handleClickOutside);
          window.removeEventListener("blur", handleBlur);
      }
      setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
        window.addEventListener("blur", handleBlur);
      }, 0);
    }
  };
  useEffect(() => {
    const currentRef = textRef.current;
    const handleMouseUp = () => {

      setTimeout(handleCodeSelection, 50);
    };

    currentRef?.addEventListener("mouseup", handleMouseUp);
    return () => {
      currentRef?.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onCodeAction, content]);

  const multilineRegex = /^[ \t]*(\`{3,})[ \t]*([^\`\r\n]*?)[ \t]*\n([\s\S]*?)(\1)[ \t]*$/gm;
  
  const unclosedCodeBlockRegex = /^[ \t]*(\`{3,})[ \t]*([^\`\r\n]*?)[ \t]*\n([\s\S]*?)($)/gm;
  
  const inlineSameLineRegex = /(\`{3,})[ \t]*([^\s\`\r\n]+)[ \t]+([\s\S]*?)[ \t]*\1/g;

  const parts: React.ReactNode[] = [];
  const safeContent = typeof content === "string" ? content : "";

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partKeyIndex = 0;
  let codeBlockRenderIndex = 0;
  
  while ((match = multilineRegex.exec(safeContent)) !== null) {
    const [fullMatch, openingFence, langAndFileRaw = "", rawCodeContent] = match;

    if (match.index > lastIndex) {
      const beforeCode = safeContent.slice(lastIndex, match.index);
      if (beforeCode.trim()) {
        parts.push(
          <TextBlock key={`part-${partKeyIndex++}`} content={beforeCode} imageData={imageData} />
        );
      }
    }

    let lang = "";
    let fileName = "";
    const langAndFile = langAndFileRaw.trim();

    if (langAndFile) {
        const firstSpaceIndex = langAndFile.indexOf(" ");
        if (firstSpaceIndex !== -1) {
            lang = langAndFile.substring(0, firstSpaceIndex);
            const rest = langAndFile.substring(firstSpaceIndex + 1).trim();
            if (rest.toLowerCase().startsWith("file:")) {
                fileName = rest.substring(5).trim();
            } else {
                lang = langAndFile;
            }
        } else {
            lang = langAndFile;
        }
    }

    const normalizedLang = normalizeLang(lang || "output");
    let code = rawCodeContent.replace(/\n$/, '');
    if (!fileName && code.startsWith("File:")) {
      const firstLineBreak = code.indexOf("\n");
      if (firstLineBreak !== -1) {
        fileName = code.substring(5, firstLineBreak).trim();
        code = code.substring(firstLineBreak + 1);
      }
    }

    code = code.trim();

    if (normalizedLang === "codeandexplanation") {
      parts.push(
        <Markdown key={`part-${partKeyIndex++}`} remarkPlugins={[remarkGfm]}>
          {code}
        </Markdown>
      );
      codeBlockRenderIndex++;
    } else {
      parts.push(
        <CodeBlock
          key={`part-${partKeyIndex++}`}
          code={code}
          lang={normalizedLang}
          fileName={fileName}
          showLineNumbers={showLineNumbers}
          blockIndex={codeBlockRenderIndex}
          copiedBlockIndex={copiedBlockIndex}
          onCopy={copyCodeBlock}
          onAction={onCodeAction}
          isInteractive={isInteractive}
          onCodeUpdate={handleCodeUpdate}
        />
      );
      codeBlockRenderIndex++;
    }
    lastIndex = multilineRegex.lastIndex;
  }
  
  unclosedCodeBlockRegex.lastIndex = lastIndex;
  while ((match = unclosedCodeBlockRegex.exec(safeContent)) !== null) {
    if (match.index < lastIndex) continue;
    
    const [fullMatch, openingFence, langAndFileRaw = "", rawCodeContent] = match;

    if (match.index > lastIndex) {
      const beforeCode = safeContent.slice(lastIndex, match.index);
      if (beforeCode.trim()) {
        parts.push(
          <TextBlock key={`part-${partKeyIndex++}`} content={beforeCode} imageData={imageData} />
        );
      }
    }

    let lang = langAndFileRaw.trim() || "output";
    const normalizedLang = normalizeLang(lang);
    let code = rawCodeContent.trim();

    parts.push(
      <CodeBlock
        key={`part-${partKeyIndex++}`}
        code={code}
        lang={normalizedLang}
        fileName={""}
        showLineNumbers={showLineNumbers}
        blockIndex={codeBlockRenderIndex}
        copiedBlockIndex={copiedBlockIndex}
        onCopy={copyCodeBlock}
        onAction={onCodeAction}
        isInteractive={isInteractive}
        onCodeUpdate={handleCodeUpdate}
      />
    );
    codeBlockRenderIndex++;
    lastIndex = unclosedCodeBlockRegex.lastIndex;
  }

  let trailingContent = safeContent.slice(lastIndex);

  inlineSameLineRegex.lastIndex = 0;
  let currentTrailingIndex = 0;
  let tempTrailingParts: React.ReactNode[] = [];

  while ((match = inlineSameLineRegex.exec(trailingContent)) !== null) {
    if (match.index > currentTrailingIndex) {
        const textBeforeInline = trailingContent.slice(currentTrailingIndex, match.index);
        if (textBeforeInline.trim()){
             tempTrailingParts.push(
                <TextBlock key={`part-${partKeyIndex++}`} content={textBeforeInline} imageData={imageData} />
             );
        }
    }

    const [_fullMatch, _backticks, langRaw = "text", rawCode] = match;
    const normalizedLang = normalizeLang(langRaw.trim() || "text");
    const code = rawCode?.trim();

    if (normalizedLang === "codeandexplanation") {
         tempTrailingParts.push(
            <Markdown key={`part-${partKeyIndex++}`} remarkPlugins={[remarkGfm]}>
                {code}
            </Markdown>
         );
         codeBlockRenderIndex++;
    } else {
         tempTrailingParts.push(
            <CodeBlock
                key={`part-${partKeyIndex++}`}
                code={code}
                lang={normalizedLang}
                showLineNumbers={false}
                blockIndex={codeBlockRenderIndex}
                copiedBlockIndex={copiedBlockIndex}
                onCopy={copyCodeBlock}
                onAction={onCodeAction}
                isInteractive={isInteractive}
                onCodeUpdate={handleCodeUpdate}
            />
         );
         codeBlockRenderIndex++;
    }
    currentTrailingIndex = inlineSameLineRegex.lastIndex;
  }

  parts.push(...tempTrailingParts);

  if (currentTrailingIndex < trailingContent.length) {
    const finalText = trailingContent.slice(currentTrailingIndex);
    if (finalText.trim()) {
      parts.push(
        <TextBlock key={`part-${partKeyIndex++}`} content={finalText} imageData={parts.length === 0 ? imageData : undefined} />
      );
    }
  }
  
  if (parts.length === 0 && imageData && !safeContent.trim()) {
    parts.push(<TextBlock key={`part-${partKeyIndex++}`} content="" imageData={imageData} />);
  }

  if (safeMode || hasRenderError) {
    return (
      <div className="w-full break-words">
        <div className="p-4 rounded-md my-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <h3 className="font-medium text-amber-800 dark:text-amber-200">
            {hasRenderError ? "Rendering Error" : "Content Safety Mode"}
          </h3>
          <p className="text-sm mt-2 text-amber-700 dark:text-amber-300">
            {hasRenderError 
              ? `There was an error rendering this content: ${errorDetails || "Unknown error"}` 
              : "This content is too large to display fully and has been truncated for performance."}
          </p>
          <div className="mt-3 p-2 bg-white dark:bg-gray-800 rounded overflow-auto max-h-[200px]">
            <pre className="text-xs whitespace-pre-wrap break-all">
              {safeModeContent}
            </pre>
          </div>
          {showLongContentWarning && !hasRenderError && (
            <Button 
              size="sm" 
              variant="outline" 
              className="mt-3" 
              onClick={() => {
                setSafeMode(false);
                setContent(typeof initialContent === 'string' ? initialContent : JSON.stringify(initialContent));
                setIsExpanded(true);
              }}
            >
              Show Full Content (May Affect Performance)
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={textRef}
      className="w-full break-words overflow-hidden"
      style={{
        maxWidth: getOptimalContentWidth,
        width: "100%",
        transition: "font-size 0.3s ease-in-out, max-width 0.3s ease-in-out",
        fontSize: containerWidth ? `calc(${calculateFontScale()} * 1rem * var(--font-scale, 1))` : undefined
      }}
    >
      {parts.length > 0 ? (
        parts.map((part, index) => (
          <div key={index} className="mb-4 last:mb-0 w-full overflow-x-hidden">
            {part}
          </div>
        ))
      ) : (
        <div className="text-muted-foreground p-3">No content to display.</div>
      )}
    </div>
  );
}

export default memo(MessageContent);

