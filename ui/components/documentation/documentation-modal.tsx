"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/utils/toast-util"
import { API_ENDPOINT } from "@/config/constants"
import { FileUp, Trash2, AlertTriangle, FileText, X, Link, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatFileSize } from "@/utils/format-utils"
import { Textarea } from "@/components/ui/textarea"

interface ExistingDocument {
  id: string
  name: string
  size: number
}

export function DocumentationModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false);
  const [files, setFiles] = useState<File[]>([])
  const [existingDocuments, setExistingDocuments] = useState<ExistingDocument[]>([])
  const [documentsToRemove, setDocumentsToRemove] = useState<Set<string>>(new Set())
  const [description, setDescription] = useState("")
  const [documentationText, setDocumentationText] = useState("")
  const [documentationLinks, setDocumentationLinks] = useState("")
  const [linkBubbles, setLinkBubbles] = useState<string[]>([])
  const [eraseLongTermMemory, setEraseLongTermMemory] = useState(false)
  const [eraseConfirmOpen, setEraseConfirmOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchExistingDocuments = async () => {
    setIsFetching(true)
    setExistingDocuments([])
    try {
      const response = await fetch(`${API_ENDPOINT}/get_documentation`)
      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.status}`)
      }
      const data: ExistingDocument[] = await response.json()
      setExistingDocuments(data)
    } catch (error) {
      console.error("Failed to fetch existing documents:", error)
      toast.error("Could not load existing documents. Please try again.")
    } finally {
      setIsFetching(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchExistingDocuments()
      resetForm()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    const handleOpenModal = () => setIsOpen(true)
    window.addEventListener("open-documentation-modal", handleOpenModal)
    return () => window.removeEventListener("open-documentation-modal", handleOpenModal)
  }, [])

  useEffect(() => {
    if (documentationLinks) {
      setLinkBubbles(documentationLinks.split(",").map((link) => link.trim()).filter(link => link))
    } else {
      setLinkBubbles([])
    }
  }, [documentationLinks])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const newFiles = Array.from(e.target.files)
      setFiles((prev) => [...prev, ...newFiles])
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files?.length) {
      const newFiles = Array.from(e.dataTransfer.files)
      setFiles((prev) => [...prev, ...newFiles])
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleRemoveSelectionChange = (docId: string, checked: boolean | "indeterminate") => {
    setDocumentsToRemove(prev => {
        const newSet = new Set(prev);
        if (checked === true) {
            newSet.add(docId);
        } else {
            newSet.delete(docId);
        }
        return newSet;
    });
  }

  const uploadDocumentation = async () => {
    if (isFetching || isRemoving) return;

    if (files.length === 0 && !documentationText && !documentationLinks && !eraseLongTermMemory) {
        toast.info("Nothing to upload. Add files, text, or links.");
        return;
    }

    setIsUploading(true)
    try {
      const formData = new FormData()

      files.forEach((file) => formData.append("files", file))

      if (documentationText) formData.append("documentation_text", documentationText)
      if (documentationLinks) {
        const linksArray = documentationLinks.split(",").map((link) => link.trim()).filter(link => link)
        if (linksArray.length > 0) {
            formData.append("documentation_links", JSON.stringify(linksArray))
        }
      }
      if (description) formData.append("description", description)
      formData.append("eraseLongTermMemory", eraseLongTermMemory.toString())

      const response = await fetch(`${API_ENDPOINT}/add_documentation`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`Upload failed: ${response.status} - ${errorData}`)
      }

      toast.success("Documentation uploaded successfully!")
      setIsOpen(false)
    } catch (error) {
      console.error("Upload failed:", error)
      toast.error(`Upload failed: ${error instanceof Error ? error.message : "Please try again."}`)
    } finally {
      setIsUploading(false)
    }
  }
  const handleRemoveSelectedDocuments = async () => {
    if (documentsToRemove.size === 0) {
        toast.info("No documents selected for removal.");
        return;
    }
    if (isUploading || isFetching) return;

    setIsRemoving(true);
    const idsToRemove = Array.from(documentsToRemove);

    try {
        const response = await fetch(`${API_ENDPOINT}/remove_documentation`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
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
        toast.error(`Removal failed: ${error instanceof Error ? error.message : "Please try again."}`);
    } finally {
        setIsRemoving(false);
    }
};

  const eraseLongTermMemoryConfirm = async () => {
    if (isUploading || isRemoving || isFetching) return;

    try {
      const response = await fetch(`${API_ENDPOINT}/erase_long_term_memory`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error(`Failed with status: ${response.status}`)
      }

      toast.success("Long-term memory has been erased!")
      setEraseConfirmOpen(false)
      setEraseLongTermMemory(false)
      await fetchExistingDocuments();
    } catch (error) {
      console.error("Failed to erase memory:", error)
      toast.error("Failed to erase long-term memory. Please try again.")
    }
  }

  const resetForm = () => {
    setFiles([])
    setDescription("")
    setDocumentationText("")
    setDocumentationLinks("")
    setLinkBubbles([])
    setEraseLongTermMemory(false)
    setDocumentsToRemove(new Set())
    if (fileInputRef.current) {
        fileInputRef.current.value = ""
    }
  }

  const removeLinkBubble = (index: number) => {
      const updatedBubbles = linkBubbles.filter((_, i) => i !== index);
      setLinkBubbles(updatedBubbles);
      setDocumentationLinks(updatedBubbles.join(", "));
  }

  const hasPendingUploads = files.length > 0 || !!documentationText || !!documentationLinks;
  const hasPendingRemovals = documentsToRemove.size > 0;
  const isLoading = isUploading || isFetching || isRemoving;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Manage Documentation</DialogTitle>
            <DialogDescription>
              Add new knowledge by uploading files, entering text/links, or remove existing documents.
              For multiple links, separate them with commas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-2">

            <div className="space-y-4 p-4 border rounded-lg">
                <h3 className="text-lg font-semibold mb-3">Add New Knowledge</h3>
                <div
                    className={`border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary/50 transition-colors ${isUploading ? 'opacity-50' : ''}`}
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    onDrop={!isUploading ? handleDrop : undefined}
                    onDragOver={handleDragOver}
                    >
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".pdf,.txt,.md,.doc,.docx,.ppt,.pptx,.csv,.xls,.xlsx,"
                        disabled={isUploading}
                    />
                    <FileUp className="h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Click to upload or drag & drop</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, TXT, MD, DOC(X), PPT(X), CSV, XLS(X)</p>
                </div>

                {files.length > 0 && (
                <div className="space-y-2">
                    <Label className="font-medium">Files to upload:</Label>
                    <div className="max-h-32 overflow-y-auto space-y-2 p-2 border rounded-md bg-muted/30">
                    {files.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="flex items-center justify-between bg-background p-2 rounded-md text-sm">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <span className="truncate" title={file.name}>{file.name}</span>
                            <Badge variant="secondary" className="shrink-0 ml-auto mr-2">
                            {formatFileSize(file.size)}
                            </Badge>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeFile(index)}
                            disabled={isUploading}
                            aria-label={`Remove ${file.name}`}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                        </div>
                    ))}
                    </div>
                </div>
                )}

                <div>
                    <Label htmlFor="documentation-text">Or enter text:</Label>
                    <Textarea
                        id="documentation-text"
                        placeholder="Paste or type documentation text here..."
                        className="mt-1"
                        value={documentationText}
                        onChange={(e) => setDocumentationText(e.target.value)}
                        rows={4}
                        disabled={isUploading}
                    />
                </div>

                <div>
                    <Label htmlFor="documentation-links">Or enter links (comma-separated):</Label>
                    <Textarea
                        id="documentation-links"
                        placeholder="https://example.com/doc1, https://another.com/guide"
                        className="mt-1"
                        value={documentationLinks}
                        onChange={(e) => setDocumentationLinks(e.target.value)}
                        rows={2}
                        disabled={isUploading}
                    />
                    {linkBubbles.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {linkBubbles.map((link, index) => (
                                <Badge
                                key={index}
                                variant="secondary"
                                className="flex items-center gap-1 py-1 px-2"
                                >
                                <Link className="h-3 w-3" />
                                <span className="text-xs truncate max-w-[150px]">{link}</span>
                                <button
                                    type="button"
                                    onClick={() => removeLinkBubble(index)}
                                    className="ml-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
                                    disabled={isUploading}
                                    aria-label={`Remove link ${link}`}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center space-x-2 pt-2">
                    <Switch
                        id="erase-memory"
                        checked={eraseLongTermMemory}
                        onCheckedChange={setEraseLongTermMemory}
                        disabled={isLoading}
                    />
                    <Label htmlFor="erase-memory" className="text-sm font-normal cursor-pointer">
                        Erase all existing memory before adding new content
                    </Label>
                </div>
                {eraseLongTermMemory && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-md border border-destructive/20">
                        <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                        <p className="text-sm text-destructive">
                            <strong>Warning:</strong> This erases <i>all</i> learned info (files, text, links, browsing data). This cannot be undone.
                        </p>
                    </div>
                )}

                 <Button onClick={uploadDocumentation} disabled={isLoading || !hasPendingUploads} className="w-full mt-2">
                    {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : "Upload New Content"}
                </Button>

            </div>


            <div className="space-y-4 p-4 border rounded-lg">
                <h3 className="text-lg font-semibold mb-3">Manage Existing Documents</h3>
                {isFetching ? (
                     <div className="flex items-center justify-center py-4 text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading documents...
                     </div>
                ) : existingDocuments.length > 0 ? (
                    <div className="space-y-2">
                        <Label className="font-medium">Select documents to remove:</Label>
                        <div className="max-h-48 overflow-y-auto space-y-2 p-2 border rounded-md bg-muted/30">
                             {existingDocuments.map((doc) => (
                                <div key={doc.id} className="flex items-center justify-between bg-background p-2 rounded-md text-sm hover:bg-muted/50">
                                    <div className="flex items-center gap-2 overflow-hidden flex-grow mr-2">
                                        <Checkbox
                                            id={`remove-${doc.id}`}
                                            checked={documentsToRemove.has(doc.id)}
                                            onCheckedChange={(checked) => handleRemoveSelectionChange(doc.id, checked)}
                                            aria-label={`Select ${doc.name} for removal`}
                                            disabled={isLoading}
                                            className="shrink-0"
                                        />
                                        <FileText className="h-4 w-4 text-primary shrink-0" />
                                        <label htmlFor={`remove-${doc.id}`} className="truncate cursor-pointer" title={doc.name}>
                                            {doc.name}
                                        </label>
                                    </div>
                                    <Badge variant="secondary" className="shrink-0">
                                        {formatFileSize(doc.size)}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                        <Button
                            variant="destructive"
                            onClick={handleRemoveSelectedDocuments}
                            disabled={isLoading || !hasPendingRemovals}
                            className="w-full mt-2"
                        >
                            {isRemoving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Removing...</> : <><Trash2 className="h-4 w-4 mr-2" /> Remove Selected ({documentsToRemove.size})</>}
                        </Button>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No existing documents found.</p>
                )}
            </div>


            <div className="space-y-2 p-4 border border-destructive/30 rounded-lg bg-destructive/5">
                <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
                 <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-destructive/90 flex-grow">
                        Permanently erase <strong>all</strong> of TARS's long-term memory, including documents, text, links, and browsing data.
                    </p>
                    <Button
                        type="button"
                        variant="destructive"
                        className="shrink-0"
                        onClick={() => !isLoading && setEraseConfirmOpen(true)}
                        disabled={isLoading}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Erase All Memory
                    </Button>
                 </div>
            </div>

          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={eraseConfirmOpen} onOpenChange={setEraseConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Confirm Memory Erase</DialogTitle>
            <DialogDescription>
              Are you absolutely sure? This will permanently delete <strong>all</strong> learned information (files, text, links, browsing data) and cannot be undone. TARS will revert to its initial state.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-4 bg-destructive/10 rounded-md border border-destructive/20 my-4">
            <AlertTriangle className="h-8 w-8 text-destructive shrink-0" />
            <p className="text-sm text-destructive font-medium">
              This is irreversible. Please confirm you want to proceed.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEraseConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={eraseLongTermMemoryConfirm}>
              Yes, Erase All Memory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}