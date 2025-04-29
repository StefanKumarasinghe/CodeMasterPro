"use client";

import { useState } from "react";
import { Download, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogTrigger,DialogFooter} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "@/utils/toast-util";
import { formatDate } from "@/utils/format-utils";
import type { Message } from "ai";

interface ChatHistoryDownloadProps {
  messages: Message[];
}

export function ChatHistoryDownload({ messages }: ChatHistoryDownloadProps) {
  const [format, setFormat] = useState<"markdown" | "html">("markdown");
  const [isOpen, setIsOpen] = useState(false);

  const formatChatHistoryAsMarkdown = (messages: Message[]): string => {
    if (messages.length === 0) return "# Chat History\n\nNo messages yet.";
    const date = new Date();
    let markdown = `# TARS Chat History\n\n`;
    markdown += `*Generated on ${formatDate(date)}*\n\n`;
    messages.forEach((message, index) => {
      const role = message.role === "user" ? "## You" : "## TARS";
      markdown += `${role}\n\n${message.content}\n\n`;
      if (index < messages.length - 1) {
        markdown += `---\n\n`;
      }
    });
    return markdown;
  };

  const formatChatHistoryAsHTML = (messages: Message[]): string => {
    if (messages.length === 0)
      return "<h1>Chat History</h1><p>No messages yet.</p>";
    const date = new Date();
    let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TARS Chat History</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
      }
      h1 {
        color: #6366f1;
        border-bottom: 2px solid #6366f1;
        padding-bottom: 10px;
      }
      .meta {
        color: #666;
        font-style: italic;
        margin-bottom: 30px;
      }
      .message {
        margin-bottom: 30px;
        border-bottom: 1px solid #eee;
        padding-bottom: 20px;
      }
      .message:last-child {
        border-bottom: none;
      }
      .role {
        font-weight: bold;
        color: #6366f1;
        margin-bottom: 10px;
      }
      .user {
        color: #3b82f6;
      }
      .assistant {
        color: #10b981;
      }
      pre {
        background-color: #f7f7f7;
        padding: 10px;
        border-radius: 5px;
        overflow-x: auto;
      }
      code {
        font-family: 'Courier New', Courier, monospace;
      }
    </style>
    </head>
    <body>
    <h1>TARS Chat History</h1>
    <div class="meta">Generated on ${formatDate(date)}</div>`;
    messages.forEach((message) => {
      const roleClass = message.role === "user" ? "user" : "assistant";
      const roleName = message.role === "user" ? "You" : "TARS";
      html += `  <div class="message">
    <div class="role ${roleClass}">${roleName}</div>
    <div class="content">${formatMessageContent(message.content)}</div>
    </div>`;
    });

    html += `</body>
    </html>`;

    return html;
  };

  const formatMessageContent = (content: string): string => {
    let formatted = content.replace(
      /```(\w+)?\n([\s\S]*?)```/g,
      (match, lang, code) => {
        return `<pre><code>${code
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</code></pre>`;
      }
    );
    formatted = formatted.replace(/\n/g, "<br>");
    return formatted;
  };

  const downloadChatHistory = () => {
    if (messages.length === 0) {
      toast.warning("No messages to download");
      return;
    }
    let content = "";
    let fileExtension = "";
    let mimeType = "";
    if (format === "markdown") {
      content = formatChatHistoryAsMarkdown(messages);
      fileExtension = "md";
      mimeType = "text/markdown";
    } else {
      content = formatChatHistoryAsHTML(messages);
      fileExtension = "html";
      mimeType = "text/html";
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tars-chat-history-${new Date()
      .toISOString()
      .slice(0, 10)}.${fileExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Chat history downloaded as ${format.toUpperCase()}`);
    setIsOpen(false);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Download Chat</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download Chat History</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Download your chat history as a document for future reference.
          </p>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-3">Choose Format</h4>
              <RadioGroup
                value={format}
                onValueChange={(value) =>
                  setFormat(value as "markdown" | "html")
                }
              >
                <div className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value="markdown" id="markdown" />
                  <Label htmlFor="markdown">Markdown (.md)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="html" id="html" />
                  <Label htmlFor="html">HTML Document (.html)</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="bg-muted/50 p-3 rounded-md">
              <h4 className="text-sm font-medium mb-2">Format Details</h4>
              <p className="text-xs text-muted-foreground">
                {format === "markdown"
                  ? "Markdown is a lightweight markup language that can be viewed in text editors and converted to other formats."
                  : "HTML provides a formatted document that can be opened in any web browser with proper styling."}
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={downloadChatHistory} className="gap-1">
            <FileDown className="h-4 w-4" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
