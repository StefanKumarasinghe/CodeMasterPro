"use client";

import { useState, useRef, useEffect } from "react";
import { X, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface HtmlPreviewProps {
  htmlContent: string;
  isOpen: boolean;
  onClose: () => void;
}

export function HtmlPreview({
  htmlContent,
  isOpen,
  onClose,
}: HtmlPreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (!isOpen) {
      setIsConfirmed(false);
    }
  }, [isOpen]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const renderHtml = () => {
    const safeHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <base target="_blank">
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              line-height: 1.5;
              padding: 1rem;
              max-width: 100%;
            }
            img, video, iframe {
              max-width: 100%;
            }
          </style>
        </head>
        <body>${htmlContent}</body>
      </html>
    `;
    return safeHtml;
  };

  if (!isConfirmed) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Security Warning</DialogTitle>
          </DialogHeader>
          <Alert variant="destructive" className="my-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Running HTML code can be potentially unsafe. The code might
              contain scripts that could access your data or perform unwanted
              actions.
            </AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground mb-4">
            Only run HTML from sources you trust. TARS cannot guarantee the
            safety of the code.
          </p>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={onClose} className="sm:mr-auto">
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => setIsConfirmed(true)}>
              I understand the risks, run the code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div
      className={`fixed ${
        isFullscreen
          ? "inset-0 z-50"
          : "bottom-4 left-4 w-[500px] h-[400px] z-40"
      } bg-background border rounded-lg shadow-lg transition-all duration-300 overflow-hidden`}
    >
      <div className="flex items-center justify-between p-2 border-b bg-muted/50">
        <h3 className="text-sm font-medium">HTML Preview</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div
        className={`w-full ${
          isFullscreen ? "h-[calc(100%-40px)]" : "h-[calc(400px-40px)]"
        } bg-white`}
      >
        <iframe
          key={refreshKey}
          ref={iframeRef}
          srcDoc={renderHtml()}
          title="HTML Preview"
          className="w-full h-full border-none"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  );
}
