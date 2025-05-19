"use client";

import { Button } from "@/components/ui/button";
import { Code, FileText, Bug, SparkleIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChat } from "@/context/chat-context";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function OutputFormatToggle({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { preferences, setPreferences } = useChat();

  return (
    <TooltipProvider>
      <div className="flex flex-col md:flex-row items-center justify-center  gap-1 bg-muted/50 p-0.5 rounded-md">
        <Select 
          value={preferences.providerModel || "gemini"} 
          onValueChange={(value) => setPreferences({ ...preferences, providerModel: value })}
        >
          <SelectTrigger className="w-max-[100px] h-8 text-xs">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gemini">Gemini</SelectItem>
            <SelectItem value="chatgpt">ChatGPT</SelectItem>
            <SelectItem value="claude">Claude</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={value === "codeOnly" ? "default" : "ghost"}
                size="sm"
                className="h-8 gap-1 px-2"
                onClick={() => onChange("codeOnly")}
              >
                <Code className="h-4 w-4" />
                <span className="sr-only md:not-sr-only text-xs md:inline-block">Code</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Show only code snippets</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={value === "explanationOnly" ? "default" : "ghost"}
                size="sm"
                className="h-8 gap-1 px-2"
                onClick={() => onChange("explanationOnly")}
              >
                <FileText className="h-4 w-4" />
                <span className="sr-only md:not-sr-only text-xs  md:inline-block">Explain</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Show only explanations</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={value === "codeAndExplanation" ? "default" : "ghost"}
                size="sm"
                className="h-8 gap-1 px-2"
                onClick={() => onChange("codeAndExplanation")}
              >
                <Bug className="h-4 w-4" />
                <span className="sr-only md:not-sr-only text-xs md:inline-block">Balanced</span>
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
