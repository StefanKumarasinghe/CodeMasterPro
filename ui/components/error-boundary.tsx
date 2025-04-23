"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw } from "lucide-react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })
    console.error("Uncaught error:", error, errorInfo)

    // You could also log to an error reporting service here
  }

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })

    // Reload the page to reset the application state
    window.location.reload()
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen p-4 bg-background">
          <div className="w-full max-w-md p-6 space-y-4 bg-card rounded-lg shadow-lg border">
            <div className="flex items-center space-x-2 text-destructive">
              <AlertTriangle className="h-6 w-6" />
              <h2 className="text-xl font-bold">Something went wrong</h2>
            </div>

            <p className="text-muted-foreground">The application encountered an unexpected error. Please try again.</p>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="p-4 bg-muted rounded-md overflow-auto max-h-40">
                <p className="font-mono text-sm">{this.state.error.toString()}</p>
                {this.state.errorInfo && (
                  <pre className="mt-2 text-xs text-muted-foreground">{this.state.errorInfo.componentStack}</pre>
                )}
              </div>
            )}

            <Button onClick={this.handleReset} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload Application
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
