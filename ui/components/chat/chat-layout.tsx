"use client"

import { ChatHeader } from "./chat-header"
import { ChatMessageList } from "./chat-message-list"
import { ChatInput } from "./chat-input"

export function ChatLayout() {
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen w-full max-w-full overflow-hidden">
      <ChatHeader />
      <ChatMessageList />
      <ChatInput />
    </div>
  )
}
