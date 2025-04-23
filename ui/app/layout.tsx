
import type { ReactNode } from "react";
import { BookOpen, Terminal, Github } from "lucide-react";
import { ThemeProvider, ThemeToggle } from "@/components/theme-provider";
import { Quicksand } from "next/font/google";
import { SidebarProvider, Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { ChatHistory } from "@/components/sidebar/chat-history";
import { DocumentationModal } from "@/components/documentation/documentation-modal";
import { ChatProvider } from "@/context/chat-context";
import "./globals.css";

const quicksand = Quicksand({
  subsets: ["latin"],
  variable: "--font-quicksand",
});

export const metadata = {
  title: "TARS AI",
  description: "TARS is an AI-powered coding assistant that helps you with your coding tasks.",
  icons: {
    icon: "https://t4.ftcdn.net/jpg/04/22/92/29/360_F_422922955_XaGCE7Nqe8DyLiY7mGe5SACyp8N4oHTB.jpg",
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
                {/* Sidebar */}
                <Sidebar>
                  <div className="p-4 border-b">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center">
                        <img
                          src="https://t4.ftcdn.net/jpg/04/22/92/29/360_F_422922955_XaGCE7Nqe8DyLiY7mGe5SACyp8N4oHTB.jpg"
                          alt="Badge"
                          className="h-6 w-6 rounded-full"
                        />
                      </div>
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
                        <a href={"https://github.com/StefanKumarasinghe/CodeMasterPro/wiki/"} className="flex items-center w-full px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
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

                    {/* Chat History Section */}
                    <div className="flex-1 overflow-hidden">
                      <ChatHistory />
                    </div>

                    <div className="p-4 border-t text-xs text-muted-foreground mt-auto">
                      <p>© 2025 TARS AI. All rights reserved.</p>
                    </div>
                  </SidebarContent>
                </Sidebar>

                {/* Main Content */}
                <div className="flex-1 flex flex-col overflow-hidden relative">
                  <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
                </div>
              </div>
            </SidebarProvider>

            {/* Documentation Modal */}
            <DocumentationModal />
          </ChatProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
