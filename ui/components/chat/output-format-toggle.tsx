"use client";

import { Button } from "@/components/ui/button";
import { Code, FileText, Bug } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function OutputFormatToggle({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <TooltipProvider>
      <div className="flex flex-col md:flex-row items-center justify-center md:bg-muted/40 rounded-xl md:shadow-md md:ring-1 md:ring-muted/30">
        <div className="flex items-center">
          {/* Code Only Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`h-9 gap-1 px-3 transition-all rounded-none rounded-l-md ${
                  value === "codeOnly"
                    ? "border-b-2 border-b-green-300 dark:border-b-green-300"
                    : "border-b-2 border-b-transparent"
                }`}
                onClick={() => onChange("codeOnly")}
              >
                <Code className="h-4 w-4" />
                <span className="hidden md:inline-block text-xs font-medium">Code</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Show only code snippets</p>
            </TooltipContent>
          </Tooltip>

          {/* Explanation Only Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`h-9 gap-1 px-3 transition-all rounded-none ${
                  value === "explanationOnly"
                    ? "border-b-2 border-b-green-600 dark:border-b-green-600"
                    : "border-b-2 border-b-transparent"
                }`}
                onClick={() => onChange("explanationOnly")}
              >
                <FileText className="h-4 w-4" />
                <span className="hidden md:inline-block text-xs font-medium">Explain</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Show only explanations</p>
            </TooltipContent>
          </Tooltip>

          {/* Code + Explanation Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`h-9 gap-1 px-3 transition-all rounded-none rounded-r-md ${
                  value === "codeAndExplanation"
                    ? "border-b-2 border-b-blue-500 dark:border-b-blue-400"
                    : "border-b-2 border-b-transparent"
                }`}
                onClick={() => onChange("codeAndExplanation")}
              >
                <Bug className="h-4 w-4" />
                <span className="hidden md:inline-block text-xs font-medium">Balanced</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Show code and explanations together</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
