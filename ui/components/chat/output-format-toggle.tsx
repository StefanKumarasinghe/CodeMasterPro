"use client";

import { Button } from "@/components/ui/button";
import { Code, FileText, Bug } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChat } from "@/context/chat-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      <div className="flex flex-col md:flex-row items-center justify-center gap-2 p-1 bg-muted/40 rounded-xl shadow-md ring-1 ring-muted/30">
        <div className="flex items-center gap-2">
                  <Select
          value={preferences.providerModel || "gemini"}
          onValueChange={(value) =>
            setPreferences({ ...preferences, providerModel: value })
          }
        >
          <SelectTrigger className="max-w-[140px] h-9 text-sm font-medium bg-background border border-muted rounded-lg shadow-sm hover:ring-1 hover:ring-ring focus:outline-none focus:ring-2 focus:ring-primary transition">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent className="text-sm">
            <SelectItem value="gemini">Gemini</SelectItem>
            <SelectItem value="chatgpt">ChatGPT</SelectItem>
            <SelectItem value="claude">Claude</SelectItem>
          </SelectContent>
          </Select>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={value === "codeOnly" ? "default" : "ghost"}
                size="sm"
                className="h-9 gap-1 px-3 transition-all"
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

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={value === "explanationOnly" ? "default" : "ghost"}
                size="sm"
                className="h-9 gap-1 px-3 transition-all"
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

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={value === "codeAndExplanation" ? "default" : "ghost"}
                size="sm"
                className="h-9 gap-1 px-3 transition-all"
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
