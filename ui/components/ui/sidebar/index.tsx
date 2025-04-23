"use client"

import * as React from "react"

interface SidebarContextProps {
  open: boolean
  setOpen: (open: boolean) => void
  toggleSidebar: () => void
  state: "expanded" | "collapsed"
}

const SidebarContext = React.createContext<SidebarContextProps | undefined>(undefined)

interface SidebarProviderProps {
  children: React.ReactNode
  defaultOpen?: boolean
}

const useSidebar = () => {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

const SidebarProvider = ({ children, defaultOpen = false }: SidebarProviderProps) => {
  const [open, setOpen] = React.useState(defaultOpen)

  const toggleSidebar = React.useCallback(() => {
    setOpen((prevOpen) => !prevOpen)
  }, [])

  const state = open ? "expanded" : "collapsed"

  const value = React.useMemo(
    () => ({
      open,
      setOpen,
      toggleSidebar,
      state,
    }),
    [open, setOpen, toggleSidebar, state],
  )

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}

interface SidebarProps {
  children: React.ReactNode
}

const Sidebar = ({ children }: SidebarProps) => {
  const { state } = useSidebar()

  return (
    <aside
      className={`fixed top-0 left-0 h-full bg-secondary border-r border-secondary-foreground transition-transform duration-200 ${
        state === "expanded" ? "w-64 translate-x-0" : "-translate-x-full w-64 sm:translate-x-0 sm:w-20"
      } z-50 sm:z-0`}
    >
      {children}
    </aside>
  )
}

interface SidebarContentProps {
  children: React.ReactNode
}

const SidebarContent = ({ children }: SidebarContentProps) => {
  return <div className="flex flex-col h-full">{children}</div>
}

export { SidebarProvider, Sidebar, SidebarContent, useSidebar }
