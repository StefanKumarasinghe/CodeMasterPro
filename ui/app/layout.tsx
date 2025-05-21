import type { ReactNode } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { Roboto_Mono } from "next/font/google"
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarInset,
} from "@/components/ui/sidebar"
import { ResizableSidebar } from "@/components/sidebar"
import { DocumentationModal } from "@/components/documentation/documentation-modal"
import { ChatProvider } from "@/context/chat-context"
import "./globals.css"

// Add event types for custom events
declare global {
  interface WindowEventMap {
    'node-test-runner-state': CustomEvent<SidebarStateDetail>;
    'code-editor-state': CustomEvent<SidebarStateDetail>;
    'code-editor-close': CustomEvent<{ forced: boolean }>;
    'python-shell-close': CustomEvent<{ forced: boolean }>;
    'html-preview-close': CustomEvent<{ forced: boolean }>;
    'node-test-runner-close': CustomEvent<{ forced: boolean }>;
  }
}

interface SidebarStateDetail {
  isOpen: boolean;
  width: number;
  instanceId?: string;
}

const quicksand = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-quicksand",
  display: "swap",
  weight: ["400", "500", "600", "700"],
})

export const metadata = {
  title: "CodeMasterPro",
  description: "The CodeMaster Returns",
  icons: {
    icon: "logo.png",
  },
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={quicksand.variable}>
      <body className="font-quicksand">
        <ThemeProvider defaultTheme="dark" storageKey="code-assistant-theme" attribute="class">
          <ChatProvider>
            <SidebarProvider defaultWidth={280} defaultFontScale={1.0}>
              <div className="flex h-screen bg-background overflow-hidden">
                <Sidebar side="left" resizable={true}>
                  <SidebarHeader className="border-b">
                    <div className="flex items-center justify-between p-3">
                      <div className="text-md">️‍🔥 CodeMasterPro</div>
                    </div>
                  </SidebarHeader>
                  <SidebarContent>
                    <div className="flex-1 overflow-hidden h-full">
                      <ResizableSidebar />
                    </div>
                  </SidebarContent>
                  <SidebarFooter className="border-t p-3">
                    <p className="text-xs text-muted-foreground">© 2025 CodeMasterPro. All rights reserved.</p>
                  </SidebarFooter>
                </Sidebar>
                <SidebarInset>
                  <div className="flex-1 flex flex-col overflow-hidden transition-all">{children}</div>
                </SidebarInset>
              </div>
            </SidebarProvider>
            <DocumentationModal />
          </ChatProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
