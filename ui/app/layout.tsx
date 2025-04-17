import type React from "react"
import { BookOpen, Terminal, Github, LinkedinIcon } from "lucide-react"
import { ThemeProvider, ThemeToggle } from "@/components/theme-provider"
import { Quicksand } from "next/font/google"
import { SidebarProvider, Sidebar, SidebarContent } from "@/components/ui/sidebar"
import "./globals.css"

const quicksand = Quicksand({
  subsets: ["latin"],
  variable: "--font-quicksand",
})

export const metadata = {
  title: "TARS AI",
  description: "TARS is an AI-powered coding assistant that helps you with your coding tasks.",
  generator: "v0.dev",
  icons: {
    icon: "/favicon.ico",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={quicksand.variable}>
      <body className="font-quicksand">
        <ThemeProvider defaultTheme="dark" storageKey="code-assistant-theme" attribute="class">
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
                        className="h-6 w-6"
                      />
                    </div>
                    <span className="font-bold text-lg">TARS</span>
                  </div>
                </div>
                <SidebarContent>
                  <div className="space-y-4 p-4">
                    <nav className="space-y-1.5">
                      <button className="flex items-center w-full px-3 py-2 text-sm rounded-md bg-accent text-accent-foreground">
                        <Terminal className="mr-2 h-4 w-4" />
                        Coding Assistant
                      </button>
                      <button className="flex items-center w-full px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                        <BookOpen className="mr-2 h-4 w-4" />
                        Documentation
                      </button>
                    </nav>
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between px-3">
                        <span className="text-sm font-medium">Theme</span>
                        <ThemeToggle />
                      </div>
                    </div>
                    <div className=" border-b">
                    
                        <div className="flex justify-start items-start px-3 pb-3 ">
                        <a href="https://github.com/StefanKumarasinghe/CodeMasterPro" target="_blank" rel="noopener noreferrer" className="text-muted-foreground text-sm hover:text-foreground transition-colors flex items-center gap-1" aria-label="GitHub">GitHub<Github className="w-4" /></a>
                      </div>
                    </div>
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
        </ThemeProvider>
      </body>
    </html>
  )
}


import './globals.css'