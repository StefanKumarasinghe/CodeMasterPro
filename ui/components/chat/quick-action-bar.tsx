"use client"

import { Button } from "@/components/ui/button"
import { Code, Bug, Zap, FileCode, Wand2, Copy } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "@/utils/toast-util"
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface QuickActionBarProps {
  onAction: (action: string, code: string, lang: string) => void
  language: string
  code?: string
}
export interface SavedSnippet {
  id: string
  name: string
  description: string
  code: string
}



export function QuickActionBar({ onAction, language, code = "" }: QuickActionBarProps) {
  const [isCopied, setIsCopied] = useState(false)
  const [open, setOpen] = useState(false)
  const [snippetName, setSnippetName] = useState("")
  const [snippetDescription, setSnippetDescription] = useState("")


  const getSavedSnippets = (): SavedSnippet[] =>{
    try {
      const raw = localStorage.getItem("code-snippets")
      return raw ? JSON.parse(raw) : []
    } catch (error) {
      console.error("Error reading snippets:", error)
      return []
    }
  }

  const saveSnippets = (snippets: SavedSnippet[]) => {
    try {
      localStorage.setItem("code-snippets", JSON.stringify(snippets))
    } catch (error) {
      console.error("Error saving snippets:", error)
    }
  }

  const addSnippet = (snippet: SavedSnippet)=>{
    const snippets = getSavedSnippets()
    snippets.push(snippet)
    saveSnippets(snippets)
  }


  const addSnippetToLocalStorage = () => {
    addSnippet({
      id: snippetName + "-" + Date.now(),
      name: snippetName,
      description: snippetDescription,
      code: code
    })
    setOpen(false)
    setSnippetName("")
    setSnippetDescription("")
  }

  const handleCopy = () => {
    if (!code) return

    navigator.clipboard
      .writeText(code)
      .then(() => {
        toast.success("Code copied to clipboard")
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
      })
      .catch((err) => {
        console.error("Failed to copy: ", err)
        toast.error("Could not copy to clipboard")
      })
  }

  

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-hide">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2 text-xs"
              onClick={handleCopy}
              disabled={isCopied || !code}
            >
              <Copy className="h-3.5 w-3.5" />
              <span>{isCopied ? "Copied!" : "Copy"}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copy code to clipboard</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2 text-xs"
              onClick={() => onAction("explain-code", code, language)}
            >
              <Code className="h-3.5 w-3.5" />
              <span>Explain</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Explain this code without showing it again</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
        <TooltipTrigger asChild>
            <AlertDialog open={open} onOpenChange={setOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 px-2 text-xs"
                >
                  <Code className="h-3.5 w-3.5" />
                  <span>Snippets</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Save Snippet</AlertDialogTitle>
                  <AlertDialogDescription>
                    Name and describe this code snippet to save it for later use.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Name
                    </Label>
                    <Input
                      id="name"
                      value={snippetName}
                      onChange={(e) => setSnippetName(e.target.value)}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">
                      Description
                    </Label>
                    <Input
                      id="description"
                      value={snippetDescription}
                      onChange={(e) => setSnippetDescription(e.target.value)}
                      className="col-span-3"
                    />
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={addSnippetToLocalStorage}>Save</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TooltipTrigger>
          <TooltipContent>
            <p>Save code snippet</p>
          </TooltipContent>
        </Tooltip>



        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2 text-xs"
              onClick={() => onAction("debug-code", code, language)}
            >
              <Bug className="h-3.5 w-3.5" />
              <span>Debug</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Debug this code without showing it again</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2 text-xs"
              onClick={() => onAction("optimize-code", code, language)}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Optimize</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Optimize this code without showing it again</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2 text-xs"
              onClick={() => onAction("add-comments", code, language)}
            >
              <FileCode className="h-3.5 w-3.5" />
              <span>Add Comments</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Add comments to this code without showing it again</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2 text-xs"
              onClick={() => onAction("generate-tests", code, language)}
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span>Generate Tests</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Generate tests for this code without showing it again</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}