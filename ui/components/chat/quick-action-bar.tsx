"use client"

import { Button } from "@/components/ui/button"
import { Code, Bug, Zap, FileCode, Wand2, Copy } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "@/utils/toast-util"
import { useState } from "react"

interface QuickActionBarProps {
  onAction: (action: string, code: string, lang: string) => void
  language: string
  code?: string
}

export function QuickActionBar({ onAction, language, code = "" }: QuickActionBarProps) {
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = () => {
    if (!code) return

    navigator.clipboard
      .writeText(code)
      .then(() => {
        toast.success("Code copied to clipboard")
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
      })
      .catch((err) => {
        console.error("Failed to copy: ", err)
        toast.error("Could not copy to clipboard")
      })
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-hide">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2 text-xs"
              onClick={handleCopy}
              disabled={isCopied || !code}
            >
              <Copy className="h-3.5 w-3.5" />
              <span>{isCopied ? "Copied!" : "Copy"}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copy code to clipboard</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2 text-xs"
              onClick={() => onAction("explain-code", code, language)}
            >
              <Code className="h-3.5 w-3.5" />
              <span>Explain</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Explain this code without showing it again</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2 text-xs"
              onClick={() => onAction("debug-code", code, language)}
            >
              <Bug className="h-3.5 w-3.5" />
              <span>Debug</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Debug this code without showing it again</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2 text-xs"
              onClick={() => onAction("optimize-code", code, language)}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Optimize</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Optimize this code without showing it again</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2 text-xs"
              onClick={() => onAction("add-comments", code, language)}
            >
              <FileCode className="h-3.5 w-3.5" />
              <span>Add Comments</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Add comments to this code without showing it again</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2 text-xs"
              onClick={() => onAction("generate-tests", code, language)}
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span>Generate Tests</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Generate tests for this code without showing it again</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
