"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, FileText, FileCode, FileJson, File, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatFileSize } from "@/utils/format-utils";
import { CodeEditorCanvas } from "../canvas/code-editor-canvas";
import { useChat } from "@/context/chat-context";

interface FileAttachmentProps {
  fileName: string;
  fileSize?: number;
  contentLength: number;
  language: string;
  content?: string;
  isLargeText?: boolean;
  onRemove: () => void;
  onContentChange?: (newContent: string) => void;
}

export function FileAttachment({
  fileName,
  fileSize,
  contentLength,
  language,
  content = "",
  isLargeText,
  onRemove,
  onContentChange
}: FileAttachmentProps) {
  const [showEditor, setShowEditor] = useState(false);
  const { setIsPreview } = useChat();
  useEffect(() => {
    return () => {
      if (onContentChange && content) {
        onContentChange(content);
      }
      window.dispatchEvent(new CustomEvent("code-editor-state", { detail: { isOpen: false } }));

    };
  }, []);
  

  const getFileIcon = () => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    if (
      [
        "js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "cs", "go", "rb", 
        "php", "rs", "swift", "kt", "scala", "sh", "bat", "pl", "lua", "r", 
        "html", "css", "scss", "less", "json", "xml", "yaml", "yml", "sql",
        "dockerfile", "md", "txt", "csv", "log", "toml", "ini", "properties",
        ].includes(extension || "")
    ) {
      return <FileCode className="h-4 w-4" />;
    } else if (["json", "xml", "yaml", "yml"].includes(extension || "")) {
      return <FileJson className="h-4 w-4" />;
    } else if (["txt", "md", "csv", "log"].includes(extension || "")) {
      return <FileText className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  const handleEditorSave = (newContent: string) => {
    if (onContentChange) {
      onContentChange(newContent);
    }
    setIsPreview(false);
    setShowEditor(false);
  };

  const handleClick = () => {
    setIsPreview(true);
    setShowEditor(true);
  };

  const handleRemove = () => {
    if (showEditor) {
      window.dispatchEvent(new CustomEvent("code-editor-state", { 
        detail: { isOpen: false, width: 0 } 
      }));
      setIsPreview(false);
      setShowEditor(false);
    }
    onRemove();
  };

  return (
    <>
      <div className="flex items-center gap-2 bg-muted/50  rounded-md p-2 text-sm">
        <div className="text-primary cursor-pointer" >{getFileIcon()}</div>
        <div className="flex-1 min-w-0 cursor-pointer">
          <div className="flex items-center gap-1">
            <span className="text-xs truncate">{fileName}</span>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            {fileSize && <span>{formatFileSize(fileSize)}</span>}
            <span>•</span>
            <span>{contentLength} chars</span>
            <span>•</span>
            {language && (
                <span>{language}</span>
            )}
          </div>
        </div>
        {isLargeText && content && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 ml-1"
            onClick={handleClick}
          >
            <Eye className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 rounded-full hover:bg-destructive/10 hover:text-destructive"
          onClick={handleRemove}
        >
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Remove file</span>
        </Button>
      </div>

      {showEditor && (
        <CodeEditorCanvas
          code={content || ""}
          language={language || "markdown"}
          isOpen={showEditor}
          onClose={() => {
            setShowEditor(false);
            setIsPreview(false);
          }}
          onSave={handleEditorSave}
        />
      )}
    </>
  );
}
