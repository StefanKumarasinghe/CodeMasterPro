"use client";

import { useState, useEffect } from "react";
import {Shield,AlertTriangle,CheckCircle,X,Info,RefreshCw,Download,ExternalLink,} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/utils/toast-util";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { analyzeSast } from "@/utils/sast-analyzer";
import { processSensitiveCode } from "@/utils/security-utils";
import { cn } from "@/lib/utils";

interface CodeSastProps {
  code: string;
  language: string;
  onClose: () => void;
}

export function CodeSast({ code, language, onClose }: CodeSastProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("issues");

  const runSastAnalysis = async () => {
    setIsLoading(true);

    try {
      const { containedSensitiveInfo, detectedKeys } =
        processSensitiveCode(code);
      const results = analyzeSast(code, language);
      if (containedSensitiveInfo && detectedKeys) {
        results.issues.push({
          ruleId: "security:S5131",
          message: `Sensitive information detected: ${detectedKeys.join(", ")}`,
          severity: "blocker",
          line: 1,
          codeSnippet: "...",
        });
        results.summary.blockers += 1;
        results.summary.total += 1;
        results.metrics.security = Math.max(0, results.metrics.security - 20);
        results.passed = false;
      }
      setResults(results);
    } catch (error) {
      console.error("SAST analysis failed:", error);
      toast.error("Failed to run security analysis");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runSastAnalysis();
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "blocker":
        return "text-red-500";
      case "critical":
        return "text-orange-500";
      case "major":
        return "text-yellow-500";
      case "minor":
        return "text-blue-500";
      case "info":
        return "text-gray-500";
      default:
        return "text-gray-500";
    }
  };

  const getSeverityBgColor = (severity: string) => {
    switch (severity) {
      case "blocker":
        return "bg-red-500/5";
      case "critical":
        return "bg-orange-500/5";
      case "major":
        return "bg-yellow-500/5";
      case "minor":
        return "bg-blue-500/5";
      case "info":
        return "bg-gray-500/5";
      default:
        return "bg-gray-500/5";
    }
  };

  const downloadReport = () => {
    if (!results) return;
    const report = {
      timestamp: new Date().toISOString(),
      language,
      summary: results.summary,
      metrics: results.metrics,
      issues: results.issues,
      passed: results.passed,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sast-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("SAST report downloaded");
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border rounded-lg shadow-lg p-6 max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Security & Quality Analysis
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={runSastAnalysis}
              disabled={isLoading}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </Button>
            {results && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={downloadReport}
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="h-8 w-8 border-2 border-t-transparent border-primary rounded-full animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">
              Running security analysis...
            </p>
          </div>
        ) : results ? (
          <div className="flex-1 overflow-hidden flex flex-col z-50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div
                className={cn(
                  "p-4 rounded-lg border",
                  results.passed
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-red-500/10 border-red-500/30"
                )}
              >
                <h3 className="text-sm font-medium mb-1">Quality Gate</h3>
                <div className="flex items-center gap-2">
                  {results.passed ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="text-green-500 font-medium">Passed</span>
                    </>
                    ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <span className="text-red-500 font-medium">Failed</span>
                    </>
                  )}
                </div>
              </div>
              <div className="p-4 rounded-lg border">
                <h3 className="text-sm font-medium mb-1">Issues</h3>
                <div className="grid grid-cols-5 gap-2 text-center">
                  <div>
                    <div className="text-red-500 font-bold">
                      {results.summary.blockers}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Blockers
                    </div>
                  </div>
                  <div>
                    <div className="text-orange-500 font-bold">
                      {results.summary.critical}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Critical
                    </div>
                  </div>
                  <div>
                    <div className="text-yellow-500 font-bold">
                      {results.summary.major}
                    </div>
                    <div className="text-xs text-muted-foreground">Major</div>
                  </div>
                  <div>
                    <div className="text-blue-500 font-bold">
                      {results.summary.minor}
                    </div>
                    <div className="text-xs text-muted-foreground">Minor</div>
                  </div>
                  <div>
                    <div className="text-gray-500 font-bold">
                      {results.summary.info}
                    </div>
                    <div className="text-xs text-muted-foreground">Info</div>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-lg border">
                <h3 className="text-sm font-medium mb-1">Metrics</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div
                      className={cn(
                        "font-bold",
                        results.metrics.reliability > 80
                          ? "text-green-500"
                          : results.metrics.reliability > 60
                          ? "text-yellow-500"
                          : "text-red-500"
                      )}
                    >
                      {results.metrics.reliability}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Reliability
                    </div>
                  </div>
                  <div>
                    <div
                      className={cn(
                        "font-bold",
                        results.metrics.security > 80
                          ? "text-green-500"
                          : results.metrics.security > 60
                          ? "text-yellow-500"
                          : "text-red-500"
                      )}
                    >
                      {results.metrics.security}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Security
                    </div>
                  </div>
                  <div>
                    <div
                      className={cn(
                        "font-bold",
                        results.metrics.maintainability > 80
                          ? "text-green-500"
                          : results.metrics.maintainability > 60
                          ? "text-yellow-500"
                          : "text-red-500"
                      )}
                    >
                      {results.metrics.maintainability}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Maintainability
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1 flex flex-col"
            >
              <TabsList className="mb-4">
                <TabsTrigger value="issues">
                  Issues ({results.summary.total})
                </TabsTrigger>
                <TabsTrigger value="metrics">Detailed Metrics</TabsTrigger>
                <TabsTrigger value="recommendations">
                  Recommendations
                </TabsTrigger>
              </TabsList>
              <TabsContent value="issues" className="flex-1 overflow-hidden">
                <ScrollArea className="h-[400px]">
                  {results.issues.length > 0 ? (
                    <div className="space-y-2">
                      <div className="border rounded-md overflow-hidden">
                        {results.issues.map((issue: any, index: number) => (
                          <div
                            key={index}
                            className={cn(
                              "p-3 border-b last:border-b-0",
                              getSeverityBgColor(issue.severity)
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <div className="mt-0.5">
                                {issue.severity === "blocker" ||
                                issue.severity === "critical" ? (
                                  <AlertTriangle
                                    className={cn(
                                      "h-4 w-4",
                                      getSeverityColor(issue.severity)
                                    )}
                                  />
                                ) : (
                                  <Info
                                    className={cn(
                                      "h-4 w-4",
                                      getSeverityColor(issue.severity)
                                    )}
                                  />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "text-xs font-medium",
                                      getSeverityColor(issue.severity)
                                    )}
                                  >
                                    {issue.severity.charAt(0).toUpperCase() +
                                      issue.severity.slice(1)}
                                  </span>
                                  {issue.line && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      Line {issue.line}
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    {issue.ruleId}
                                  </Badge>
                                </div>
                                <p className="text-sm mt-1">{issue.message}</p>
                                {issue.codeSnippet && (
                                  <div className="mt-2 bg-muted/50 p-2 rounded-md text-xs font-mono overflow-x-auto">
                                    {issue.codeSnippet}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-500/10 border border-green-200 rounded-md p-4 text-center">
                      <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                      <p className="text-sm font-medium">
                        No issues found in your code!
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Your code passed all security and quality checks.
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
              <TabsContent value="metrics" className="flex-1 overflow-hidden">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border rounded-md p-4">
                        <h3 className="text-sm font-medium mb-3">
                          Reliability ({results.metrics.reliability}%)
                        </h3>
                        <div className="h-2 bg-muted rounded-full mb-4">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              results.metrics.reliability > 80
                                ? "bg-green-500"
                                : results.metrics.reliability > 60
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            )}
                            style={{ width: `${results.metrics.reliability}%` }}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Reliability measures how well the code functions
                          without bugs or unexpected behavior.
                        </p>
                      </div>

                      <div className="border rounded-md p-4">
                        <h3 className="text-sm font-medium mb-3">
                          Security ({results.metrics.security}%)
                        </h3>
                        <div className="h-2 bg-muted rounded-full mb-4">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              results.metrics.security > 80
                                ? "bg-green-500"
                                : results.metrics.security > 60
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            )}
                            style={{ width: `${results.metrics.security}%` }}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Security measures how well the code protects against
                          vulnerabilities and attacks.
                        </p>
                      </div>

                      <div className="border rounded-md p-4">
                        <h3 className="text-sm font-medium mb-3">
                          Maintainability ({results.metrics.maintainability}%)
                        </h3>
                        <div className="h-2 bg-muted rounded-full mb-4">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              results.metrics.maintainability > 80
                                ? "bg-green-500"
                                : results.metrics.maintainability > 60
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            )}
                            style={{
                              width: `${results.metrics.maintainability}%`,
                            }}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Maintainability measures how easy it is to understand,
                          modify, and extend the code.
                        </p>
                      </div>

                      <div className="border rounded-md p-4">
                        <h3 className="text-sm font-medium mb-3">
                          Complexity ({results.metrics.complexity.toFixed(1)})
                        </h3>
                        <div className="h-2 bg-muted rounded-full mb-4">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              results.metrics.complexity < 3
                                ? "bg-green-500"
                                : results.metrics.complexity < 6
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            )}
                            style={{
                              width: `${Math.min(
                                results.metrics.complexity * 10,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Complexity measures how difficult the code is to
                          understand and maintain.
                        </p>
                      </div>
                    </div>

                    <div className="border rounded-md p-4">
                      <h3 className="text-sm font-medium mb-3">
                        Analysis Details
                      </h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Language
                          </span>
                          <span className="font-medium">{language}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Rules Applied
                          </span>
                          <span className="font-medium">
                            {results.issues.length} rules
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Analysis Date
                          </span>
                          <span className="font-medium">
                            {new Date().toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent
                value="recommendations"
                className="flex-1 overflow-hidden"
              >
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    <div className="border rounded-md p-4">
                      <h3 className="text-sm font-medium mb-2">
                        Recommended Actions
                      </h3>
                      <ul className="space-y-2 mt-2">
                        {results.issues.length > 0 ? (
                          <>
                            {results.summary.blockers > 0 && (
                              <li className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium">
                                    Fix blocker issues immediately
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    These issues pose significant security or
                                    reliability risks.
                                  </p>
                                </div>
                              </li>
                            )}
                            {results.summary.critical > 0 && (
                              <li className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium">
                                    Address critical issues
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    These issues should be fixed before
                                    deploying to production.
                                  </p>
                                </div>
                              </li>
                            )}
                            {results.metrics.maintainability < 70 && (
                              <li className="flex items-start gap-2">
                                <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium">
                                    Improve code maintainability
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Consider refactoring to improve readability
                                    and maintainability.
                                  </p>
                                </div>
                              </li>
                            )}
                            {results.metrics.complexity > 5 && (
                              <li className="flex items-start gap-2">
                                <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium">
                                    Reduce code complexity
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Break down complex functions into smaller,
                                    more manageable pieces.
                                  </p>
                                </div>
                              </li>
                            )}
                          </>
                        ) : (
                          <li className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">
                                No immediate actions needed
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Your code looks good! Continue following best
                                practices.
                              </p>
                            </div>
                          </li>
                        )}
                      </ul>
                    </div>

                    <div className="border rounded-md p-4">
                      <h3 className="text-sm font-medium mb-2">Resources</h3>
                      <ul className="space-y-2 mt-2">
                        <li className="flex items-start gap-2">
                          <ExternalLink className="h-4 w-4 text-blue-500 mt-0.5" />
                          <a
                            href="https://owasp.org/www-project-top-ten/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-500 hover:underline"
                          >
                            OWASP Top 10 Web Application Security Risks
                          </a>
                        </li>
                        <li className="flex items-start gap-2">
                          <ExternalLink className="h-4 w-4 text-blue-500 mt-0.5" />
                          <a
                            href="https://sonarcloud.io/documentation"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-500 hover:underline"
                          >
                            SonarQube Documentation
                          </a>
                        </li>
                        <li className="flex items-start gap-2">
                          <ExternalLink className="h-4 w-4 text-blue-500 mt-0.5" />
                          <a
                            href="https://cheatsheetseries.owasp.org/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-500 hover:underline"
                          >
                            OWASP Cheat Sheet Series
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
          ) : (
          <div className="text-center py-8">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm font-medium">Failed to analyze code</p>
            <p className="text-xs text-muted-foreground mt-1">
              Please try again later
            </p>
          </div>
        )}
        <div className="flex justify-end mt-6">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
