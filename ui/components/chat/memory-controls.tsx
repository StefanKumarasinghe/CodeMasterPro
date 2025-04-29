"use client";

import type React from "react";
import { Button } from "@/components/ui/button";
import {ChevronDown,BrainCircuit,BrainCogIcon,BrainIcon} from "lucide-react";
import { API_ENDPOINT, STORAGE_KEYS } from "@/config/constants";
import {Tooltip,TooltipContent,TooltipProvider,TooltipTrigger} from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import { toast } from "@/utils/toast-util";
import { useChat } from "@/context/chat-context";

import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger} from "@/components/ui/dropdown-menu";

const IconButton = ({ onClick,icon: Icon,tooltip,variant = "outline"}: {onClick: () => void; icon: React.ElementType; tooltip: string; variant?: "outline" | "secondary";}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant={variant}
        size="icon"
        className="rounded-full h-9 w-9"
        onClick={onClick}
      >
        <Icon className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>{tooltip}</p>
    </TooltipContent>
  </Tooltip>
);

export function MemoryControls() {
  const { setMessages } = useChat();
  const [modelType, setModelType] = useState<string>("fast");
  const [currentModelName, setCurrentModelName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
      forgetMemory();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    fetchCurrentModel();
  }, []);

  const fetchCurrentModel = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_ENDPOINT}/current_model`);

      if (!response.ok) {
        throw new Error("Failed to fetch current model");
      }

      const data = await response.json();
      if (data.current_model) {
        const modelName = data.current_model;
        setCurrentModelName(modelName);
        if (modelName.includes("2.0-flash")) {
          setModelType("fast");
          localStorage.setItem(STORAGE_KEYS.MODEL_TYPE, "fast");
        } else if (modelName.includes("pro")) {
          setModelType("advanced");
          localStorage.setItem(STORAGE_KEYS.MODEL_TYPE, "advanced");
        } else {
          setModelType("think");
          localStorage.setItem(STORAGE_KEYS.MODEL_TYPE, "think");
        }
      }
    } catch (error) {
      console.error("Failed to fetch current model:", error);
      const savedModelType = localStorage.getItem(STORAGE_KEYS.MODEL_TYPE);
      if (savedModelType) {
        setModelType(savedModelType);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const savedModelType = localStorage.getItem(STORAGE_KEYS.MODEL_TYPE);
    if (savedModelType) {
      setModelType(savedModelType);
    }
  }, []);

  const forgetMemory = async () => {
    try {
      const response = await fetch(`${API_ENDPOINT}/memory/clear`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to clear memory");
      }

      toast.success("Memory erased successfully!");
    } catch (error) {
      console.error("Failed to clear memory:", error);
      toast.error("Failed to clear memory");
    }
  };

  const changeModel = async (type: string) => {
    try {
      const response = await fetch(`${API_ENDPOINT}/change_model`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: type }),
      });

      if (!response.ok) {
        throw new Error("Failed to change model");
      }
      setModelType(type);
      localStorage.setItem(STORAGE_KEYS.MODEL_TYPE, type);
      await fetchCurrentModel();
      toast.success(`Model changed to ${type}`);
    } catch (error) {
      console.error("Failed to change model:", error);
      toast.error("Failed to change model");
    }
  };

  const getModelDisplayName = () => {
    if (isLoading) return "Loading...";
    if (modelType === "advanced") {
      return currentModelName
        ? `Advanced: ${currentModelName}`
        : "Advanced (Slow)";
    } else if (modelType === "fast") {
      return currentModelName ? `Fast: ${currentModelName}` : "Fast (Fast)";
    } else {
      return currentModelName ? `Thinker: ${currentModelName}` : "Think (Mid)";
    }
  };

  return (
    <div className="flex items-center gap-2 relative">
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
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => changeModel("fast")}>
              {" "}
              <BrainCogIcon className="mr-2 h-4 w-4" /> Gemini Flash (Fast)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeModel("advanced")}>
              <BrainCircuit className="mr-2 h-4 w-4" /> Gemini Think (Mid)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeModel("pro")}>
              <BrainIcon className="mr-2 h-4 w-4" /> Gemini Pro (Slow)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <IconButton
          onClick={() => {
            forgetMemory();
            setMessages([]);
          }}
          icon={BrainIcon}
          tooltip="Forget Short-Term Memory"
        />
      </TooltipProvider>
    </div>
  );
}
