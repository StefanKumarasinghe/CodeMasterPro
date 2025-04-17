import { cn } from "@/lib/utils"

interface CodeFallbackProps {
  code: string
  language?: string
  className?: string
}

export function CodeFallback({ code, language, className }: CodeFallbackProps) {
  return (
    <div className={cn("overflow-hidden", className)}>
      <pre className="bg-zinc-900 p-4 overflow-x-auto text-sm text-zinc-100 rounded-b-md whitespace-pre-wrap">
        <code>{code}</code>
      </pre>
    </div>
  )
}
