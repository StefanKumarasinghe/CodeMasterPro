"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {Info,HelpCircle,Keyboard,PanelLeft,FileText,Timer} from "lucide-react";
import { Github } from "lucide-react";
import {Tooltip,TooltipContent,TooltipProvider,TooltipTrigger,} from "@/components/ui/tooltip";
import { ThemeToggle } from "../ui/theme-toggle";
import { MemoryControls } from "./memory-controls";
import { useChat } from "@/context/chat-context";
import SettingsSheet from "../settings/settings-sheet";

import { ChatHistoryDownload } from "./chat-history-download";
import { motion, AnimatePresence } from "framer-motion";
import { useSidebar } from "@/components/ui/sidebar";
import { API_ENDPOINT } from "@/config/constants";
import { toast } from "@/utils/toast-util";
import { SaveChatButton } from "./save-chat-button";

export function ChatHeader() {
  const [showInfo, setShowInfo] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const { state: sidebarState, toggleSidebar } = useSidebar();
  const {
    preferences,
    setPreferences,
    customPrompt,
    setCustomPrompt,
    personalInfo,
    setPersonalInfo,
    messages,
  } = useChat();

  const reIndex = async () => {
    try {
      const response = await fetch(`${API_ENDPOINT}/reindex/`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to reindex memory");
      }
      toast.success("Memory reindexed successfully!");
    } catch (error) {
      console.error("Failed to reindex memory:", error);
      toast.error("Failed to reindex memory");
    }
  };

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  return (
    <>
      <header className="h-14 border-b overflow-x-auto px-4 flex md:flex items-center justify-between">
        <div className="flex items-center gap-1 md:gap-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={toggleSidebar}
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {sidebarState === "expanded"
                    ? "Hide Sidebar"
                    : "Show Sidebar"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("open-documentation-modal")
                    )
                  }
                >
                  <FileText className="h-4 w-4" />
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => reIndex()}
                >
                  <Timer className="h-4 w-4" />
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    setShowKeyboardShortcuts(!showKeyboardShortcuts)
                  }
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Keyboard Shortcuts</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowInfo(!showInfo)}
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Help & Information</p>
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
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-16 right-4 z-50 bg-card border rounded-lg shadow-lg p-4 w-80"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium flex items-center gap-2">
                <Info className="h-4 w-4" />
                About TARS
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowInfo(false)}
              >
                &times;
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              TARS is an AI-powered coding assistant designed to help with
              programming tasks, debugging, and learning. It is designed to be
              more specific to coding and also provide documentation and
              resources to assist it's accuracy. CodeMasterPro owns TARS,
              however it is released as open source software under the MIT
              license for everyone to use and contribute to.
            </p>
            <div className="text-xs text-muted-foreground">
              <p>Version: 1.1.1</p>
              <p>Developed by Stefan Kumarasinghe</p>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-start items-start pb-3">
              <a
                href="https://github.com/StefanKumarasinghe/CodeMasterPro"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground text-sm hover:text-foreground transition-colors flex items-center gap-1"
                aria-label="GitHub"
              >
                GitHub
                <Github className="w-4" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showKeyboardShortcuts && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowKeyboardShortcuts(false)}
          >
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              className="bg-card border rounded-lg shadow-lg p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Keyboard className="h-5 w-5" />
                  Keyboard Shortcuts
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8"
                  onClick={() => setShowKeyboardShortcuts(false)}
                >
                  &times;
                </Button>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">General</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Focus input</span>
                      <span className="font-mono bg-muted px-2 py-1 rounded text-xs">
                        {isMac ? "⌘" : "Ctrl"}+K
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Send message</span>
                      <span className="font-mono bg-muted px-2 py-1 rounded text-xs">
                        {isMac ? "⌘" : "Ctrl"}+Enter
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Toggle sidebar</span>
                      <span className="font-mono bg-muted px-2 py-1 rounded text-xs">
                        {isMac ? "⌘" : "Ctrl"}+B
                      </span>
                    </div>
                  </div>
                </div>
                <Separator />
                <div>
                  <h3 className="font-medium mb-2">Code Actions</h3>
                  <p className="text-sm">
                    Code actions are not supported yet, but will be added soon.
                  </p>
                </div>
              </div>
              <Button
                className="w-full mt-6"
                variant="default"
                onClick={() => setShowKeyboardShortcuts(false)}
              >
                Close
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
