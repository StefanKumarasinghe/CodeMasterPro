"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileExplorer } from "@/components/sidebar/file-explorer";
import { API_ENDPOINT } from "@/config/constants";
import { toast } from "@/utils/toast-util";
import { Input } from "@/components/ui/input";
import { Save, FileText, X } from "lucide-react";

interface SaveToFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
}

export function SaveToFileDialog({ isOpen, onClose, content }: SaveToFileDialogProps) {
  const [selectedFile, setSelectedFile] = useState<{ path: string; name: string } | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newFilePath, setNewFilePath] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setIsConfirmOpen(false);
      setIsSaving(false);
      setIsCreatingNew(false);
      setNewFileName("");
      setNewFilePath("");
    }
  }, [isOpen]);

  const handleFileSelect = (filePath: string, fileName: string) => {
    setSelectedFile({ path: filePath, name: fileName });
    setIsConfirmOpen(true);
  };

  const handleSaveToFile = async () => {
    if (!selectedFile) return;
    
    try {
      setIsSaving(true);
      const response = await fetch(`${API_ENDPOINT}/save_file_content/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_path: selectedFile.path,
          content: content,
          overwrite: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save file: ${response.statusText}`);
      }

      const data = await response.json();
      toast.success(`Content saved to ${selectedFile.name}`);
      onClose();
    } catch (error) {
      console.error("Error saving file:", error);
      toast.error(`Failed to save file: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSaving(false);
      setIsConfirmOpen(false);
    }
  };

  const handleCreateNewFile = async () => {
    if (!newFileName) {
      toast.error("Please enter a file name");
      return;
    }

    try {
      setIsSaving(true);
      const filePath = newFilePath ? `${newFilePath}/${newFileName}` : newFileName;
      
      const response = await fetch(`${API_ENDPOINT}/save_file_content/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_path: filePath,
          content: content,
          overwrite: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save file: ${response.statusText}`);
      }

      const data = await response.json();
      toast.success(`Content saved to ${filePath}`);
      onClose();
    } catch (error) {
      console.error("Error creating file:", error);
      toast.error(`Failed to create file: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (isConfirmOpen) {
      setIsConfirmOpen(false);
      setSelectedFile(null);
    } else if (isCreatingNew) {
      setIsCreatingNew(false);
      setNewFileName("");
      setNewFilePath("");
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Save to File</DialogTitle>
          <DialogDescription>
            {isConfirmOpen 
              ? `Confirm saving to ${selectedFile?.name}`
              : isCreatingNew
                ? "Create a new file"
                : "Select a file to save content to or create a new file"}
          </DialogDescription>
        </DialogHeader>

        {!isConfirmOpen && !isCreatingNew && (
          <div className="flex flex-col gap-4 mt-4 h-[500px] overflow-hidden">
            <div className="flex justify-between items-center">
              <Button 
                variant="outline" 
                onClick={() => setIsCreatingNew(true)}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Create New File
              </Button>
            </div>
            <div className="flex-1 overflow-hidden border rounded-md">
              <FileExplorer 
                onFileSelect={() => {}} 
                saveMode={true} 
                onFileSaveSelect={handleFileSelect} 
                contentToSave={content}
              />
            </div>
          </div>
        )}

        {isConfirmOpen && (
          <div className="py-6">
            <p className="mb-4">
              Are you sure you want to save content to <span className="font-semibold">{selectedFile?.name}</span>?
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              This will overwrite the existing file content.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSaveToFile} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}

        {isCreatingNew && (
          <div className="py-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="newFileName" className="block text-sm font-medium mb-1">
                  File Name
                </label>
                <Input
                  id="newFileName"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="Enter file name (e.g., example.js)"
                  className="w-full"
                />
              </div>
              <div>
                <label htmlFor="newFilePath" className="block text-sm font-medium mb-1">
                  Directory Path (optional)
                </label>
                <Input
                  id="newFilePath"
                  value={newFilePath}
                  onChange={(e) => setNewFilePath(e.target.value)}
                  placeholder="Enter directory path (e.g., src/components)"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to save in the root directory
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleCreateNewFile} disabled={isSaving || !newFileName}>
                {isSaving ? "Creating..." : "Create & Save"}
              </Button>
            </div>
          </div>
        )}

        {!isConfirmOpen && !isCreatingNew && (
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
} 