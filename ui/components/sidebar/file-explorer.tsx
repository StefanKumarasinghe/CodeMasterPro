"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { API_ENDPOINT } from "@/config/constants";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  RefreshCw,
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Filter,
  AlertCircle,
  Trash,
  Save,
  Play,
} from "lucide-react";
import { toast } from "@/utils/toast-util";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useChat } from "@/context/chat-context";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NodeTestRunner } from "@/components/chat/node-test-runner";

interface FileItem {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileItem[];
  hasChildren?: boolean;
}

interface FileExplorerProps {
  onFileSelect: (filePath: string, fileName: string) => void;
  saveMode?: boolean;
  onFileSaveSelect?: (filePath: string, fileName: string) => void;
  contentToSave?: string;
}

export function FileExplorer({
  onFileSelect,
  saveMode = false,
  onFileSaveSelect,
}: FileExplorerProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  const [showOnlyPinned, setShowOnlyPinned] = useState(false);
  const [showTestRunner, setShowTestRunner] = useState(false);
  const [selectedDirectory, setSelectedDirectory] = useState("");
  const {
    mcp,
    pinnedFiles,
    addPinnedFile,
    removePinnedFile,
    clearPinnedFiles,
    getTotalPinnedChars,
  } = useChat();

  const MAX_PINNED_FILES = 5;
  const MAX_PINNED_CHARS = 80000;

  const fetchFiles = useCallback(
    async (path?: string, recursive: boolean = true) => {
      setIsLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        if (path) queryParams.append("path", path);
        queryParams.append("recursive", recursive.toString());
        const url = `${API_ENDPOINT}/project_files/?${queryParams.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to fetch project files");
        }
        const data = await response.json();
        setFiles(data);

        if (data.length > 0 && data.length <= 3) {
          const rootFolders = data
            .filter((item: FileItem) => item.type === "directory")
            .map((item: FileItem) => item.path);

          if (rootFolders.length > 0) {
            setExpandedFolders(new Set(rootFolders));
          }
        }
      } catch (error) {
        console.error("Error fetching project files:", error);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (mcp === "context") {
      fetchFiles();
    }
  }, [mcp, fetchFiles]);

  useEffect(() => {
    const handleMcpGithubSelected = () => {
      fetchFiles();
    };

    window.addEventListener("mcp-github-selected", handleMcpGithubSelected);

    return () => {
      window.removeEventListener(
        "mcp-github-selected",
        handleMcpGithubSelected
      );
    };
  }, [fetchFiles]);

  const toggleFolder = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const handleFileClick = (file: FileItem) => {
    if (file.type === "file") {
      if (saveMode && onFileSaveSelect) {
        onFileSaveSelect(file.path, file.name);
      } else {
        onFileSelect(file.path, file.name);
      }
    }
  };

  const togglePinFile = (file: FileItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (file.type !== "file") return;

    const isPinned = pinnedFiles.some(
      (pinnedFile) => pinnedFile.path === file.path
    );
    if (isPinned) {
      removePinnedFile(file.path);
    } else {
      if (pinnedFiles.length >= MAX_PINNED_FILES) {
        toast.error(
          `Cannot add more than ${MAX_PINNED_FILES} files to context. Remove some files first.`
        );
        return;
      }

      addPinnedFile(file.path, file.name);
    }
  };

  const toggleShowPinned = () => {
    setShowOnlyPinned((prev) => !prev);
  };

  const totalChars = getTotalPinnedChars();
  const usagePercentage = Math.min(
    100,
    Math.round((totalChars / MAX_PINNED_CHARS) * 100)
  );

  const filterFilesByPinned = (fileItems: FileItem[]) => {
    if (!showOnlyPinned) return fileItems;

    return fileItems.reduce((filtered, item) => {
      if (item.type === "directory") {
        if (item.children && item.children.length > 0) {
          const filteredChildren = filterFilesByPinned(item.children);
          if (filteredChildren.length > 0) {
            filtered.push({
              ...item,
              children: filteredChildren,
            });
          }
        }
      } else if (
        pinnedFiles.some((pinnedFile) => pinnedFile.path === item.path)
      ) {
        filtered.push(item);
      }
      return filtered;
    }, [] as FileItem[]);
  };

  const runTests = (directory: string) => {
    window.dispatchEvent(
      new CustomEvent("code-editor-close", {
        detail: { forced: true },
      })
    );

    window.dispatchEvent(
      new CustomEvent("python-shell-close", {
        detail: { forced: true },
      })
    );

    window.dispatchEvent(
      new CustomEvent("html-preview-close", {
        detail: { forced: true },
      })
    );

    setSelectedDirectory(directory);
    setShowTestRunner(true);
  };

  const renderFileItem = (file: FileItem, level = 0) => {
    const isExpanded = expandedFolders.has(file.path);
    const isDirectory = file.type === "directory";
    const hasChildren =
      isDirectory && file.children && file.children.length > 0;
    const isPinned =
      file.type === "file" &&
      pinnedFiles.some((pinnedFile) => pinnedFile.path === file.path);
    const hasPackageJson =
      isDirectory &&
      file.children &&
      file.children.some((child) => child.name === "package.json");
    return (
      <div key={file.path} className="flex flex-col w-full min-w-0">
        <div
          className={cn(
            "flex items-center py-1 px-1 rounded-md text-sm group",
            "hover:bg-muted/50 cursor-pointer",
            file.type === "file"
              ? "text-foreground"
              : "text-primary font-medium",
            isPinned && "bg-primary/10",
            saveMode &&
              file.type === "file" &&
              "hover:bg-green-100 dark:hover:bg-green-900/30"
          )}
          style={{ paddingLeft: `${level * 12 + 4}px` }}
          onClick={(e) =>
            file.type === "file"
              ? handleFileClick(file)
              : toggleFolder(file.path, e)
          }
          title={file.path}
        >
          <div className="mr-1 w-4 flex items-center justify-center flex-shrink-0">
            {isDirectory &&
              hasChildren &&
              (isExpanded ? (
                <ChevronDown
                  className="h-4 w-4"
                  onClick={(e) => toggleFolder(file.path, e)}
                />
              ) : (
                <ChevronRight
                  className="h-4 w-4"
                  onClick={(e) => toggleFolder(file.path, e)}
                />
              ))}
          </div>
          <div className="mr-2 flex-shrink-0">
            {isDirectory ? (
              isExpanded ? (
                <FolderOpen className="h-4 w-4 text-blue-500" />
              ) : (
                <div>
                  {isDirectory && hasPackageJson && !saveMode && (
                    <div className="absolute right-2 flex items-center gap-1 flex-shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 px-1 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              runTests(file.path);
                            }}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              )
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-5 w-5 px-1",
                  !isPinned && "opacity-0 group-hover:opacity-100"
                )}
                onClick={(e) => togglePinFile(file, e)}
                disabled={!isPinned && pinnedFiles.length >= MAX_PINNED_FILES}
                title={isPinned ? "Remove from context" : "Add to context"}
              >
                {isPinned ? (
                  <BookmarkCheck className="h-3 w-3 text-primary" />
                ) : (
                  <Bookmark className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>

          <span className="truncate min-w-0 flex-1" title={file.name}>
            {file.name}
          </span>

          {file.type === "file" && saveMode && (
            <div className="ml-auto flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 px-1 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFileClick(file);
                }}
                title="Save to this file"
              >
                <Save className="h-3 w-3 text-green-600 dark:text-green-400" />
              </Button>
            </div>
          )}
        </div>

        {isDirectory && isExpanded && file.children && (
          <div className="flex flex-col w-full min-w-0">
            {filterFilesByPinned(file.children).map((child) =>
              renderFileItem(child, level + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  if (mcp !== "context") {
    return null;
  }

  const filteredFiles = filterFilesByPinned(files);
  const isCharLimitApproaching = usagePercentage > 80;

  return (
    <div className="flex flex-col h-full border rounded-md ">
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
        <h3 className="text-sm py-2 font-medium flex items-center">
          <Folder className="h-4 w-4 mr-1.5  text-primary" />
          {saveMode ? "Select File to Save" : "Files"}
        </h3>
        <div className="flex items-center gap-1">
          {!saveMode && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showOnlyPinned ? "default" : "ghost"}
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={toggleShowPinned}
                  >
                    <Filter className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {showOnlyPinned
                    ? "Show all files"
                    : "Show only context files"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => fetchFiles()}
                  disabled={isLoading}
                >
                  <RefreshCw
                    className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Refresh files</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {!saveMode && pinnedFiles.length > 0 && (
        <div className="px-2 py-1.5 border-b bg-background">
          <div className="flex justify-start space-x-2 items-center mb-1">
            <Badge variant="outline" className="px-1.5 py-1.5 my-1 text-xs">
              {pinnedFiles.length}/{MAX_PINNED_FILES}
            </Badge>
            <Badge variant="outline" className="px-1.5 py-1.5 my-1 text-xs">
              {(totalChars / 1000).toFixed(1)}K
            </Badge>
            <Badge variant="outline" className="px-1.5 py-1.5 my-1 text-xs">
              {(MAX_PINNED_CHARS / 1000).toFixed(0)}K limit
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={clearPinnedFiles}
              title="Clear all context files"
            >
              <Trash className="h-3 w-3" />
            </Button>
          </div>

          <div className="space-y-3">
            <Progress
              value={usagePercentage}
              className="h-1.5 "
              indicatorClassName={cn(
                usagePercentage > 90
                  ? "bg-red-500"
                  : usagePercentage > 70
                  ? "bg-amber-500"
                  : "bg-green-500"
              )}
            />
          </div>

          {isCharLimitApproaching && (
            <div className="flex items-center gap-1 mt-1 text-xs text-amber-500">
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">Approaching character limit</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-2 text-xs text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/50 border-b">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {saveMode && (
        <div className="px-3 py-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-b">
          <p>Click on a file to save content</p>
        </div>
      )}

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-2 space-y-2 ">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 flex-shrink-0" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground flex flex-col items-center justify-center h-full">
            {showOnlyPinned ? (
              <>
                <Bookmark className="h-10 w-10 mb-2 text-muted-foreground/50" />
                <p className="text-center text-xs">No files in context yet</p>
              </>
            ) : (
              <>
                <Folder className="h-10 w-10 mb-2 text-muted-foreground/50" />
                <p className="text-center text-xs">No project files found</p>
              </>
            )}
          </div>
        ) : (
          <div className="p-1 w-full min-w-0 overflow-y-auto border-0 overflow-x-auto max-h-[calc(100vh-200px)]">
            {filteredFiles.map((file) => renderFileItem(file))}
          </div>
        )}
      </ScrollArea>

      {showTestRunner && (
        <NodeTestRunner
          isOpen={showTestRunner}
          onClose={() => setShowTestRunner(false)}
          directory={selectedDirectory}
        />
      )}
    </div>
  );
}
