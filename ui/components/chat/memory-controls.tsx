"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Trash2, RefreshCw, File, ChevronDown, BrainCircuit, Trash2Icon, BrainCogIcon, BrainIcon, Indent } from "lucide-react"
import { API_ENDPOINT, STORAGE_KEYS } from "@/config/constants"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useState, useEffect, use } from "react"
import { toast } from "@/utils/toast-util"
import { useChat } from "@/context/chat-context"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { YAxis } from "recharts"

const IconButton = ({
  onClick,
  icon: Icon,
  tooltip,
  variant = "outline",
}: {
  onClick: () => void
  icon: React.ElementType
  tooltip: string
  variant?: "outline" | "secondary"
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant={variant} size="icon" className="rounded-full h-9 w-9" onClick={onClick}>
        <Icon className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>{tooltip}</p>
    </TooltipContent>
  </Tooltip>
)

export function MemoryControls() {
  const { setMessages } = useChat()
  const [showMessage, setShowMessage] = useState(false)
  const [modelType, setModelType] = useState<string>("fast") // Default to fast model
  const [currentModelName, setCurrentModelName] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)

  // Fetch current model on component mount
  useEffect(() => {
    fetchCurrentModel()
  }, [])

  // Fetch the current model from the API
  const fetchCurrentModel = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`${API_ENDPOINT}/current_model`)

      if (!response.ok) {
        throw new Error("Failed to fetch current model")
      }

      const data = await response.json()

      // Determine model type based on the model name
      if (data.current_model) {
        const modelName = data.current_model
        setCurrentModelName(modelName)

        // Set model type based on model name
        if (modelName.includes("flash")) {
          setModelType("fast")
          localStorage.setItem(STORAGE_KEYS.MODEL_TYPE, "fast")
        } else {
          setModelType("advanced")
          localStorage.setItem(STORAGE_KEYS.MODEL_TYPE, "advanced")
        }
      }
    } catch (error) {
      console.error("Failed to fetch current model:", error)
      // Load from localStorage as fallback
      const savedModelType = localStorage.getItem(STORAGE_KEYS.MODEL_TYPE)
      if (savedModelType) {
        setModelType(savedModelType)
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Load saved model type from localStorage on component mount
  useEffect(() => {
    const savedModelType = localStorage.getItem(STORAGE_KEYS.MODEL_TYPE)
    if (savedModelType) {
      setModelType(savedModelType)
    }
  }, [])

  const forgetMemory = async () => {
    try {
      const response = await fetch(`${API_ENDPOINT}/memory/clear`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to clear memory")
      }

      toast.success("Memory erased successfully!")
    } catch (error) {
      console.error("Failed to clear memory:", error)
      toast.error("Failed to clear memory")
    }
  }



  const changeModel = async (type: string) => {
    try {
      const response = await fetch(`${API_ENDPOINT}/change_model`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: type }),
      })

      if (!response.ok) {
        throw new Error("Failed to change model")
      }

      setModelType(type)
      // Save model type to localStorage
      localStorage.setItem(STORAGE_KEYS.MODEL_TYPE, type)

      // Fetch the updated model name
      await fetchCurrentModel()

      toast.success(`Model changed to ${type}`)
    } catch (error) {
      console.error("Failed to change model:", error)
      toast.error("Failed to change model")
    }
  }

  // Get display name for the model
  const getModelDisplayName = () => {
    if (isLoading) return "Loading..."

    if (modelType === "advanced") {
      return currentModelName ? `Advanced: ${currentModelName}` : "Advanced (Slow)"
    } else {
      return currentModelName ? `Fast: ${currentModelName || "gemini-2.0-flash"}` : "Less Accurate (Fast)"
    }
  }

  return (
    <div className="flex items-center gap-2 relative">
      <TooltipProvider>
        {/* Model selection dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1 rounded-full">
                  <span className="hidden sm:inline">{getModelDisplayName()}</span>
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
            <DropdownMenuItem onClick={() => changeModel("fast")}> <BrainCogIcon className="mr-2 h-4 w-4"/> Gemini Flash (Fast)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeModel("advanced")}><BrainCircuit className="mr-2 h-4 w-4"/> Gemini Think (Mid)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeModel("pro")}><BrainIcon className="mr-2 h-4 w-4"/> Gemini Pro (Slow)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Forget memory button with temporary message */}
        <IconButton onClick={forgetMemory} icon={BrainIcon} tooltip="Forget Short-Term Memory " />
        {/* Reload button */}
        <IconButton onClick={() => setMessages([])} icon={Trash2} tooltip="Clear page (Does not remove memory)" />
      </TooltipProvider>
    </div>
  )
}