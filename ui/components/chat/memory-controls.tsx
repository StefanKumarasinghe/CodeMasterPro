"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, Trash2, BrainCircuit, Brain, Cpu, Zap } from "lucide-react";
import { API_ENDPOINT } from "@/config/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/utils/toast-util";
import { useChat } from "@/context/chat-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function MemoryControls() {
  const { setMessages, modelType, setModelType, setMcp, mcp } = useChat();
  const [isLoading, setIsLoading] = useState(false);

  const forgetMemory = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_ENDPOINT}/memory/clear`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to clear memory");
      }

      window.dispatchEvent(
        new CustomEvent("code-editor-state", {
          detail: { isOpen: false, width: 0 },
        })
      );
      window.dispatchEvent(
        new CustomEvent("python-shell-state", {
          detail: { isOpen: false, width: 0 },
        })
      );
      window.dispatchEvent(new CustomEvent("memory-cleared"));

      setMessages([]);
      toast.success("Memory cleared successfully");
    } catch (error) {
      console.error("Failed to clear memory:", error);
      toast.error("Failed to clear memory");
    } finally {
      setIsLoading(false);
    }
  };

  const changeModel = async (type: string) => {
    try {
      setIsLoading(true);
      setModelType(type);
      if (["quick"].includes(mcp)) {
        setMcp("auto");
      }
      toast.success(`Model changed to ${getModelDisplayName(type)}`);
    } catch (error) {
      console.error("Failed to change model:", error);
      toast.error("Failed to change model");
    } finally {
      setIsLoading(false);
    }
  };

  const getModelDisplayName = (type = modelType) => {
    if (isLoading) return "Loading...";
    switch (type) {
      case "advanced":
        return "Reasoner Pro";
      case "fast":
        return "Gemini Flash";
      case "quick-think":
        return "Quick Reasoner";
      case "pro":
      default:
        return "Gemini Pro";
    }
  };

  const getModelIcon = () => {
    switch (modelType) {
      case "advanced":
        return <Brain className="h-4 w-4 mr-2" />;
      case "fast":
        return <Zap className="h-4 w-4 mr-2" />;
      case "quick-think":
        return <Cpu className="h-4 w-4 mr-2" />;
      case "pro":
      default:
        return <BrainCircuit className="h-4 w-4 mr-2" />;
    }
  };

  const renderModelOption = (type: string, name: string, description: string, icon: React.ReactElement) => (
    <DropdownMenuItem 
      onClick={() => changeModel(type)}
      className={`flex items-center px-3 py-2 cursor-pointer ${modelType === type ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
    >
      <div className="flex items-center">
        {icon}
        <div className="flex flex-col text-left">
          <span className="font-medium">{name}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{description}</span>
        </div>
      </div>
    </DropdownMenuItem>
  );

  return (
    <div className="flex items-center gap-3 relative">
      <TooltipProvider delayDuration={300}>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 px-4 gap-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
                  disabled={isLoading}
                >
                  {getModelIcon()}
                  <span className="hidden sm:inline font-medium">
                    {getModelDisplayName()}
                  </span>
                  <span className="sm:hidden">Model</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Select AI model</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent className="w-64" align="end">
            {renderModelOption(
              "fast",
              "Gemini Flash",
              "Fast responses, basic tasks",
              <Zap className="h-5 w-5 mr-3 text-yellow-500" />
            )}
            {renderModelOption(
              "pro",
              "Gemini Pro",
              "Balanced performance (1min)",
              <BrainCircuit className="h-5 w-5 mr-3 text-blue-500" />
            )}
            <DropdownMenuSeparator />
            {renderModelOption(
              "quick-think",
              "Quick Reasoner",
              "Enhanced reasoning (1min+)",
              <Cpu className="h-5 w-5 mr-3 text-purple-500" />
            )}
            {renderModelOption(
              "advanced",
              "Reasoner Pro",
              "Complex tasks, deep analysis (3min+)",
              <Brain className="h-5 w-5 mr-3 text-green-500" />
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={forgetMemory}
              variant="ghost"
              size="sm"
              className="h-10 w-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
              disabled={isLoading}
            >
              <Trash2 className="h-4 w-4 text-slate-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Clear conversation memory</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}