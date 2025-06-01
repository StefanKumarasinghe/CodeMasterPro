import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, Trash2, Loader2, RefreshCw, Github } from "lucide-react"
import { useToast } from "@/hooks/use-toast-message"
import { API_ENDPOINT } from "@/config/constants"
import ReactConfetti from 'react-confetti'
import { Input } from "@/components/ui/input"
import { showProgressIndicator, hideProgressIndicator, isOperationInProgress } from "@/components/progress-indicator"
import { useWindowSize } from "@/hooks/useWindowSize"
interface ProjectModalProps {
  isOpen: boolean
  onClose: () => void
  projectStatus: {
    has_project: boolean
    has_index: boolean
  }
}


export function ProjectModal({ isOpen, onClose, projectStatus }: ProjectModalProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isReindexing, setIsReindexing] = useState(false)
  const [isFetchingStatus, setIsFetchingStatus] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [isCloning, setIsCloning] = useState(false)
  const [repoUrl, setRepoUrl] = useState("")
  const [isUploadingFolder, setIsUploadingFolder] = useState(false)

  const { toast } = useToast()
  const { width: windowWidth, height: windowHeight } = useWindowSize();

  function fetchProjectStatus() {
    fetch(`${API_ENDPOINT}/project_status/`)
    .then(response => response.json())
    .then(data => {
        console.log(data)
    })
}

  useEffect(() => {
    if (isOpen) {
      fetchStatus()
    }
  }, [isOpen])

  useEffect(() => {
    let intervalId: NodeJS.Timeout

    if (isOpen) {
      fetchStatus()

      intervalId = setInterval(fetchStatus, 5000)
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [isOpen])

  const fetchStatus = async () => {
    setIsFetchingStatus(true)
    try {
      await fetchProjectStatus()
    } catch (error) {
      toast({
        title: "Failed to fetch project status",
        description: "Could not retrieve the current status of the project.",
        variant: "destructive",
      })
    } finally {
      setIsFetchingStatus(false)
    }
  }

  useEffect(() => {
    if (projectStatus.has_index && isOpen) {
      setShowCelebration(true)
      const timer = setTimeout(() => {
        setShowCelebration(false)
      }, 10000)

      return () => clearTimeout(timer)
    } else {
      setShowCelebration(false)
    }
  }, [projectStatus.has_index, isOpen])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.zip')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a ZIP file",
        variant: "destructive",
      })
      if (event.target) {
        event.target.value = ''
      }
      return
    }

    setIsUploading(true)
    showProgressIndicator("Uploading project file...");
    
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`${API_ENDPOINT}/upload_project/`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to upload project');
      }

      toast({
        title: "Upload Successful!",
        description: "Project uploaded and indexing started.",
      })

      showProgressIndicator("Indexing project...");

      const pollInterval = setInterval(async () => {
        await fetchStatus()
        if (projectStatus.has_index) {
          clearInterval(pollInterval)
          hideProgressIndicator();
        }
      }, 2000)
      setTimeout(() => {
        clearInterval(pollInterval)
        hideProgressIndicator();
      }, 120000)

    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "An unexpected error occurred during upload.",
        variant: "destructive",
      })

      hideProgressIndicator();
    } finally {
      setIsUploading(false)
      if (event.target) {
        event.target.value = ''
      }
    }
  }

  const handleFolderUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploadingFolder(true)
    showProgressIndicator("Uploading folder...");
    
    try {
      const filesArray = Array.from(files);
      const folderStructure = filesArray.map(file => {
        const relativePath = (file as any).webkitRelativePath || file.name;
        return {
          path: relativePath
        };
      });
      
      const formData = new FormData();
      filesArray.forEach(file => {
        formData.append('files', file);
      });
      formData.append('folder_structure', JSON.stringify(folderStructure));

      const response = await fetch(`${API_ENDPOINT}/upload_folder/`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to upload folder');
      }

      toast({
        title: "Upload Successful!",
        description: "Folder uploaded and indexing started.",
      });

      showProgressIndicator("Indexing project folder...");

      const pollInterval = setInterval(async () => {
        await fetchStatus();
        if (projectStatus.has_index) {
          clearInterval(pollInterval);
          hideProgressIndicator();
        }
      }, 2000);
      setTimeout(() => {
        clearInterval(pollInterval);
        hideProgressIndicator();
      }, 120000);

    } catch (error: any) {
      toast({
        title: "Folder Upload Failed",
        description: error.message || "An unexpected error occurred during upload.",
        variant: "destructive",
      });
      hideProgressIndicator();
    } finally {
      setIsUploadingFolder(false);
      hideProgressIndicator();
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleDeleteProject = async () => {
    setIsDeleting(true) 
    showProgressIndicator("Deleting project...");
    try {
      const response = await fetch(`${API_ENDPOINT}/clear_project/`, {
        method: 'DELETE',
      })

      if (!response.ok) {
         const errorData = await response.json();
         throw new Error(errorData.detail || 'Failed to delete project');
      }

      toast({
        title: "Deletion Successful!",
        description: "Project deleted.",
      })

      await fetchStatus()

    } catch (error: any) {
      toast({
        title: "Deletion Failed",
        description: error.message || "An unexpected error occurred during deletion.",
        variant: "destructive",
      })
      hideProgressIndicator();
    } finally {
      setIsDeleting(false)
      hideProgressIndicator();
    }
  }

  const handleReindex = async () => {
    if (isOperationInProgress()) {
      toast({
        title: "Operation in Progress",
        description: "Please wait for the current operation to complete before starting a new one.",
        variant: "destructive",
      })
      return;
    }
    setIsReindexing(true)
    showProgressIndicator("Reindexing project...");
    try {
      const response = await fetch(`${API_ENDPOINT}/reindex_project/`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to reindex project');
      }

      toast({
        title: "Reindexing Started!",
        description: "Project reindexing has started.",
      })

      const pollInterval = setInterval(async () => {
        await fetchStatus()
        if (projectStatus.has_index) {
          clearInterval(pollInterval)
          hideProgressIndicator();
        }
      }, 5000) 

      setTimeout(() => {
        clearInterval(pollInterval);
        hideProgressIndicator();
      }, 120000)

    } catch (error: any) {
      toast({
        title: "Reindexing Failed",
        description: error.message || "An unexpected error occurred during reindexing.",
        variant: "destructive",
      })
      hideProgressIndicator();
    } finally {
      hideProgressIndicator();
      setIsReindexing(false)
    }
  }

  const handleGithubClone = async () => {
    if (!repoUrl) {
      toast({
        title: "Invalid Input",
        description: "Please enter a GitHub repository URL",
        variant: "destructive",
      })
      return
    }

    let repoFullName = repoUrl
    if (repoUrl.includes("github.com/")) {
      repoFullName = repoUrl.split("github.com/")[1].replace(".git", "")
    }

    setIsCloning(true)
    showProgressIndicator("Cloning GitHub repository...");
    
    try {
      const response = await fetch(`${API_ENDPOINT}/clone_personal_github_repo?repo_full_name=${encodeURIComponent(repoFullName)}&use_token=false`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        const errorData = await response.json();
        showProgressIndicator("Trying with token authentication...");
        
        const tokenResponse = await fetch(`${API_ENDPOINT}/clone_personal_github_repo?repo_full_name=${encodeURIComponent(repoFullName)}&use_token=true`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        })

        if (!tokenResponse.ok) {
          const tokenErrorData = await tokenResponse.json();
          throw new Error(tokenErrorData.detail || 'Failed to clone repository');
        }

        const tokenData = await tokenResponse.json()
        if (tokenData.success) {
          toast({
            title: "Clone Successful!",
            description: "Repository cloned and indexing started.",
          })
          setRepoUrl("")
          
          
          showProgressIndicator("Indexing GitHub repository...");
          
          const pollInterval = setInterval(async () => {
            await fetchStatus()
            if (projectStatus.has_index) {
              clearInterval(pollInterval)
              
              hideProgressIndicator();
            }
          }, 2000) 
          setTimeout(() => {
            clearInterval(pollInterval);
            
            hideProgressIndicator();
          }, 120000)
        } else {
          throw new Error(tokenData.error || 'Failed to clone repository')
        }
      } else {
        const data = await response.json()
        if (data.success) {
          toast({
            title: "Clone Successful!",
            description: "Repository cloned and indexing started.",
          })
          setRepoUrl("")
          
          
          showProgressIndicator("Indexing GitHub repository...");
          
          const pollInterval = setInterval(async () => {
            await fetchStatus()
            if (projectStatus.has_index) {
              clearInterval(pollInterval)
              
              hideProgressIndicator();
            }
          }, 2000) 
          
          setTimeout(() => {
            clearInterval(pollInterval);
            
            hideProgressIndicator();
          }, 120000)
        } else {
          throw new Error(data.error || 'Failed to clone repository')
        }
      }
    } catch (error: any) {
      toast({
        title: "Clone Failed",
        description: error.message || "An unexpected error occurred during cloning.",
        variant: "destructive",
      })
      
      hideProgressIndicator();
    } finally {
      setIsCloning(false)
    }
  }

  const isBusy = isUploading || isDeleting || isReindexing || isFetchingStatus || isCloning || isUploadingFolder

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
    {showCelebration && projectStatus.has_index && (
      <ReactConfetti
        className="!fixed top-0 left-0 w-full h-full z-[9999]"
        width={windowWidth}
        height={windowHeight}
        recycle={false}
        numberOfPieces={1000}
      />
    )}
      <DialogContent className="w-full h-[100vh] md:h-auto justify-center items-center md:max-w-[500px] lg:max-w-[600px] text-center">
        <DialogHeader>
          <DialogTitle>Project Management</DialogTitle>
          <DialogDescription>
            Upload a ZIP file, folder, or clone a GitHub repository to enable code-aware chat features. Note that uploading will overwrite the existing project.
          </DialogDescription>
        </DialogHeader>
            <>
                {projectStatus.has_project && (
                  <Alert variant={projectStatus.has_index ? "default" : "destructive"} className={projectStatus.has_index ? "" : "bg-yellow-50"}>
                    <AlertDescription className={projectStatus.has_index ? "text-green-600" : "text-yellow-500"}>
                      {projectStatus.has_index
                        ? "🚀 Project is uploaded and indexed! Ready for chat."
                        : "⚠️ Project uploaded but not indexed. Please re-upload or check server status."}
                    </AlertDescription>
                  </Alert>
                )}

                {!projectStatus.has_project && !isFetchingStatus && (
                     <Alert>
                        <Upload className="h-4 w-4" />
                        <AlertDescription>
                            No project currently uploaded. Upload a **.zip** file, **folder**, or clone a GitHub repository to get started.
                        </AlertDescription>
                    </Alert>
                )}

                {isFetchingStatus && (
                     <Alert>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <AlertDescription>
                           Fetching project status...
                        </AlertDescription>
                    </Alert>
                )}
            </>
        <div className="flex flex-col gap-4 py-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label htmlFor="project-upload" className="col-span-1">
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={isBusy}
                  asChild
                >
                  <div className="flex items-center justify-center gap-2">
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {isUploading ? "Uploading..." : "Upload ZIP"}
                  </div>
                </Button>
              </label>
              <input
                type="file"
                accept=".zip"
                onChange={handleFileUpload}
                className="hidden"
                id="project-upload"
                disabled={isBusy}
              />
              <label htmlFor="folder-upload" className="col-span-1">
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={isBusy}
                  asChild
                >
                  <div className="flex items-center justify-center gap-2">
                    {isUploadingFolder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {isUploadingFolder ? "Uploading..." : "Upload Folder"}
                  </div>
                </Button>
              </label>
              <input
                type="file"
                onChange={handleFolderUpload}
                className="hidden"
                id="folder-upload"
                disabled={isBusy}
                multiple
                {...{ webkitdirectory: "true", directory: "" } as any}
              />
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Enter GitHub repository URL (e.g., owner/repo)"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  disabled={isBusy}
                  className="flex-grow"
                />
                <Button
                  variant="outline"
                  onClick={handleGithubClone}
                  disabled={isBusy || !repoUrl}
                  className="shrink-0"
                >
                  {isCloning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Github className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs mt-5 text-center pt-5 text-muted-foreground">
                Enter a GitHub repository URL in the format <span className="font-bold">owner/repo</span> or <span className="font-bold">owner/repo.git</span> and Make sure you added your GitHub API Key in the settings or shell
              </p>
            </div>
          </div>
          {projectStatus.has_project && (
            <>
              <Button
                variant="default" 
                className="w-full"
                onClick={handleReindex}
                disabled={isReindexing || isOperationInProgress()}
              >
                {isReindexing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reindexing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reindex Project
                  </>
                )}
              </Button>

              <Button
                variant="destructive"
                onClick={handleDeleteProject}
                className="w-full"
                disabled={isBusy}
              >
                {isDeleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                {isDeleting ? "Deleting..." : "Delete Project"}
              </Button>
            </>
          )}
        </div>
         <p className="text-sm text-muted-foreground text-center">
             Upload a ZIP file or folder to provide context for your coding queries.
         </p>
      </DialogContent>
    </Dialog>
  )
}