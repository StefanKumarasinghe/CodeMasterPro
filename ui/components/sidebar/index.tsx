"use client";

import { useState, useEffect, useRef } from "react";
import { ChatHistory } from "./chat-history";
import { FileExplorer } from "./file-explorer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useChat } from "@/context/chat-context";
import { CodeEditorCanvas } from "@/components/canvas/code-editor-canvas";
import { API_ENDPOINT } from "@/config/constants";
import { toast } from "@/utils/toast-util";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<string>("history");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{
    path: string;
    name: string;
    content: string;
  } | null>(null);
  const { mcp, setMcp } = useChat();
  
  useEffect(() => {
    if (mcp === "context") {
      setActiveTab("files");
    } else {
      setActiveTab("history");
    }
  }, [mcp]);

  const handleFileSelect = async (filePath: string, fileName: string) => {
    try {
      const response = await fetch(`${API_ENDPOINT}/file_content/?file_path=${encodeURIComponent(filePath)}`);
      if (!response.ok) {
        throw new Error("Failed to fetch file content");
      }
      const data = await response.json();
      setSelectedFile({
        path: filePath,
        name: fileName,
        content: data.content
      });
      setIsEditorOpen(true);
    } catch (error) {
      toast.error("Failed to load file content, the file not be supported");
    }
  };

  const handleEditorClose = () => {
    setIsEditorOpen(false);
    setSelectedFile(null);
  };

  const handleFileSave = async (newContent: string) => {
    if (!selectedFile) return;
    
    try {
      const response = await fetch(`${API_ENDPOINT}/save_file_content/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_path: selectedFile.path,
          content: newContent,
          overwrite: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save file: ${response.statusText}`);
      }

      toast.success(`Changes saved to ${selectedFile.name}`);
      
      // Update the local state with the new content
      setSelectedFile({
        ...selectedFile,
        content: newContent
      });
      
    } catch (error) {
      console.error("Error saving file:", error);
      toast.error(`Failed to save file: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 w-full rounded-none flex flex-col">
        <div className="border-b">
          <TabsList className="w-full rounded-none dark:bg-zinc-700 ">
            <TabsTrigger value="history" className="flex-1" onClick={() => setMcp("auto")}>
              History
            </TabsTrigger>
            <TabsTrigger value="files" className="flex-1" onClick={() => setMcp("context")}>
              Codespace
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="history" className="flex-1 mt-0">
          <ChatHistory />
        </TabsContent>
        
        <TabsContent value="files" className="flex-1 mt-0">
          <FileExplorer onFileSelect={handleFileSelect} />
        </TabsContent>
      </Tabs>

      {isEditorOpen && selectedFile && (
        <CodeEditorCanvas
          code={selectedFile.content}
          language=""
          isOpen={isEditorOpen}
          onClose={handleEditorClose}
          onSave={handleFileSave}
          filename={selectedFile.path}
        />
      )}
    </div>
  );
}

export function ResizableSidebar() {
  const sidebarContext = (() => {
    try {
      return useSidebar();
    } catch (e) {
      console.error("Sidebar context not available:", e);
      return null;
    }
  })();
  
  const { 
    width, 
    setWidth, 
    isResizing, 
    setIsResizing,
    fontScale,
    setFontScale
  } = sidebarContext || {
    width: 100,
    setWidth: () => {},
    isResizing: false,
    setIsResizing: () => {},
    fontScale: 1,
    setFontScale: () => {}
  };
  
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!setIsResizing) return;
    
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = width;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!setWidth) return;
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(200, Math.min(500, startWidth + deltaX));
      setWidth(newWidth);
      
      document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
      
      if (setFontScale) {
        const scale = 0.8 + (newWidth - 200) / (500 - 200) * 0.4;
        setFontScale(scale);
        document.documentElement.style.setProperty('--font-scale', scale.toString());
      }
      
      document.body.style.cursor = 'col-resize';
    };
    
    const handleMouseUp = () => {
      if (!setIsResizing) return;
      setIsResizing(false);
      document.body.style.cursor = '';
      
      localStorage.setItem('sidebar-width', width.toString());
      localStorage.setItem('sidebar-font-scale', fontScale.toString());
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  return (
    <div className="relative h-full w-full">
      <Sidebar />
      <div 
        className={cn(
          "absolute top-0 right-0 w-4 h-full cursor-col-resize z-50 flex items-center justify-center",
          "hover:bg-gradient-to-l  from-primary/10 to-transparent",
          isResizing && "bg-gradient-to-l from-primary/20 to-transparent"
        )}
        onMouseDown={handleMouseDown}
      >
        <div className={cn(
          "w-1 h-20 rounded-full bg-transparent flex items-center justify-center",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
          "hover:bg-primary/30",
          isResizing ? "opacity-100 bg-primary/40" : "hover:opacity-100"
        )}>
          <GripVertical className="h-6 w-6 text-primary/50" style={{ opacity: isResizing ? 1 : 0.5 }} />
        </div>
      </div>
    </div>
  );
} 