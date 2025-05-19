"use client";

import type React from "react";
import { Button } from "@/components/ui/button";
import {ChevronDown,BrainCircuit,BrainCogIcon, MessageCircleDashed ,BrainIcon} from "lucide-react";
import { API_ENDPOINT } from "@/config/constants";
import {Tooltip,TooltipContent,TooltipProvider,TooltipTrigger} from "@/components/ui/tooltip";
import { useState } from "react";
import { toast } from "@/utils/toast-util";
import { useChat } from "@/context/chat-context";

import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger} from "@/components/ui/dropdown-menu";


export function MemoryControls() {
  const { setMessages, modelType, setModelType , setMcp, mcp} = useChat();
  const [isLoading, setIsLoading] = useState(false);

  const forgetMemory = async () => {
    try {
      const response = await fetch(`${API_ENDPOINT}/memory/clear`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to clear memory");
      }

      window.dispatchEvent(new CustomEvent('code-editor-state', {
        detail: { isOpen: false, width: 0 }
      }));
      window.dispatchEvent(new CustomEvent('python-shell-state', {
        detail: { isOpen: false, width: 0 }
      }));
      window.dispatchEvent(new CustomEvent('memory-cleared'));

      toast.success("All Short Term Memory erased successfully!");
    } catch (error) {
      console.error("Failed to clear memory:", error);
      toast.error("Failed to clear memory");
    }
  };

  const changeModel = async (type: string) => {
    try {
      setModelType(type);
      if (["quick"].includes(mcp)) {
        setMcp("auto");
      }
      toast.success(`Model changed to ${type}`);
    } catch (error) {
      console.error("Failed to change model:", error);
      toast.error("Failed to change model");
    }
  };

  const getModelDisplayName = () => {
    if (isLoading) return "Loading...";
    if (modelType === "advanced") {
      return "Reasoner"
    } else if (modelType === "fast") {
      return "Fast";
    } else if (modelType === "quick-think") {
      return `Quick Reasoner`
    }
    else {
      return `Gemini 2.5 Pro` 
    }
  };

  return (
    <div className="flex items-center gap-1 md:gap-2 relative">
      <TooltipProvider>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1 rounded-full"
                >
                  <span className="hidden sm:inline">
                    {getModelDisplayName()}
                  </span>
                  <span className="sm:hidden">Model</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Change AI model</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent className="text-center" align="end">
            <DropdownMenuItem onClick={() => changeModel("fast")}>
              {" "}
              <BrainCogIcon className="mr-2 h-4 w-4" /> Gemini Flash (Fast)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeModel("pro")}>
              <BrainIcon className="mr-2 h-4 w-4" /> Gemini Pro (1min)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeModel("quick-think")}>
              <BrainCircuit className="mr-2 h-4 w-4" /> Quick Reasoner (1mins+)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeModel("advanced")}>
              <BrainCircuit className="mr-2 h-4 w-4" /> Reasoner Pro (3mins+)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={() => {
              forgetMemory();
              setMessages([]);
            }}
            variant="ghost"
          >
            <MessageCircleDashed style={{ height: "1.2rem", width: "1.2rem" }} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Erase all short term memory</p>
        </TooltipContent>
      </Tooltip>
      </TooltipProvider>
    </div>
  );
}
