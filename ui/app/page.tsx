import { ChatProvider } from "@/context/chat-context"
import { ChatLayout } from "@/components/chat/chat-layout"

export default function Page() {
  return (
    <ChatProvider>
      <ChatLayout />
    </ChatProvider>
  )
}
