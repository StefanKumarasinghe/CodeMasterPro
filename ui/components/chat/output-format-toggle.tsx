"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { FaStackOverflow } from "react-icons/fa"
import { Code, FileText, CodepenIcon, Globe } from "lucide-react"
import { API_ENDPOINT } from "@/config/constants"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function OutputFormatToggle({ value, onChange }) {
  const [webEnabled, setWebEnabled] = useState(false)
  const [stackEnabled, setStackEnabled] = useState(false)
  const [internalEnabled, setInternalEnabled] = useState(false)

  const fetchInternalFlag = async (endpoint, setter, errorMsg) => {
    try {
      const response = await fetch(`${API_ENDPOINT}/${endpoint}`)
      if (!response.ok) {
        throw new Error("Network response was not ok")
      }
      const data = await response.json()
      setter(data.enabled)
    } catch (err) {
      console.error(`${errorMsg}:`, err)
    }
  }


  const fetchFlag = async (endpoint, setter, errorMsg) => {
    try {
      const response = await fetch(`${API_ENDPOINT}/${endpoint}`)
      const data = await response.json()
      setter(data.enabled)
    } catch (err) {
      console.error(`${errorMsg}:`, err)
    }
  }

  const updateFlag = async (endpoint, newValue, errorMsg) => {
    try {
      const response = await fetch(`${API_ENDPOINT}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: newValue }),
      })

      if (!response.ok) {
        console.error(`${errorMsg}:`, response.statusText)
      }
    } catch (err) {
      console.error(`Error calling ${endpoint}:`, err)
    }
  }

  useEffect(() => {
    fetchFlag("check_web", setWebEnabled, "Failed to fetch web flag")
  }, [])

  useEffect(() => {
    fetchFlag("check_stack_flow", setStackEnabled, "Failed to fetch Stack Overflow flag")
  }, [])
  useEffect(() => {
    fetchInternalFlag("check_internal", setInternalEnabled, "Failed to fetch internal flag")
  }, [])

  const handleWebToggle = async () => {
    const newValue = !webEnabled
    setWebEnabled(newValue)
    await updateFlag("change_web", newValue, "Failed to update web toggle status")
  }

  const handleStackToggle = async () => {
    const newValue = !stackEnabled
    setStackEnabled(newValue)
    await updateFlag("change_stack_flow", newValue, "Failed to update Stack Overflow toggle status")
  }
  const handleInternalToggle = async () => {
    const newValue = !internalEnabled
    setInternalEnabled(newValue)
    await updateFlag("change_internal", newValue, "Failed to update internal toggle status")
  }

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
            <p>Show only code snippets</p>
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
            <p>Show only explanations</p>
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
            <p>Show code and explanations together</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={webEnabled ? "destructive" : "ghost"}
              size="sm"
              className="h-8 gap-1 px-2"
              onClick={handleWebToggle}
            >
              <Globe className="h-4 w-4" />
              <span className="sr-only md:not-sr-only md:inline-block">Web</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Enable/disable web search (requires Brave API)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={stackEnabled ? "destructive" : "ghost"}
              size="sm"
              className="h-8 gap-1 px-2"
              onClick={handleStackToggle}
            >
              <FaStackOverflow className="h-4 w-4" />
              <span className="sr-only md:not-sr-only md:inline-block">StackOverflow</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Enable/disable Stack Overflow search</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={internalEnabled ? "destructive" : "ghost"}
              size="sm"
              className="h-8 gap-1 px-2"
              onClick={handleInternalToggle}
            >
              <FileText className="h-4 w-4" />
              <span className="sr-only md:not-sr-only md:inline-block">Use Internal</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>This is to use internal documentation, try to enable, only when needed</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
