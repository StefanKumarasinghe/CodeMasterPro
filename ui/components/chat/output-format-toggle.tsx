"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FaStackOverflow } from "react-icons/fa";
import { Code, FileText, CodepenIcon, Globe } from "lucide-react";
import { API_ENDPOINT } from "@/config/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export function OutputFormatToggle({ value, onChange }) {
  const [webEnabled, setWebEnabled] = useState(false);
  const [stackEnabled, setStackEnabled] = useState(false);
  const [internalEnabled, setInternalEnabled] = useState(false);
  const [selectedToolCount, setSelectedToolCount] = useState(0);

  const fetchFlag = async (endpoint, setter, errorMsg) => {
    try {
      const response = await fetch(`${API_ENDPOINT}/${endpoint}`);
      const data = await response.json();
      setter(data.enabled);
    } catch (err) {
      console.error(`${errorMsg}:`, err);
    }
  };

  const updateFlag = async (endpoint, newValue, errorMsg) => {
    try {
      const response = await fetch(`${API_ENDPOINT}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: newValue }),
      });

      if (!response.ok) {
        console.error(`${errorMsg}:`, response.statusText);
      }
    } catch (err) {
      console.error(`Error calling ${endpoint}:`, err);
    }
  };

  useEffect(() => {
    fetchFlag("check_web", setWebEnabled, "Failed to fetch web flag");
    fetchFlag("check_stack_flow", setStackEnabled, "Failed to fetch Stack Overflow flag");
    fetchFlag("check_internal", setInternalEnabled, "Failed to fetch internal flag");
  }, []);

  useEffect(() => {
    let count = 0;
    if (webEnabled) count++;
    if (stackEnabled) count++;
    if (internalEnabled) count++;
    setSelectedToolCount(count);
  }, [webEnabled, stackEnabled, internalEnabled]);

  const handleToggle = async (current, setter, endpoint, errorMsg) => {
    const newValue = !current;
    setter(newValue);
    await updateFlag(endpoint, newValue, errorMsg);
  };

  const DropdownToggleButton = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 gap-1 px-2">
          <Globe className="h-4 w-4" />
          <span className="sr-only md:not-sr-only md:inline-block">Tools</span>
          {selectedToolCount > 0 && (
            <Badge
              variant="secondary"
              className="absolute bg-red-500 text-white -top-2 right-0.5 rounded-full px-1.5 py-0 text-xs"
            >
              {selectedToolCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Available tools</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={webEnabled}
          onCheckedChange={() =>
            handleToggle(webEnabled, setWebEnabled, "change_web", "Failed to update web toggle status")
          }
        >
          Web (2000/month)
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={stackEnabled}
          onCheckedChange={() =>
            handleToggle(stackEnabled, setStackEnabled, "change_stack_flow", "Failed to update Stack Overflow toggle status")
          }
        >
          StackOverflow
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={internalEnabled}
          onCheckedChange={() =>
            handleToggle(internalEnabled, setInternalEnabled, "change_internal", "Failed to update internal toggle status")
          }
        >
          Internal
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

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

        <DropdownToggleButton />
      </div>
    </TooltipProvider>
  );
}
