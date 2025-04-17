"use client"

import { Button } from "@/components/ui/button"
import { Code, FileText, CodepenIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface OutputFormatToggleProps {
  value: "codeAndExplanation" | "codeOnly" | "explanationOnly"
  onChange: (value: "codeAndExplanation" | "codeOnly" | "explanationOnly") => void
}

export function OutputFormatToggle({ value, onChange }: OutputFormatToggleProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-md">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={value === "codeOnly" ? "destructive" : "ghost"}
              size="sm"
              className="h-8 gap-1 px-2"
              onClick={() => onChange("codeOnly")}
            >
              <Code className="h-4 w-4" />
              <span className="sr-only md:not-sr-only md:inline-block">Code Only</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Show only code without explanations</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={value === "explanationOnly" ? "destructive" : "ghost"}
              size="sm"
              className="h-8 gap-1 px-2"
              onClick={() => onChange("explanationOnly")}
            >
              <FileText className="h-4 w-4" />
              <span className="sr-only md:not-sr-only md:inline-block">Explanation Only</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Show only explanations without code</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={value === "codeAndExplanation" ? "destructive" : "ghost"}
              size="sm"
              className="h-8 gap-1 px-2"
              onClick={() => onChange("codeAndExplanation")}
            >
              <CodepenIcon className="h-4 w-4" />
              <span className="sr-only md:not-sr-only md:inline-block">Code & Explanation</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Show both code and explanations</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
