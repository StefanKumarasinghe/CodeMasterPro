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
    let markdown = `#Chat History\n\n`;
    markdown += `*Generated on ${formatDate(date)}*\n\n`;
    messages.forEach((message, index) => {
      const role = message.role === "user" ? "## You" : "## CodeMasterPro";
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
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>CodeMasterPro Chat History</title>
      <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Quicksand', sans-serif;
          background: #f9fafb;
          color: #1f2937;
          max-width: 800px;
          margin: 40px auto;
          padding: 30px;
          border-radius: 16px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          background-color: #ffffff;
        }
        h1 {
          color: #4f46e5;
          font-size: 2em;
          margin-bottom: 10px;
          border-bottom: 3px solid #4f46e5;
          padding-bottom: 10px;
        }
        .meta {
          font-size: 0.95em;
          color: #6b7280;
          margin-bottom: 20px;
        }
        .chat-container {
          max-height: 500px;
          overflow-y: auto;
          padding-right: 10px;
        }
        .message {
          padding: 20px;
          margin-bottom: 20px;
          background: #f3f4f6;
          border-radius: 12px;
          border-left: 6px solid #4f46e5;
          box-shadow: 0 2px 6px rgba(0,0,0,0.04);
        }
        .role {
          font-weight: 600;
          margin-bottom: 10px;
        }
        .user {
          color: #2563eb;
        }
        .assistant {
          color: #10b981;
        }
        pre {
          background: #f1f5f9;
          padding: 12px;
          border-radius: 8px;
          overflow-x: auto;
        }
        code {
          font-family: 'Courier New', Courier, monospace;
          font-size: 0.95em;
          color: #1e293b;
        }
  
        /* Smooth scroll */
        .chat-container::-webkit-scrollbar {
          width: 8px;
        }
        .chat-container::-webkit-scrollbar-thumb {
          background-color: #d1d5db;
          border-radius: 6px;
        }
      </style>
    </head>
    <body>
      <h1>CodeMasterPro Chat History</h1>
      <div class="meta">Generated on ${formatDate(date)}</div>
      <div class="chat-container">
    `;
  
    messages.forEach((message) => {
      const roleClass = message.role === "user" ? "user" : "assistant";
      const roleName = message.role === "user" ? "You" : "CodeMasterPro";
      html += `
        <div class="message">
          <div class="role ${roleClass}">${roleName}</div>
          <div class="content">${formatMessageContent(message.content)}</div>
        </div>
      `;
    });
  
    html += `
      </div> <!-- end chat-container -->
    </body>
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
    a.download = `chat-history-${new Date()
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
    <div className="hidden md:block">
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          <Download  className="text-muted-foreground h-4 w-4 hover:text-primary hover:bg-muted-foreground/10 rounded-md" />
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
    </div>
  );
}