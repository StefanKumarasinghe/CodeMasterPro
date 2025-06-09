"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/utils/toast-util";
import { API_ENDPOINT } from "@/config/constants";
import {
  FileText,
  Folder,
  FolderOpen,
  Code,
  Eye,
  X,
  Loader2,
  ChevronRight,
  ChevronDown,
  BarChart3,
  Package,
  Maximize2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatFileSize } from "@/utils/format-utils";
import { showProgressIndicator, hideProgressIndicator } from "@/components/progress-indicator";

interface FileTreeItem {
  name: string;
  type: "file" | "directory";
  path: string;
  size?: number;
  extension?: string;
  language?: string;
  children?: FileTreeItem[];
}

interface ProjectAnalysis {
  repo_name: string;
  total_files: number;
  total_size_mb: number;
  file_types: Record<string, number>;
  languages: Record<string, string>;
}

interface ProjectStructure {
  project_id: string;
  file_tree: FileTreeItem[];
  analysis: ProjectAnalysis;
}

interface FileContent {
  project_id: string;
  file_path: string;
  content: string;
  size: number;
  extension: string;
  language: string;
  encoding: string;
}

interface GitHubProjectViewerProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
}

const getLanguageColor = (language: string): string => {
  const colors: Record<string, string> = {
    javascript: "bg-yellow-500",
    typescript: "bg-blue-500",
    python: "bg-green-500",
    java: "bg-orange-500",
    cpp: "bg-purple-500",
    c: "bg-gray-600",
    go: "bg-cyan-500",
    rust: "bg-red-600",
    php: "bg-purple-700",
    ruby: "bg-red-500",
    html: "bg-orange-400",
    css: "bg-blue-400",
    text: "bg-gray-400",
  };
  return colors[language] || "bg-gray-400";
};

