"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileCode, Trash } from "lucide-react";
import { toast } from "@/utils/toast-util";

interface CodeTemplatesProps {
  onSelectTemplate: (template: string) => void;
}

interface CodeSnippet {
  id: string;
  name: string;
  description: string;
  code: string;
  icon?: JSX.Element; 
}

export function CodeTemplates({ onSelectTemplate }: CodeTemplatesProps) {
  const defaultTemplates: CodeSnippet[] = [
    {
      id: "react-component",
      name: "React Component",
      description: "Basic React functional component",
      code: `import React from "react"
             export default function Component() {
             return <div>Hello World</div>
            }`,
    },
  ];

  const [templates, setTemplates] = useState<CodeSnippet[]>([]);

  const loadSnippets = useCallback((): CodeSnippet[] => {
    try {
      const raw = localStorage.getItem("code-snippets");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((snippet: Omit<CodeSnippet, "icon">) => ({
        ...snippet,
        icon: <FileCode className="h-4 w-4" />,
      }));
    } catch (error) {
      console.error("Error loading snippets:", error);
      return [];
    }
  }, []);

  useEffect(() => {
    const localSnippets = loadSnippets();
    const enrichedDefault = defaultTemplates.map((t) => ({
      ...t,
      icon: <FileCode className="h-4 w-4" />,
    }));
    setTemplates([...enrichedDefault, ...localSnippets]);
  }, [loadSnippets]);

  const deleteTemplate = (id: string) => {
    const updated = templates.filter(
      (t) => t.id !== id && !defaultTemplates.find((d) => d.id === t.id)
    );
    const toStore = updated.map(({ id, name, description, code }) => ({
      id,
      name,
      description,
      code,
    }));
    localStorage.setItem("code-snippets", JSON.stringify(toStore));
    toast.success("Snippet deleted successfully!");
    setTemplates([
      ...defaultTemplates.map((t) => ({
        ...t,
        icon: <FileCode className="h-4 w-4" />,
      })),
      ...updated,
    ]);
  };

  const deleteAllTemplates = () => {
    localStorage.removeItem("code-snippets");
    toast.success("All snippets deleted successfully!");
    setTemplates(
      defaultTemplates.map((t) => ({
        ...t,
        icon: <FileCode className="h-4 w-4" />,
      }))
    );
  };

  const sortedTemplates = [...templates].sort((a, b) => {
    const aDate = new Date(a.id).getTime();
    const bDate = new Date(b.id).getTime();
    return bDate - aDate;
  });

  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Code Templates</h3>
        <Button variant="destructive" size="sm" onClick={deleteAllTemplates}>
          <Trash className="h-4 w-4 mr-2" />
          Delete All
        </Button>
      </div>
      <ScrollArea className="h-64">
        <div className="grid gap-1 p-2">
          {sortedTemplates.map((template) => (
            <div key={template.id} className="flex items-center">
              <Button
                variant="ghost"
                className="justify-start h-auto px-3 py-2 rounded-lg hover:bg-muted w-full"
                onClick={() => onSelectTemplate(template.code)}
              >
                <div className="flex items-start gap-3 w-full">
                  {template.icon ?? <FileCode className="h-4 w-4" />}
                  <div className="text-left space-y-0.5 w-full">
                    <div className="text-sm font-medium leading-none">
                      {template.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {template.description}
                    </div>
                  </div>
                </div>
              </Button>
              {!defaultTemplates.some((t) => t.id === template.id) && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteTemplate(template.id)}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
