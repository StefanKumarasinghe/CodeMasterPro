
import type { ReactNode } from "react";
import { BookOpen, Terminal, SmileIcon } from "lucide-react";
import { ThemeProvider, ThemeToggle } from "@/components/theme-provider";
import { Roboto_Mono } from "next/font/google";
import { SidebarProvider, Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { ChatHistory } from "@/components/sidebar/chat-history";
import { DocumentationModal } from "@/components/documentation/documentation-modal";
import { ChatProvider } from "@/context/chat-context";
import "./globals.css";

const quicksand = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-quicksand",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "CodeMasterPro",
  description: "CodeMasterPro is an AI-powered coding assistant that helps you with your coding tasks powered by TARS AI.",
  icons: {
    icon: "https://cdn-icons-png.freepik.com/256/6132/6132222.png",
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={quicksand.variable}>
      <body className="font-quicksand">
        <ThemeProvider defaultTheme="dark" storageKey="code-assistant-theme" attribute="class">
          <ChatProvider>
            <SidebarProvider defaultOpen={false}>
              <div className="flex h-screen bg-background overflow-hidden">
                <Sidebar>
                  <div className="p-4 border-b">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">CodeMasterPro</span>
                    </div>
                  </div>
                  <SidebarContent>
                    <div className="space-y-4 p-4">
                      <nav className="space-y-1.5">
                        <button className="flex items-center w-full px-3 py-2 text-sm rounded-md bg-accent text-accent-foreground">
                          <Terminal className="mr-2 h-4 w-4" />
                          Coding Assistant
                        </button>
                        <a href={"https://github.com/https://github.com/StefanKumarasinghe/CodeMasterPro/blob/main/README.md/CodeMasterPro/wiki/"} className="flex items-center w-full px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                          <BookOpen className="mr-2 h-4 w-4" />
                          Documentation
                        </a>
                      </nav>
                      <div className="pt-4 border-t">
                        <div className="flex items-center justify-between px-3">
                          <span className="text-sm ">Theme</span>
                          <ThemeToggle />
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <ChatHistory />
                    </div>
                    <div className="p-4 border-t text-xs text-muted-foreground mt-auto">
                      <p>© 2025 TARS AI. All rights reserved.</p>
                    </div>
                  </SidebarContent>
                </Sidebar>
                <div className="flex-1 flex flex-col overflow-hidden relative">
                  <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
                </div>
              </div>
            </SidebarProvider>
            <DocumentationModal />
          </ChatProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