const FileTreeNode: React.FC<{
  item: FileTreeItem;
  level: number;
  onFileClick: (filePath: string) => void;
}> = ({ item, level, onFileClick }) => {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels

  const handleToggle = () => {
    if (item.type === "directory") {
      setIsExpanded(!isExpanded);
    }
  };

  const handleFileClick = () => {
    if (item.type === "file") {
      onFileClick(item.path);
    }
  };

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer transition-colors ${
          level === 0 ? "pl-2" : `pl-${level * 4 + 2}`
        }`}
        onClick={item.type === "directory" ? handleToggle : handleFileClick}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {item.type === "directory" ? (
          <>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 text-blue-500" />
            ) : (
              <Folder className="h-4 w-4 text-blue-500" />
            )}
            <span className="text-sm font-medium">{item.name}</span>
            {item.children && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {item.children.length}
              </Badge>
            )}
          </>
        ) : (
          <>
            <div className="w-4" /> {/* Spacer for alignment */}
            <Code className="h-4 w-4 text-green-500" />
            <span className="text-sm">{item.name}</span>
            {item.size && (
              <Badge variant="outline" className="ml-auto text-xs">
                {formatFileSize(item.size)}
              </Badge>
            )}
            {item.language && item.language !== "text" && (
              <div
                className={`w-2 h-2 rounded-full ml-1 ${getLanguageColor(
                  item.language
                )}`}
                title={item.language}
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-1 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                handleFileClick();
              }}
            >
              <Eye className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
      {item.type === "directory" && isExpanded && item.children && (
        <div>
          {item.children.map((child, index) => (
            <FileTreeNode
              key={`${child.path}-${index}`}
              item={child}
              level={level + 1}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const GitHubProjectViewer: React.FC<GitHubProjectViewerProps> = ({
  projectId,
  projectName,
  isOpen,
  onClose,
}) => {
  const [projectStructure, setProjectStructure] = useState<ProjectStructure | null>(null);
  const [currentFile, setCurrentFile] = useState<FileContent | null>(null);
  const [isLoadingStructure, setIsLoadingStructure] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [fileViewerOpen, setFileViewerOpen] = useState(false);

  const loadProjectStructure = async () => {
    if (isLoadingStructure) return;

    setIsLoadingStructure(true);
    showProgressIndicator("Loading project structure...");

    try {
      const response = await fetch(
        `${API_ENDPOINT}/get_github_project_structure/${encodeURIComponent(projectId)}`
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to load project structure: ${response.status} - ${errorText}`
        );
      }
      const data: ProjectStructure = await response.json();
      setProjectStructure(data);
    } catch (error) {
      console.error("Failed to load project structure:", error);
      toast.error("Failed to load project structure. Please try again.");
    } finally {
      setIsLoadingStructure(false);
      hideProgressIndicator();
    }
  };

  const loadFileContent = async (filePath: string) => {
    if (isLoadingFile) return;

    setIsLoadingFile(true);
    showProgressIndicator("Loading file content...");

    try {
      const response = await fetch(
        `${API_ENDPOINT}/get_github_project_file/${encodeURIComponent(
          projectId
        )}?file_path=${encodeURIComponent(filePath)}`
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to load file content: ${response.status} - ${errorText}`
        );
      }
      const data: FileContent = await response.json();
      setCurrentFile(data);
    } catch (error) {
      console.error("Failed to load file content:", error);
      toast.error("Failed to load file content. Please try again.");
    } finally {
      setIsLoadingFile(false);
      hideProgressIndicator();
    }
  };

  // Load project structure when modal opens
  React.useEffect(() => {
    if (isOpen && !projectStructure) {
      loadProjectStructure();
    }
  }, [isOpen]);

  const handleClose = () => {
    setProjectStructure(null);
    setCurrentFile(null);
    setFileViewerOpen(false);
    onClose();
  };

  return (
    <>
      {/* Project Structure Modal */}
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="md:max-w-6xl w-full h-[90vh] md:h-[85vh] grid grid-rows-[auto,1fr,auto] p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {projectName}
            </DialogTitle>
            <DialogDescription>
              Browse the file structure and view individual files
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden">
            {/* File Tree Panel */}
            <div className="w-1/2 border-r overflow-auto p-4">
              {isLoadingStructure ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
                    <p className="text-sm text-muted-foreground">
                      Loading project structure...
                    </p>
                  </div>
                </div>
              ) : projectStructure ? (
                <div className="space-y-4">
                  {/* Project Analysis */}
                  <div className="bg-muted/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Project Overview</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">Files:</span>
                        <span className="ml-2 font-medium">
                          {projectStructure.analysis.total_files}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Size:</span>
                        <span className="ml-2 font-medium">
                          {projectStructure.analysis.total_size_mb.toFixed(1)} MB
                        </span>
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className="text-muted-foreground text-xs">Languages:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(projectStructure.analysis.languages).map(([ext, lang]) => (
                          <Badge
                            key={ext}
                            variant="secondary"
                            className="text-xs flex items-center gap-1"
                          >
                            <div
                              className={`w-2 h-2 rounded-full ${getLanguageColor(lang)}`}
                            />
                            {lang}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* File Tree */}
                  <div className="bg-background rounded-lg border">
                    <div className="p-3 border-b">
                      <span className="font-medium text-sm">File Explorer</span>
                    </div>
                    <div className="max-h-96 overflow-auto p-2 group">
                      {projectStructure.file_tree.map((item, index) => (
                        <FileTreeNode
                          key={`${item.path}-${index}`}
                          item={item}
                          level={0}
                          onFileClick={loadFileContent}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No project structure available
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* File Content Panel */}
            <div className="w-1/2 overflow-auto p-4">
              {isLoadingFile ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
                    <p className="text-sm text-muted-foreground">
                      Loading file content...
                    </p>
                  </div>
                </div>
              ) : currentFile ? (
                <div className="space-y-4 h-full flex flex-col">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Code className="h-4 w-4 text-green-500" />
                      <span className="font-medium text-sm truncate" title={currentFile.file_path}>
                        {currentFile.file_path}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {formatFileSize(currentFile.size)}
                      </Badge>
                      {currentFile.language !== "text" && (
                        <Badge variant="outline" className="text-xs">
                          {currentFile.language}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFileViewerOpen(true)}
                        className="h-7 px-2 text-xs"
                        title="Open in full screen"
                      >
                        <Maximize2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="bg-muted/20 rounded-lg border p-4 flex-1 overflow-auto">
                    <pre className="whitespace-pre-wrap break-words text-xs font-mono leading-relaxed text-foreground">
                      {currentFile.content}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Select a file to view its content
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-6 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleClose}
              className="h-10 text-base rounded-lg"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Screen File Viewer Modal */}
      <Dialog open={fileViewerOpen} onOpenChange={setFileViewerOpen}>
        <DialogContent className="md:max-w-6xl w-full h-[90vh] md:h-[85vh] grid grid-rows-[auto,1fr,auto] p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {currentFile?.file_path || "File Viewer"}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-4 text-sm">
              <span>Size: {currentFile?.size ? formatFileSize(currentFile.size) : "Unknown"}</span>
              {currentFile?.language && (
                <span>Language: {currentFile.language}</span>
              )}
              {currentFile?.encoding && (
                <span>Encoding: {currentFile.encoding}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-auto p-6 bg-muted/20">
            {currentFile ? (
              <div className="bg-background rounded-lg border p-4">
                <pre className="whitespace-pre-wrap break-words text-sm font-mono leading-relaxed text-foreground max-w-full overflow-x-auto">
                  {currentFile.content}
                </pre>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No file content available</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setFileViewerOpen(false)}
              className="h-10 text-base rounded-lg"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}; 