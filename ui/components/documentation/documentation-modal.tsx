"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/utils/toast-util";
import { API_ENDPOINT } from "@/config/constants";
import {
  FileUp,
  Trash2,
  AlertTriangle,
  FileText,
  X,
  Link,
  Loader2,
  GithubIcon,
  FileWarning,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatFileSize } from "@/utils/format-utils";
import { Textarea } from "@/components/ui/textarea";

interface ExistingDocument {
  id: string;
  name: string;
  size: number;
}

interface GithubProject {
  id: string; // Backend might use ID, previous code used name for removal. Using ID based on interface now.
  name: string;
  path?: string;
  size_mb?: number;
}

export function DocumentationModal() {
  const [isOpen, setIsOpen] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [isRemovingDocs, setIsRemovingDocs] = useState(false);
  const [isRemovingGithub, setIsRemovingGithub] = useState(false);
  const [isFetchingDocs, setIsFetchingDocs] = useState(false);
  const [isFetchingGithub, setIsFetchingGithub] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [documentationText, setDocumentationText] = useState("");
  const [documentationLinks, setDocumentationLinks] = useState("");
  const [linkBubbles, setLinkBubbles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [existingDocuments, setExistingDocuments] = useState<
    ExistingDocument[]
  >([]);
  const [documentsToRemove, setDocumentsToRemove] = useState<Set<string>>(
    new Set()
  );
  const [githubProjects, setGithubProjects] = useState<GithubProject[]>([]);
  const [projectsToRemove, setProjectsToRemove] = useState<Set<string>>(
    new Set()
  );
  const [eraseConfirmOpen, setEraseConfirmOpen] = useState(false);
  const isLoading =
    isUploading || isRemovingDocs || isRemovingGithub || isFetchingDocs || isFetchingGithub;

  const fetchExistingDocuments = async () => {
    setIsFetchingDocs(true);
    setExistingDocuments([]);
    setDocumentsToRemove(new Set());
    try {
      const response = await fetch(`${API_ENDPOINT}/get_documentation`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch documents: ${response.status} - ${errorText}`
        );
      }
      const data: ExistingDocument[] = await response.json();
      setExistingDocuments(data);
    } catch (error) {
      console.error("Failed to fetch existing documents:", error);
      toast.error(
        `Could not load existing documents. ${
          error instanceof Error ? error.message : ""
        }`
      );
    } finally {
      setIsFetchingDocs(false);
    }
  };

  const fetchGithubProjects = async () => {
    setIsFetchingGithub(true);
    setGithubProjects([]);
    setProjectsToRemove(new Set());
    try {
      const response = await fetch(`${API_ENDPOINT}/get_github_projects`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch GitHub projects: ${response.status} - ${errorText}`
        );
      }
      const data: GithubProject[] = await response.json();
      setGithubProjects(data);
    } catch (error) {
      console.error("Failed to fetch GitHub projects:", error);
      toast.error(
        `Could not load GitHub projects. ${
          error instanceof Error ? error.message : ""
        }`
      );
    } finally {
      setIsFetchingGithub(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchExistingDocuments();
      fetchGithubProjects();
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleOpenModal = () => setIsOpen(true);
    window.addEventListener("open-documentation-modal", handleOpenModal);
    return () =>
      window.removeEventListener("open-documentation-modal", handleOpenModal);
  }, []);

  useEffect(() => {
    const linksArray = documentationLinks
      .split(",")
      .map((link) => link.trim())
      .filter((link) => link);
    setLinkBubbles(linksArray);
  }, [documentationLinks]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove("border-primary/70", "bg-muted/20");
    if (e.dataTransfer.files?.length) {
      const newFiles = Array.from(e.dataTransfer.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isLoading) {
      e.currentTarget.classList.add("border-primary/70", "bg-muted/20");
    }
  };

   const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove("border-primary/70", "bg-muted/20");
  };

  const handleDocumentRemoveSelectionChange = (
    docId: string,
    checked: boolean | "indeterminate"
  ) => {
    setDocumentsToRemove((prev) => {
      const newSet = new Set(prev);
      if (checked === true) {
        newSet.add(docId);
      } else {
        newSet.delete(docId);
      }
      return newSet;
    });
  };

  const handleProjectRemoveSelectionChange = (
    projectId: string, // Using ID based on interface
    checked: boolean | "indeterminate"
  ) => {
    setProjectsToRemove((prev) => {
      const newSet = new Set(prev);
      if (checked === true) {
        newSet.add(projectId);
      } else {
        newSet.delete(projectId);
      }
      return newSet;
    });
  };

  const uploadNewContent = async () => {
    if (isLoading) return;

    if (files.length === 0 && !documentationText && linkBubbles.length === 0) {
      toast.info("Please add some content to upload!");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();

      files.forEach((file) => formData.append("files", file));

      if (documentationText)
        formData.append("documentation_text", documentationText);
      if (linkBubbles.length > 0) {
         formData.append("documentation_links", JSON.stringify(linkBubbles));
      }

      const response = await fetch(`${API_ENDPOINT}/add_documentation`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorData}`);
      }
      toast.success("Content added successfully!");
      resetForm();
      // Optionally refresh the existing list after adding content
      // await fetchExistingDocuments();
      // await fetchGithubProjects(); // If adding links/text might affect these
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error(
        `Failed to add content: ${
          error instanceof Error ? error.message : "Please try again."
        }`
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveSelectedDocuments = async () => {
    if (documentsToRemove.size === 0 || isLoading) {
      if (documentsToRemove.size === 0) toast.info("No documents selected to remove!");
      return;
    }

    setIsRemovingDocs(true);
    const idsToRemove = Array.from(documentsToRemove);

    try {
      const response = await fetch(`${API_ENDPOINT}/remove_documentation`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: idsToRemove }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Removal failed: ${response.status} - ${errorData}`);
      }

      toast.success(`${idsToRemove.length} document(s) removed successfully!`);
      setDocumentsToRemove(new Set());
      await fetchExistingDocuments();
    } catch (error) {
      console.error("Failed to remove documents:", error);
      toast.error(
        `Document removal failed: ${
          error instanceof Error ? error.message : "Please try again."
        }`
      );
    } finally {
      setIsRemovingDocs(false);
    }
  };

  const handleRemoveSelectedProjects = async () => {
    if (projectsToRemove.size === 0 || isLoading) {
       if (projectsToRemove.size === 0) toast.info("No GitHub projects selected to remove!");
      return;
    }

    setIsRemovingGithub(true);
    // Using project IDs for removal based on the interface definition
    const idsToRemove = Array.from(projectsToRemove);

    try {
      const response = await fetch(`${API_ENDPOINT}/remove_github_project`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: idsToRemove }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `GitHub project removal failed: ${response.status} - ${errorData}`
        );
      }

      toast.success(
        `${idsToRemove.length} GitHub project(s) removed successfully!`
      );
      setProjectsToRemove(new Set());
      await fetchGithubProjects();
    } catch (error) {
      console.error("Failed to remove GitHub projects:", error);
      toast.error(
        `GitHub project removal failed: ${
          error instanceof Error ? error.message : "Please try again."
        }`
      );
    } finally {
      setIsRemovingGithub(false);
    }
  };

  const handleEraseAllGithubProjects = async () => {
    if (isLoading || isRemovingGithub || githubProjects.length === 0) {
      if (githubProjects.length === 0) toast.info("No GitHub projects to remove!");
      return;
    }

    setIsRemovingGithub(true);

    try {
      const response = await fetch(`${API_ENDPOINT}/erase_all_github_projects`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `Erase all GitHub projects failed: ${response.status} - ${errorData}`
        );
      }

      toast.success("All GitHub projects have been removed!");
      setProjectsToRemove(new Set());
      await fetchGithubProjects();
    } catch (error) {
      console.error("Failed to erase all GitHub projects:", error);
      toast.error(
        `Failed to erase all GitHub projects. ${
          error instanceof Error ? error.message : ""
        }`
      );
    } finally {
      setIsRemovingGithub(false);
    }
  };

  const eraseLongTermMemoryConfirm = async () => {
    if (isLoading) return;

    try {
      const response = await fetch(`${API_ENDPOINT}/erase_long_term_memory`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `Failed to erase memory: ${response.status} - ${errorData}`
        );
      }

      toast.success("Long-term memory has been erased!");
      setEraseConfirmOpen(false);
      await fetchExistingDocuments();
      await fetchGithubProjects();
      resetForm();
    } catch (error) {
      console.error("Failed to erase memory:", error);
      toast.error(
        `Failed to erase long-term memory. ${
          error instanceof Error ? error.message : ""
        }`
      );
    }
  };

  const resetForm = () => {
    setFiles([]);
    setDocumentationText("");
    setDocumentationLinks("");
    setLinkBubbles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeLinkBubble = (index: number) => {
    const updatedBubbles = linkBubbles.filter((_, i) => i !== index);
    setLinkBubbles(updatedBubbles);
    setDocumentationLinks(updatedBubbles.join(", "));
  };

  const handleClearLinks = () => {
    setDocumentationLinks("");
    setLinkBubbles([]);
  }

  const hasPendingUploads =
    files.length > 0 || !!documentationText || linkBubbles.length > 0;
  const hasPendingDocumentRemovals = documentsToRemove.size > 0;
  const hasPendingProjectRemovals = projectsToRemove.size > 0;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-4xl grid grid-rows-[auto,1fr,auto] p-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>Manage Knowledge & Resources</DialogTitle>
            <DialogDescription>
              Add new knowledge from files, text, or links, or manage existing
              sources like documents and GitHub projects.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[70vh] px-6 pb-6 pt-0">
            <Tabs defaultValue="add" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-10">
                <TabsTrigger value="add" disabled={isLoading}>
                  Add New Content
                </TabsTrigger>
                <TabsTrigger value="manage" disabled={isLoading}>
                  Manage Existing
                </TabsTrigger>
              </TabsList>

              <TabsContent value="add" className="mt-6 space-y-8">
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-foreground">Upload Files</h4>
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-200
                    ${isLoading ? "opacity-60 cursor-not-allowed" : "hover:border-primary/70 hover:bg-muted/20"}`}
                    onClick={() => !isLoading && fileInputRef.current?.click()}
                    onDrop={!isLoading ? handleDrop : undefined}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".pdf,.txt,.md,.doc,.docx,.ppt,.pptx,.csv,.xls,.xlsx,"
                      disabled={isLoading}
                    />
                    <FileUp className="h-12 w-12 text-primary mb-3" />
                    <p className="text-base font-medium text-foreground">
                      Click to upload or drag & drop files
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Supported types: PDF, TXT, MD, DOC(X), PPT(X), CSV, XLS(X)
                    </p>
                  </div>

                  {files.length > 0 && (
                    <div className="space-y-3">
                      <Label className="font-medium text-sm">Files to upload ({files.length}):</Label>
                      <div className="max-h-40 overflow-y-auto space-y-2 p-3 border rounded-lg bg-muted/30">
                        {files.map((file, index) => (
                          <div
                            key={`${file.name}-${index}`}
                            className="flex items-center justify-between bg-background p-3 rounded-md text-sm border border-border"
                          >
                            <div className="flex items-center gap-3 overflow-hidden flex-grow mr-2">
                              <FileText className="h-5 w-5 text-primary shrink-0" />
                              <span className="truncate font-medium text-foreground" title={file.name}>
                                {file.name}
                              </span>
                              <Badge
                                variant="secondary"
                                className="shrink-0 ml-auto text-xs"
                              >
                                {formatFileSize(file.size)}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                              onClick={() => removeFile(index)}
                              disabled={isLoading}
                              aria-label={`Remove ${file.name}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-foreground">Add Raw Text</h4>
                  <div>
                    <Label htmlFor="documentation-text" className="text-sm font-medium">Enter information to be added to the knowledge base:</Label>
                    <Textarea
                      id="documentation-text"
                      placeholder="Paste or type documentation text here..."
                      className="mt-2 min-h-[120px] rounded-lg"
                      value={documentationText}
                      onChange={(e) => setDocumentationText(e.target.value)}
                      rows={5}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-foreground flex items-center justify-between">
                    Add Links
                    {linkBubbles.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearLinks}
                        disabled={isLoading}
                        className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Clear All
                      </Button>
                    )}
                  </h4>
                  <div>
                    <Label htmlFor="documentation-links" className="text-sm font-medium">
                      Enter links (comma-separated) to scrape and extract information from:
                    </Label>
                    <Textarea
                      id="documentation-links"
                      placeholder="https://example.com/doc1, https://another.com/guide"
                      className="mt-2 rounded-lg min-h-[80px]"
                      value={documentationLinks}
                      onChange={(e) => setDocumentationLinks(e.target.value)}
                      rows={3}
                      disabled={isLoading}
                    />
                    {linkBubbles.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 max-h-24 overflow-y-auto p-2 border rounded-md bg-muted/10">
                        {linkBubbles.map((link, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="flex items-center gap-1 py-1 px-2 pr-1 text-sm font-normal"
                          >
                            <Link className="h-3 w-3 text-primary shrink-0" />
                            <span className="text-xs truncate max-w-[180px]" title={link}>
                              {link}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeLinkBubble(index)}
                              className="ml-1 -mr-0.5 text-muted-foreground hover:text-destructive disabled:opacity-50 p-0.5 rounded-sm hover:bg-destructive/10 transition-colors"
                              disabled={isLoading}
                              aria-label={`Remove link ${link}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  onClick={uploadNewContent}
                  disabled={isLoading || !hasPendingUploads}
                  className="w-full mt-6 h-10 text-base rounded-lg"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                      Adding Content...
                    </>
                  ) : (
                    "Add Selected Content"
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="manage" className="mt-6 space-y-8">
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-foreground">Existing Documents</h4>
                  {isFetchingDocs ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading
                      documents...
                    </div>
                  ) : existingDocuments.length > 0 ? (
                    <div className="space-y-3">
                      <Label className="font-medium text-sm">
                        Select documents to remove:
                      </Label>
                      <div className="max-h-48 overflow-y-auto overflow-x-hidden space-y-2 p-3 border rounded-lg bg-muted/30">
                        {existingDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between bg-background p-3 rounded-md text-sm border border-border transition-colors hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-3 overflow-hidden flex-grow mr-2">
                              <Checkbox
                                id={`remove-doc-${doc.id}`}
                                checked={documentsToRemove.has(doc.id)}
                                onCheckedChange={(checked) =>
                                  handleDocumentRemoveSelectionChange(
                                    doc.id,
                                    checked
                                  )
                                }
                                aria-label={`Select ${doc.name} for removal`}
                                disabled={isLoading}
                                className="shrink-0"
                              />
                              <FileText className="h-5 w-5 text-primary shrink-0" />
                              <label
                                htmlFor={`remove-doc-${doc.id}`}
                                className="truncate cursor-pointer font-medium text-foreground flex-grow"
                                title={doc.name}
                              >
                                {doc.name}
                              </label>
                            </div>
                            {doc.size !== undefined && (
                              <Badge variant="secondary" className="shrink-0 text-xs">
                                {formatFileSize(doc.size)}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="destructive"
                        onClick={handleRemoveSelectedDocuments}
                        disabled={isLoading || !hasPendingDocumentRemovals}
                        className="w-full mt-2 h-10 text-base rounded-lg"
                      >
                        {isRemovingDocs ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                            Removing...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" /> Remove Selected
                            ({documentsToRemove.size})
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                       <FileText className="h-10 w-10 mx-auto mb-3" />
                       <p className="text-sm">No existing documents found.</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-foreground">GitHub Projects</h4>
                  <p className="text-sm text-muted-foreground">
                    These include all the projects that have been cloned from
                    GitHub.
                  </p>
                  {isFetchingGithub ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading
                      GitHub projects...
                    </div>
                  ) : githubProjects.length > 0 ? (
                    <div className="space-y-3">
                      <Label className="font-medium text-sm">
                        Select GitHub projects to remove:
                      </Label>
                      <div className="max-h-48 overflow-y-auto overflow-x-hidden space-y-2 p-3 border rounded-lg bg-muted/30">
                        {githubProjects.map((project) => (
                          <div
                            key={project.id} // Using ID as key
                            className="flex items-center justify-between bg-background p-3 rounded-md text-sm border border-border transition-colors hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-3 overflow-hidden flex-grow mr-2">
                              <Checkbox
                                id={`remove-github-${project.id}`} // Using ID for checkbox ID
                                checked={projectsToRemove.has(project.id)}
                                onCheckedChange={(checked) =>
                                  handleProjectRemoveSelectionChange(
                                    project.id, // Pass ID to handler
                                    checked
                                  )
                                }
                                aria-label={`Select ${project.name} for removal`}
                                disabled={isLoading}
                                className="shrink-0"
                              />
                              <GithubIcon className="h-5 w-5 text-foreground shrink-0" />
                              <label
                                htmlFor={`remove-github-${project.id}`} // Using ID for label htmlFor
                                className="truncate cursor-pointer font-medium text-foreground flex-grow"
                                title={project.name}
                              >
                                {project.name}
                              </label>
                              {project.path && (
                                <p className="text-xs text-muted-foreground ml-4 truncate max-w-[100px] sm:max-w-[200px]" title={project.path}>
                                  {project.path}
                                </p>
                              )}
                              {project.size_mb !== undefined && (
                                <Badge variant="secondary" className="shrink-0 ml-auto text-xs">
                                  {project.size_mb.toFixed(1)} MB
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        <Button
                          variant="destructive"
                          onClick={handleRemoveSelectedProjects}
                          disabled={isLoading || !hasPendingProjectRemovals}
                          className="w-full h-10 text-base rounded-lg"
                        >
                          {isRemovingGithub && hasPendingProjectRemovals ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                              Removing Selected...
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-2" /> Remove Selected
                              ({projectsToRemove.size})
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleEraseAllGithubProjects}
                          disabled={isLoading || githubProjects.length === 0}
                          className="w-full h-10 text-base rounded-lg border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          {isRemovingGithub &&
                          !hasPendingProjectRemovals &&
                          projectsToRemove.size === 0 ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                              Removing All...
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-2" /> Remove All Projects
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                     <div className="text-center py-8 text-muted-foreground">
                       <GithubIcon className="h-10 w-10 mx-auto mb-3" />
                       <p className="text-sm">No existing GitHub projects found.</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-3 p-6 mt-8 border border-destructive/40 rounded-lg bg-destructive/5">
              <h3 className="text-xl font-bold text-destructive flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                Danger Zone
              </h3>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <p className="text-sm text-destructive/90 flex-grow leading-relaxed">
                  Permanently erase <strong>all</strong> of CodeMasterPro's long-term
                  memory, including documents, text, links, browsing data, and
                  GitHub projects. This action cannot be undone.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 w-full sm:w-auto h-10 text-base rounded-lg border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
                  onClick={() => !isLoading && setEraseConfirmOpen(true)}
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All Memory
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
              className="h-10 text-base rounded-lg"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={eraseConfirmOpen} onOpenChange={setEraseConfirmOpen}>
        <DialogContent className="rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
               <FileWarning className="h-6 w-6 text-destructive" />
              Confirm Memory Erase
            </DialogTitle>
            <DialogDescription className="leading-relaxed">
              Are you absolutely sure? This will permanently delete{" "}
              <strong>all</strong> learned information (files, text, links,
              browsing data, GitHub projects) and cannot be undone. CodeMasterPro will
              revert to its initial state.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-md border border-destructive/20 my-4">
            <AlertTriangle className="h-7 w-7 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive font-medium leading-relaxed">
              This is irreversible. Please confirm you want to proceed by clicking the button below.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEraseConfirmOpen(false)}
              disabled={isLoading}
              className="h-10 text-base rounded-lg"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={eraseLongTermMemoryConfirm}
              disabled={isLoading}
              className="h-10 text-base rounded-lg"
            >
              Yes, Erase All Memory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}