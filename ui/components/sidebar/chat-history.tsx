"use client";

import type React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { API_ENDPOINT } from "@/config/constants";
import {MessageSquare,Trash2,Download,AlertTriangle,Search,Clock,RefreshCw,HistoryIcon,Calendar,ArrowUpDown,CheckCircle2} from "lucide-react";
import { toast } from "@/utils/toast-util";
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useChat } from "@/context/chat-context";
import { loadChatHistory, deleteChatFromHistory } from "@/utils/chat-utils";
import { STORAGE_KEYS } from "@/config/constants";
import { useSidebar } from "@/components/ui/sidebar";

interface ChatHistoryItem {
  id: string;
  title: string;
  date: string;
  lastUpdated?: string;
  preview: string;
  messages: any[];
}

export function ChatHistory() {
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatHistoryItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [previousMessages, setPreviousMessages] = useState<any[] | null>(null);
  const { messages, setMessages, chatId } = useChat();
  const initialLoadRef = useRef(false);
  
  const sidebarContext = (() => {
    try {
      return useSidebar();
    } catch {
      return null;
    }
  })();
  
  const { fontScale } = sidebarContext || { fontScale: 1 };

  useEffect(() => {
    setIsLoading(true);
    try {
      const history = loadChatHistory();
      setChatHistory(history);
    } catch (error) {
      console.error("Failed to load chat history:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;

    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_CHAT);
      if (saved) {
        const session = JSON.parse(saved);
        if (session.messages?.length && messages.length === 0) {
          setPreviousMessages(session.messages);

          setBubbleOpen(true);
        }
      }
    } catch (error) {
      console.error("Failed to check for previous session:", error);
    }
  }, [messages.length]);

  const giveMemory = async (chatId, inputText, result) => {
    try {
      const response = await fetch(`${API_ENDPOINT}/give_memory/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId,
          input: inputText,
          result,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Unknown error occurred");
      }

      const data = await response.json();
      console.log("Memory updated:", data.message);
      return data;
    } catch (error) {
      console.error(" Failed to update memory:");
      throw error;
    }
  };

  const handleRestoreSession = () => {
    if (previousMessages && previousMessages.length >= 2) {
      setMessages(
        previousMessages.map((message, index) => ({
          ...message,
          id: message.id || `restored-${index}`,
        }))
      );
      const userMessages = previousMessages
        .filter((message) => message.role === "user")
        .map((message) => message.content)
        .join("\n -- Next Message from User -- \n");
      const assistantMessages = previousMessages
        .filter((message) => message.role === "assistant")
        .map((message) => message.content)
        .join("\n -- Next Message from AI -- \n");
      giveMemory(chatId, userMessages, assistantMessages);
      toast.success(
        "Your messages are restored for you, if you want to make the AI understand them, use the 'Use this' button"
      );
    } else {
      toast.error("This chat doesn't have enough messages to load.");
    }
    setRestoreDialogOpen(false);
  };

  const handleDiscardSession = () => {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_CHAT);
    setRestoreDialogOpen(false);
  };

  const filteredHistory = chatHistory
    .filter(
      (chat) =>
        chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.preview.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const dateA = new Date(a.lastUpdated || a.date).getTime();
      const dateB = new Date(b.lastUpdated || b.date).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) {
      return "Just now";
    } else if (diffSec < 3600) {
      const diffMin = Math.floor(diffSec / 60);
      return `${diffMin} minute${diffMin > 1 ? "s" : ""} ago`;
    } else if (diffSec < 86400) {
      const diffHours = Math.floor(diffSec / 3600);
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    } else if (diffSec < 604800) {
      const diffDays = Math.floor(diffSec / 86400);
      return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const viewChat = (chat: ChatHistoryItem) => {
    setSelectedChat(chat);
    setIsDialogOpen(true);
  };

  const loadChat = useCallback(
    (chat: ChatHistoryItem) => {
      if (chat) {
        if (chat.messages.length < 2) {
          toast.error("This chat doesn't have enough messages to load.");
          return;
        }
        setMessages(
          chat.messages.map((message, index) => ({
            ...message,
            id: message.id || `${chat.id}-${index}`,
          }))
        );
        const userMessages = chat.messages
          .filter((message) => message.role === "user")
          .map((message) => message.content)
          .join("\n -- Next User Message -- \n ");
        const assistantMessages = chat.messages
          .filter((message) => message.role === "assistant")
          .map((message) => message.content)
          .join("\n -- Next Assistant Message -- \n");
        giveMemory(chatId, userMessages, assistantMessages);
        toast.success(
          "Your messages are restored for you, if you want to make the AI understand them, use the 'Use this' button"
        );
        setIsDialogOpen(false);
      }
    },
    [setMessages, toast]
  );

  const confirmDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChatToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const deleteChat = () => {
    if (!chatToDelete) return;

    try {
      const success = deleteChatFromHistory(chatToDelete);
      if (success) {
        setChatHistory((prev) =>
          prev.filter((chat) => chat.id !== chatToDelete)
        );
        toast.success("Chat removed from history");
      } else {
        throw new Error("Failed to delete chat");
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
      toast.error("Failed to delete chat");
    } finally {
      setDeleteConfirmOpen(false);
      setChatToDelete(null);
    }
  };

  const downloadChat = (chat: ChatHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const chatData = JSON.stringify(chat, null, 2);
      const blob = new Blob([chatData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat-${chat.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Chat downloaded");
    } catch (error) {
      console.error("Failed to download chat:", error);
      toast.error("Failed to download chat");
    }
  };

  const refreshChatHistory = () => {
    try {
      setIsLoading(true);
      const history = loadChatHistory();
      setChatHistory(history);
      toast.success("Chat history refreshed");
    } catch (error) {
      console.error("Failed to refresh chat history:", error);
      toast.error("Failed to refresh chat history");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === "newest" ? "oldest" : "newest");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 border-b">
        {bubbleOpen && (
          <div className={cn(
            "w-100 my-3 items-center gap-2 py-3 px-2  bg-blue-500/10 rounded-md border border-blue-200 dark:border-blue-800",
          )}>
            <p className="text-xs">
              Your previous session has {previousMessages?.length || 0} messages
              that weren't saved. You can restore it or just ignore it.
            </p>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => {
                setRestoreDialogOpen(true);
                setBubbleOpen(false);
              }}
            >
              <span className="">Restore</span>
            </Button>
          </div>
        )}
        <div className="flex items-center justify-between mb-2 mt-4">
          <h3 className={cn("text-sm font-semibold flex items-center gap-1")}>
            <HistoryIcon className="h-4 w-4" />
            Saved Chats
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={refreshChatHistory}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
        <p className={cn("text-xs text-muted-foreground mb-4")}>
          Reference your previous conversations
        </p>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            className="pl-8 h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between mt-2 mb-3">
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 text-xs flex items-center gap-1")}
            onClick={toggleSortOrder}
          >
            <ArrowUpDown className="h-3 w-3" />
            {sortOrder === "newest" ? "Newest first" : "Oldest first"}
          </Button>

          <Badge variant="outline" className="text-xs">
            {filteredHistory.length}{" "}
            {filteredHistory.length === 1 ? "chat" : "chats"}
          </Badge>
        </div>
      </div>
      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col space-y-2 p-3 border rounded-md animate-pulse"
            >
              <Skeleton className="h-5 w-3/4" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-3 w-5/6" />
            </div>
          ))}
        </div>
      ) : chatHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 p-3 text-center">
          <div className=" p-6 rounded-lg">
            <MessageSquare className="h-10 w-10 text-muted-foreground mb-3 mx-auto" />
            <h4 className={cn("text-sm font-medium")}>No saved chats</h4>
            <p className={cn("text-xs text-muted-foreground mt-1 mb-3")}>
              Your saved chats will appear here for future reference. All chats
              are saved locally
            </p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-4 text-center">
                <Search className="h-8 w-8 text-muted-foreground mb-2 opacity-50" />
                <p className={cn("text-sm text-muted-foreground")}>
                  No chats match your search
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1 h-auto p-0 text-xs"
                  onClick={() => setSearchQuery("")}
                >
                  Clear search
                </Button>
              </div>
            ) : (
              filteredHistory.map((chat) => (
                <div
                  key={chat.id}
                  className={cn(
                    "p-3 rounded-md border hover:bg-accent/50 cursor-pointer transition-colors",
                    fontScale > 1 ? "space-y-1.5" : "space-y-0.5" // Add more spacing for larger font sizes
                  )}
                  onClick={() => viewChat(chat)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h4 className={cn("text-sm font-medium truncate")}>
                        {chat.title}
                      </h4>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <p className={cn("text-xs text-muted-foreground")}>
                          {formatRelativeTime(chat.lastUpdated || chat.date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => downloadChat(chat, e)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span className="sr-only">Download</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={(e) => confirmDelete(chat.id, e)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </div>
                  <p className={cn("text-xs mt-2 line-clamp-2 text-muted-foreground")}>
                    {chat.preview}
                  </p>

                  {/* Message count badge */}
                  <div className="flex justify-between items-center mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {chat.messages.length}{" "}
                      {chat.messages.length === 1 ? "message" : "messages"}
                    </Badge>
                    <div className={cn("text-xs text-muted-foreground")}>
                      <Calendar className="h-3 w-3 inline mr-1" />
                      {new Date(chat.date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      )}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {selectedChat?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedChat?.date &&
                new Date(selectedChat.date).toLocaleString()}{" "}
              · Saved chat history
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 mt-4 overflow-y-auto h-[calc(100vh-120px)]">
            <div className="flex items-center gap-2 p-4 m-2 bg-blue-500/10 rounded-md border border-blue-200 dark:border-blue-800">
              <p className="text-sm">
                Your current chat is not saved. If you want to save it, please
                do so before using this chat.
              </p>
            </div>
            <div className="space-y-4 p-2">
              {selectedChat?.messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-4 rounded-lg",
                    message.role === "user"
                      ? "bg-primary/10 ml-auto max-w-[80%]"
                      : "bg-muted max-w-[80%]"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">
                      {message.role === "user" ? "You" : "CodeMasterPro"}
                    </Badge>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">
                    {message.content}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4 flex justify-between">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => loadChat(selectedChat!)} className="gap-1">
              <MessageSquare className="h-4 w-4" />
              Use this chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Chat History</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this chat? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-4 bg-destructive/10 rounded-md">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">
              This will permanently remove the chat from your history.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteChat}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Previous Session</DialogTitle>
            <DialogDescription>
              We found a previous chat session. Would you like to restore it?
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-4 bg-blue-500/10 rounded-md border border-blue-200 dark:border-blue-800">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            <p className="text-sm">
              Your previous session has {previousMessages?.length || 0} messages
              that weren't saved.
            </p>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button variant="outline" onClick={handleDiscardSession}>
              Discard
            </Button>
            <Button onClick={handleRestoreSession} className="gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Restore Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
