"use client"
import { useState, useEffect, useCallback } from "react"
import type React from "react"

import { Button } from "@/components/ui/button"
import { HelpCircle, PanelLeft, FileText, BookMarked, SquarePen, Sparkles } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ThemeToggle } from "../ui/theme-toggle"
import { MemoryControls } from "./memory-controls"
import { useChat } from "@/context/chat-context"
import SettingsSheet from "../settings/settings-sheet"
import { ChatHistoryDownload } from "./chat-history-download"
import { useSidebar } from "@/components/ui/sidebar"
import { API_ENDPOINT } from "@/config/constants"
import { toast } from "@/utils/toast-util"
import { SaveChatButton } from "./save-chat-button"
import { TutorialModal } from "@/components/tutorial/tutorial-modal"
import { v4 as uuidv4 } from "uuid"
import { showProgressIndicator, hideProgressIndicator } from "@/components/progress-indicator"
import { ProgressIndicator } from "@/components/progress-indicator"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { MoreVertical } from "lucide-react"
import { cn } from "@/lib/utils"

export function ChatHeader({ style, size }: { style?: React.CSSProperties; size?: number }) {
  const [showTutorial, setShowTutorial] = useState(false)
  const [isReindexing, setIsReindexing] = useState(false)
  const { state: sidebarState, toggleSidebar } = useSidebar()
  const {
    preferences,
    setPreferences,
    customPrompt,
    setCustomPrompt,
    personalInfo,
    setPersonalInfo,
    messages,
    setMessages,
    chatId,
    setChatId,
    setMemoryState,
  } = useChat()

  const reIndex = async () => {
    try {
      setIsReindexing(true)
      showProgressIndicator("Reindexing memory...");
      
      const response = await fetch(`${API_ENDPOINT}/reindex/`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to reindex memory")
      }
      toast.success("Memory reindexed successfully!")
    } catch (error) {
      console.error("Failed to reindex memory:", error)
      toast.error("Failed to reindex memory")
    } finally {
      setIsReindexing(false)
      hideProgressIndicator();
    }
  }

  const handleNewChat = async () => {
    try {
      // Clear memory for the current chat before switching to new chat
      await handleClearMemory()
      
      const newChatId = uuidv4()
      window.dispatchEvent(
        new CustomEvent("code-editor-state", {
          detail: { isOpen: false, width: 0 },
        }),
      )
      window.dispatchEvent(
        new CustomEvent("python-shell-state", {
          detail: { isOpen: false, width: 0 },
        }),
      )
      window.dispatchEvent(new CustomEvent("memory-cleared"))
      
      // Set the new chat ID immediately
      setChatId(newChatId)
      setMessages([])
      setMemoryState((prev) => ({ ...prev, forgetMemory: true }))
    } catch (error) {
      console.error("Failed to start new chat:", error)
      toast.error("Failed to start new chat")
    }
  }

  useEffect(() => {
    handleClearMemory()
  }, [])

  const handleClearMemory = useCallback(async () => {
    try {
      if (!chatId) {
        toast.error("No active chat session")
        return
      }
      const response = await fetch(`${API_ENDPOINT}/memory/clear?chat_id=${chatId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to clear memory")
      }

      setMessages([])
      setMemoryState((prev) => ({ ...prev, forgetMemory: true }))
    } catch (error) {
      console.error("Failed to clear memory:", error)
    }
  }, [chatId, setMessages, setMemoryState])

  const ActionButton = ({ children, onClick, tooltip, variant = "ghost", className = "", isActive = false }: {
    children: React.ReactNode;
    onClick: () => void;
    tooltip: string;
    variant?: "ghost" | "default";
    className?: string;
    isActive?: boolean;
  }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant={variant} 
            className={cn(
              "h-9 w-9 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95",
              "hover:bg-primary/10 hover:text-primary hover:shadow-md",
              "group relative overflow-hidden",
              isActive && "bg-primary/15 text-primary shadow-sm",
              className
            )} 
            onClick={onClick}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-popover/95 backdrop-blur-sm border shadow-lg">
          <p className="text-sm font-medium">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  return (
    <>
      <header
        className={cn(
          "h-12 md:relative top-0 left-0 right-0 md:top-auto md:left-auto md:right-auto",
          "px-4 flex items-center justify-between fluid-content",
        )}
        style={style}
      >
        <div className="flex items-center gap-3">
          <ActionButton
            onClick={toggleSidebar}
            tooltip={sidebarState === "expanded" ? "Hide Sidebar" : "Show Sidebar"}
            isActive={sidebarState === "expanded"}
          >
            <PanelLeft className="h-4 w-4" />
          </ActionButton>

          <div className="w-px h-6 bg-border/50" />

          <ActionButton
            onClick={handleNewChat}
            tooltip="New Chat"
            className="hover:bg-green-500/10 hover:text-green-600"
          >
            <SquarePen className="h-4 w-4" />
          </ActionButton>

          <div className="hidden md:flex items-center gap-2">
            <ActionButton
              onClick={() => window.dispatchEvent(new CustomEvent("open-documentation-modal"))}
              tooltip="Add Documentation"
              className="hover:bg-blue-500/10 hover:text-blue-600"
            >
              <FileText className="h-4 w-4" />
            </ActionButton>

            <ActionButton
              onClick={reIndex}
              tooltip="Reindex Resources (When new resources are added)"
              className={cn(
                "hover:bg-purple-500/10 hover:text-purple-600",
                isReindexing && "animate-pulse bg-purple-500/20"
              )}
            >
              <BookMarked className={cn("h-4 w-4", isReindexing && "animate-spin")} />
            </ActionButton>

            <ActionButton
              onClick={() => setShowTutorial(true)}
              tooltip="Help & Tutorial"
              className="hover:bg-amber-500/10 hover:text-amber-600"
            >
              <HelpCircle className="h-4 w-4" />
            </ActionButton>

            {messages.length > 0 && (
              <div className="ml-2">
                <ChatHistoryDownload messages={messages} />
              </div>
            )}
          </div>

          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className={cn(
                    "h-9 w-9 rounded-xl transition-all duration-200",
                    "hover:bg-primary/10 hover:text-primary hover:shadow-md"
                  )}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="center" 
                className="w-56 bg-popover/95 backdrop-blur-xl border shadow-xl rounded-xl"
              >
                <DropdownMenuItem 
                  onClick={() => window.dispatchEvent(new CustomEvent("open-documentation-modal"))}
                  className="gap-3 py-3 rounded-lg hover:bg-blue-500/10 hover:text-blue-600"
                >
                  <FileText className="h-4 w-4" />
                  <span>Add Documentation</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={reIndex}
                  className="gap-3 py-3 rounded-lg hover:bg-purple-500/10 hover:text-purple-600"
                >
                  <BookMarked className="h-4 w-4" />
                  <span>Reindex Resources</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setShowTutorial(true)}
                  className="gap-3 py-3 rounded-lg hover:bg-amber-500/10 hover:text-amber-600"
                >
                  <HelpCircle className="h-4 w-4" />
                  <span>Help & Tutorial</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3 py-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-4 w-4" />
                    <span>Theme</span>
                    <div className="ml-auto">
                      <ThemeToggle />
                    </div>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {messages.length > 0 && (
              <div className="ml-2">
                <ChatHistoryDownload messages={messages} />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {messages.length > 0 && (
            <div className="hidden sm:block">
              <SaveChatButton messages={messages} />
            </div>
          )}
          
          <div className="w-px h-6 bg-border/50 hidden sm:block" />
          
          <MemoryControls />
          
          <SettingsSheet
            preferences={{
              inputPreference: preferences.inputPreference as "Autotag" | "NoTag",
              outputFormat: preferences.outputFormat as "codeAndExplanation" | "codeOnly" | "explanationOnly",
              codeQuality: preferences.codeQuality,
              freeModel: preferences.freeModel,
              providerModel: preferences.providerModel,
            }}
            setPreferences={(update) => {
              setPreferences((prev: any) => {
                const base = typeof update === "function" ? update({
                  inputPreference: prev.inputPreference,
                  outputFormat: prev.outputFormat,
                  codeQuality: prev.codeQuality,
                  freeModel: prev.freeModel,
                  providerModel: prev.providerModel,
                }) : update;
                return {
                  ...prev,
                  ...base,
                };
              });
            }}
            customPrompt={customPrompt}
            setCustomPrompt={setCustomPrompt}
            personalInfo={personalInfo}
            setPersonalInfo={setPersonalInfo}
          />
          
          <div className="hidden md:block">
            <div className="p-1 rounded-xl bg-muted/30 backdrop-blur-sm">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <div className="w-full relative bg-background/50 backdrop-blur-sm">
        <ProgressIndicator />
      </div>
   
      <TutorialModal isOpen={showTutorial} onClose={() => setShowTutorial(false)} />
    </>
  )
}