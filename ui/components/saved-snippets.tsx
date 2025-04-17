"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Copy, Trash2, Search, Code } from "lucide-react"
import { toast } from "@/utils/toast-util"

interface Snippet {
  id: string
  title: string
  code: string
  language: string
  createdAt: string
  tags: string[]
}

export function SavedSnippets() {
  const [searchQuery, setSearchQuery] = useState("")

  // Mock data - in a real app, this would come from localStorage or a database
  const [snippets, setSnippets] = useState<Snippet[]>([
    {
      id: "1",
      title: "React useState Hook Example",
      code: "const [count, setCount] = useState(0);\n\nfunction increment() {\n  setCount(prevCount => prevCount + 1);\n}",
      language: "javascript",
      createdAt: "2023-04-15",
      tags: ["react", "hooks"],
    },
    {
      id: "2",
      title: "Express Route Handler",
      code: "app.get('/api/users', async (req, res) => {\n  try {\n    const users = await db.getUsers();\n    res.json(users);\n  } catch (error) {\n    res.status(500).json({ error: error.message });\n  }\n});",
      language: "javascript",
      createdAt: "2023-04-10",
      tags: ["express", "api"],
    },
    {
      id: "3",
      title: "Python List Comprehension",
      code: "# Create a list of squares\nsquares = [x**2 for x in range(10)]\n\n# Filter even numbers\neven_squares = [x**2 for x in range(10) if x % 2 == 0]",
      language: "python",
      createdAt: "2023-04-05",
      tags: ["python", "list"],
    },
  ])

  const filteredSnippets = snippets.filter(
    (snippet) =>
      snippet.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      snippet.language.toLowerCase().includes(searchQuery.toLowerCase()) ||
      snippet.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())),
  )

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success("Copied to clipboard")
  }

  const deleteSnippet = (id: string) => {
    setSnippets(snippets.filter((snippet) => snippet.id !== id))
    toast.success("Snippet deleted")
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold mb-4">Saved Snippets</h1>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search snippets..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        {filteredSnippets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <Code className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No snippets found</h3>
            <p className="text-muted-foreground mt-1">
              {searchQuery ? "Try a different search term" : "Save code snippets from your chats to see them here"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredSnippets.map((snippet) => (
              <Card key={snippet.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{snippet.title}</CardTitle>
                      <CardDescription>
                        {new Date(snippet.createdAt).toLocaleDateString()} · {snippet.language}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => copyToClipboard(snippet.code)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteSnippet(snippet.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-2 rounded-md overflow-x-auto text-sm">
                    <code>{snippet.code}</code>
                  </pre>
                </CardContent>
                <CardFooter>
                  <div className="flex flex-wrap gap-1">
                    {snippet.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
