"use client"

import { X, FileText, FileCode, FileJson, File } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatFileSize } from "@/utils/format-utils"

interface FileAttachmentProps {
  fileName: string
  fileSize: number
  contentLength: number
  language?: string
  onRemove: () => void
}

export function FileAttachment({ fileName, fileSize, contentLength, language, onRemove }: FileAttachmentProps) {
  // Determine file icon based on extension
  const getFileIcon = () => {
    const extension = fileName.split(".").pop()?.toLowerCase()

    if (["js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "cs", "go", "rb", "php", "rs"].includes(extension || "")) {
      return <FileCode className="h-4 w-4" />
    } else if (["json", "xml", "yaml", "yml"].includes(extension || "")) {
      return <FileJson className="h-4 w-4" />
    } else if (["txt", "md", "csv", "log"].includes(extension || "")) {
      return <FileText className="h-4 w-4" />
    }

    return <File className="h-4 w-4" />
  }

  return (
    <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2 text-sm">
      <div className="text-primary">{getFileIcon()}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="font-medium truncate">{fileName}</span>
          {language && (
            <Badge variant="outline" className="text-xs">
              {language}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span>{formatFileSize(fileSize)}</span>
          <span>•</span>
          <span>{contentLength} chars</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 rounded-full hover:bg-destructive/10 hover:text-destructive"
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
        <span className="sr-only">Remove file</span>
      </Button>
    </div>
  )
}
