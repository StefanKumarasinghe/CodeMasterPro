"use client";

import { useState, useRef, useEffect } from "react";
import { X, Maximize2, Minimize2, RefreshCw, Code, ExternalLink, AlertTriangle, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
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
  const { theme, setTheme } = useTheme();
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

  // Safe exit from fullscreen - ensure we return to dialog mode properly
  const handleExitFullscreen = () => {
    setIsFullscreen(false);
    // Allow time for state transition before header recalculation
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
      // Sanitize HTML content to prevent script injection and other issues
      const sanitizedHtml = htmlContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '<!-- Scripts removed for security -->');
      
      // Determine if we should use dark mode styles
      const isDarkTheme = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      
      const safeHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <base target="_blank">
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              :root {
                color-scheme: ${isDarkTheme ? 'dark' : 'light'};
              }
              
              body {
                line-height: 1.6;
                padding: 1rem;
                max-width: 100%;
                margin: 0;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                ${isDarkTheme ? 'background-color: #171717; color: #f5f5f5;' : 'background-color: #ffffff; color: #171717;'}
                overflow-x: hidden;
              }
              
              * {
                box-sizing: border-box;
              }
              
              img, video, iframe {
                max-width: 100%;
                height: auto;
                border-radius: 4px;
                ${isDarkTheme ? 'filter: brightness(0.9);' : ''}
              }
              
              a {
                color: ${isDarkTheme ? '#60a5fa' : '#2563eb'};
                text-decoration: none;
              }
              
              a:hover {
                text-decoration: underline;
              }
              
              pre, code {
                padding: 0.2em 0.4em;
                background-color: ${isDarkTheme ? '#262626' : '#f5f5f5'};
                border-radius: 3px;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                overflow-x: auto;
              }
              
              pre {
                padding: 1em;
                line-height: 1.5;
                border-radius: 6px;
                border: 1px solid ${isDarkTheme ? '#404040' : '#e5e5e5'};
              }
              
              pre code {
                background-color: transparent;
                padding: 0;
              }
              
              h1, h2, h3, h4, h5, h6 {
                color: ${isDarkTheme ? '#f5f5f5' : '#171717'};
                margin-top: 1.5em;
                margin-bottom: 0.75em;
                line-height: 1.2;
              }
              
              h1 { font-size: 2em; }
              h2 { font-size: 1.5em; }
              h3 { font-size: 1.25em; }
              
              p {
                margin: 1em 0;
              }
              
              /* Responsive adjustments */
              @media (min-width: 768px) {
                body {
                  padding: 1.5rem;
                }
              }
              
              /* Table styles */
              table {
                border-collapse: collapse;
                width: 100%;
                margin: 1rem 0;
                overflow-x: auto;
                display: block;
              }
              
              table, th, td {
                border: 1px solid ${isDarkTheme ? '#404040' : '#e5e5e5'};
              }
              
              th, td {
                padding: 8px 12px;
                text-align: left;
              }
              
              th {
                background-color: ${isDarkTheme ? '#262626' : '#f5f5f5'};
              }
              
              /* Alternating row colors */
              tr:nth-child(even) {
                background-color: ${isDarkTheme ? '#1e1e1e' : '#fafafa'};
              }
              
              /* Error handling */
              .html-error {
                padding: 1rem;
                background-color: ${isDarkTheme ? '#442c2d' : '#fff0f0'};
                color: ${isDarkTheme ? '#f87171' : '#ef4444'};
                border-left: 4px solid ${isDarkTheme ? '#f87171' : '#ef4444'};
                margin: 1rem 0;
                border-radius: 0 4px 4px 0;
              }
              
              /* Prevent overflow issues */
              html, body {
                max-width: 100vw;
                overflow-x: hidden;
              }
              
              /* Fix for common markdown rendering issues */
              ul, ol {
                padding-left: 2rem;
                margin: 1em 0;
              }
              
              blockquote {
                border-left: 4px solid ${isDarkTheme ? '#404040' : '#e5e5e5'};
                margin: 1rem 0;
                padding-left: 1rem;
                color: ${isDarkTheme ? '#a3a3a3' : '#525252'};
              }
              
              button {
                background-color: ${isDarkTheme ? '#2563eb' : '#3b82f6'};
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                transition: background-color 0.2s;
              }
              
              button:hover {
                background-color: ${isDarkTheme ? '#1d4ed8' : '#2563eb'};
              }
              
              input, select, textarea {
                padding: 8px 12px;
                border: 1px solid ${isDarkTheme ? '#525252' : '#d4d4d4'};
                border-radius: 4px;
                background-color: ${isDarkTheme ? '#262626' : '#ffffff'};
                color: ${isDarkTheme ? '#f5f5f5' : '#171717'};
                font-size: 14px;
              }
              
              .container {
                width: 100%;
                max-width: 1200px;
                margin: 0 auto;
                padding: 0 1rem;
              }
              
              .card {
                background-color: ${isDarkTheme ? '#262626' : '#ffffff'};
                border-radius: 8px;
                padding: 1.5rem;
                box-shadow: 0 1px 3px rgba(0,0,0,${isDarkTheme ? '0.2' : '0.1'});
                border: 1px solid ${isDarkTheme ? '#404040' : '#e5e5e5'};
                margin-bottom: 1.5rem;
              }
              
              hr {
                border: 0;
                height: 1px;
                background-color: ${isDarkTheme ? '#404040' : '#e5e5e5'};
                margin: 1.5rem 0;
              }
            </style>
            
            <script>
              // Handle rendering errors
              window.onerror = function(msg, url, line, col, error) {
                console.error('HTML Preview Error:', msg);
                if (!document.querySelector('.html-error')) {
                  var errorDiv = document.createElement('div');
                  errorDiv.className = 'html-error';
                  errorDiv.innerHTML = '<strong>Rendering Error:</strong> ' + msg;
                  document.body.prepend(errorDiv);
                }
                return true;
              };
              
              // Prevent infinite loops
              (function() {
                let iterationCount = 0;
                const originalSetTimeout = window.setTimeout;
                window.setTimeout = function(callback, delay, ...args) {
                  iterationCount++;
                  if (iterationCount > 1000) {
                    console.error('Too many recursive calls detected, stopping execution');
                    return 0;
                  }
                  return originalSetTimeout(callback, delay, ...args);
                };
              })();
              
              // Send loaded event to parent
              window.addEventListener('load', function() {
                window.parent.postMessage('iframe-loaded', '*');
              });
            </script>
          </head>
          <body>
            <div id="html-content-container">
              ${sanitizedHtml}
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

  // Listen for iframe loaded message
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