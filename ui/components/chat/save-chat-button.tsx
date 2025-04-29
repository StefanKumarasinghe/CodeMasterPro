"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from "@/components/ui/dialog"
import { toast } from "@/utils/toast-util"
import { BookmarkPlus } from "lucide-react"
import { formatDate } from "@/utils/format-utils"
import { v4 as uuidv4 } from "uuid"
import type { Message } from "ai"

interface SaveChatButtonProps {
  messages: Message[]
}

export function SaveChatButton({ messages }: SaveChatButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState("")

  const saveChat = () => {
    if (!title.trim()) {
      toast.warning("Please enter a title for this chat")
      return
    }

    if (messages.length === 0) {
      toast.warning("There's no chat content to save")
      return
    }
    try {
      const chatItem = {
        id: uuidv4(),
        title: title.trim(),
        date: formatDate(new Date()),
        preview: messages[0].content.substring(0, 100) + (messages[0].content.length > 100 ? "..." : ""),
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      }
      const existingHistory = JSON.parse(localStorage.getItem("tars-chat-history") || "[]")
      const updatedHistory = [chatItem, ...existingHistory]
      localStorage.setItem("tars-chat-history", JSON.stringify(updatedHistory))
      toast.success("Chat saved to history")
      setIsOpen(false)
      setTitle("")
    } catch (error) {
      console.error("Failed to save chat:", error)
      toast.error("Failed to save chat. Please try again.")
    }
  }
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() => setIsOpen(true)}
        disabled={messages.length === 0}
      >
        <BookmarkPlus className="h-4 w-4" />
        <span className="hidden sm:inline">Save Chat</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Chat History</DialogTitle>
            <DialogDescription>
              Save this conversation for future reference. Saved chats are stored locally on your device.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="chat-title">Chat Title</Label>
              <Input
                id="chat-title"
                placeholder="Enter a title for this chat"
                autoComplete="off"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              <p>This chat will be saved locally on your device and will be available in the sidebar.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveChat}>Save Chat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
