"use client";

import { useState, useRef, useEffect } from "react";
import { X, Maximize2, Minimize2, RefreshCw, Code, AlertTriangle, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTheme } from "next-themes";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface HtmlPreviewProps {
  htmlContent: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export function HtmlPreview({
  htmlContent,
  isOpen,
  onClose,
  title = "HTML Preview"
}: HtmlPreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { theme } = useTheme();
  const [iframeHeight, setIframeHeight] = useState("calc(100% - 48px)");
  const headerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingState, setLoadingState] = useState<"loading" | "loaded" | "error">("loading");
  
  useEffect(() => {
    if (!isOpen) {
      setIsConfirmed(false);
      setIsFullscreen(false);
      setRenderError(null);
      setLoadingState("loading");
    }
  }, [isOpen]);

  useEffect(() => {
    if (headerRef.current) {
      const headerHeight = headerRef.current.offsetHeight;
      setIframeHeight(`calc(100% - ${headerHeight}px)`);
    }
  }, [isFullscreen]);

  const handleRefresh = () => {
    setRenderError(null);
    setLoadingState("loading");
    setRefreshKey((prev) => prev + 1);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleExitFullscreen = () => {
    setIsFullscreen(false);
    setTimeout(() => {
      if (headerRef.current) {
        const headerHeight = headerRef.current.offsetHeight;
        setIframeHeight(`calc(100% - ${headerHeight}px)`);
      }
    }, 50);
  };

  const handleIframeError = () => {
    setRenderError("Failed to render HTML content. The HTML may contain errors or unsupported features.");
    setLoadingState("error");
  };

  const handleIframeLoad = () => {
    setLoadingState("loaded");
  };

  const copyHtmlContent = () => {
    navigator.clipboard.writeText(htmlContent).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      (err) => {
        console.error("Could not copy text: ", err);
      }
    );
  };

  const renderHtml = () => {
    try {
      const isDarkTheme = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      const safeHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <base target="_blank">
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body>
            <div id="html-content-container">
              ${htmlContent}
            </div>
          </body>
        </html>
      `;
      return safeHtml;
    } catch (error) {
      console.error("Error rendering HTML:", error);
      setRenderError("Failed to process HTML content due to an error.");
      setLoadingState("error");
      return `
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"></head>
          <body>
            <div style="color: red; padding: 20px; border: 1px solid red;">
              Error rendering HTML content. Please check console for details.
            </div>
          </body>
        </html>
      `;
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'iframe-loaded') {
        setLoadingState("loaded");
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (!isConfirmed) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="h-5 w-5 text-amber-500" />
              HTML Preview Security Warning
            </DialogTitle>
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
            Only run HTML from sources you trust. CodeMasterPro cannot guarantee the
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

  if (isFullscreen) {
    return (
      <div 
        className="fixed inset-0 z-50 bg-background transition-all duration-300 overflow-hidden"
      >
        <div 
          ref={headerRef}
          className="sticky top-0 left-0 right-0 flex items-center justify-between p-3 bg-background/90 backdrop-blur transition-all duration-300 z-10 border-b"
        >
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-medium">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={copyHtmlContent}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{copied ? "Copied!" : "Copy HTML"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleRefresh}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleExitFullscreen}
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Exit Fullscreen</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 mr-2"
                    onClick={onClose}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Close</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <div className="w-full h-full" style={{ height: `calc(100% - ${headerRef.current?.offsetHeight || 48}px)` }}>
          {loadingState === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/80 backdrop-blur-sm">
              <div className="flex flex-col items-center">
                <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                <p className="mt-4 text-sm text-muted-foreground">Loading preview...</p>
              </div>
            </div>
          )}
          
          {renderError && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-background/95">
              <div className="max-w-md p-6 bg-destructive/10 border border-destructive rounded-lg shadow-lg">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-medium text-destructive text-lg mb-2">Rendering Error</h3>
                    <p className="text-sm mb-4">{renderError}</p>
                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleRefresh}
                        className="flex items-center gap-1 ml-4 px-3"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Try Again
                      </Button>

                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <iframe
            key={refreshKey}
            ref={iframeRef}
            srcDoc={renderHtml()}
            title="HTML Preview"
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin"
            onError={handleIframeError}
            onLoad={handleIframeLoad}
          />
        </div>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl max-h-[85vh] p-0 rounded-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div ref={headerRef} className="flex items-center p-3 gap-4 border-b bg-muted/30 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-1 rounded text-primary">
              <Code className="h-5 w-5" />
            </div>
            <h3 className="text-base font-medium">{title}</h3>
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={copyHtmlContent}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{copied ? "Copied!" : "Copy HTML"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleRefresh}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 mr-4 pr-4"
                    onClick={toggleFullscreen}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Fullscreen</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <div className="w-full relative" style={{ height: "65vh", position: "relative" }}>
          {loadingState === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/80 backdrop-blur-sm">
              <div className="flex flex-col items-center">
                <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                <p className="mt-4 text-sm text-muted-foreground">Loading preview...</p>
              </div>
            </div>
          )}
          
          {renderError && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-background/95">
              <div className="max-w-md p-6 bg-destructive/10 border border-destructive rounded-lg shadow-lg">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-medium text-destructive text-lg mb-2">Rendering Error</h3>
                    <p className="text-sm mb-4">{renderError}</p>
                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleRefresh}
                        className="flex items-center gap-1"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Try Again
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <iframe
            key={refreshKey}
            ref={iframeRef}
            srcDoc={renderHtml()}
            title="HTML Preview"
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin"
            onError={handleIframeError}
            onLoad={handleIframeLoad}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}