"use client"
import { useState, useEffect } from "react"
import type React from "react"

import { Button } from "@/components/ui/button"
import { HelpCircle, PanelLeft, FileText, BookMarked, SquarePen } from "lucide-react"
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

export function ChatHeader({ style, size }: { style?: React.CSSProperties; size?: number }) {
  const [showTutorial, setShowTutorial] = useState(false)
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
    }
  }

  const handleNewChat = async () => {
    try {
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
      handleClearMemory()
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

  const handleClearMemory = async () => {
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
      toast.error("Failed to clear memory")
    }
  }

  return (
    <>
      <header
        className="h-14 border-b overflow-x-auto px-4 flex md:flex items-center justify-between fluid-content"
        style={style}
      >
        <div className="flex items-center gap-2 md:gap-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" className="h-8 w-8" onClick={toggleSidebar}>
                  <PanelLeft style={{ height: "1.2rem", width: "1.2rem" }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{sidebarState === "expanded" ? "Hide Sidebar" : "Show Sidebar"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" className="h-8 w-8" onClick={handleNewChat}>
                  <SquarePen style={{ width: "1.2rem", height: "1.2rem" }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>New Chat</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => window.dispatchEvent(new CustomEvent("open-documentation-modal"))}
                >
                  <FileText style={{ height: "1.2rem", width: "1.2rem" }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add Documentation</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" className="h-8 w-8" onClick={() => reIndex()}>
                  <BookMarked style={{ height: "1.2rem", width: "1.2rem" }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reindex Resources (When new resources are added)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" className="h-8 w-8" onClick={() => setShowTutorial(true)}>
                  <HelpCircle style={{ height: "1.2rem", width: "1.2rem" }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Help & Tutorial</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {messages.length > 0 && <ChatHistoryDownload messages={messages} />}
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && <SaveChatButton messages={messages} />}
          <MemoryControls />
          <SettingsSheet
            preferences={preferences}
            setPreferences={setPreferences}
            customPrompt={customPrompt}
            setCustomPrompt={setCustomPrompt}
            personalInfo={personalInfo}
            setPersonalInfo={setPersonalInfo}
          />
          <ThemeToggle />
        </div>
      </header>
      <TutorialModal isOpen={showTutorial} onClose={() => setShowTutorial(false)} />
    </>
  )
}
