
interface SastRule {
  id: string
  name: string
  description: string
  severity: "blocker" | "critical" | "major" | "minor" | "info"
  tags: string[]
  languages: string[]
  check: (code: string) => SastIssue[]
}

export interface SastIssue {
  ruleId: string
  message: string
  severity: "blocker" | "critical" | "major" | "minor" | "info"
  line?: number
  column?: number
  endLine?: number
  endColumn?: number
  codeSnippet?: string
}

export interface SastResult {
  issues: SastIssue[]
  summary: {
    blockers: number
    critical: number
    major: number
    minor: number
    info: number
    total: number
  }
  metrics: {
    reliability: number 
    security: number 
    maintainability: number 
    duplication: number 
    complexity: number 
  }
  passed: boolean
}

function findLineNumber(code: string, index: number): number {
  const lines = code.substring(0, index).split("\n")
  return lines.length
}

function extractCodeSnippet(code: string, line: number, contextLines = 2): string {
  const lines = code.split("\n")
  const start = Math.max(0, line - contextLines - 1)
  const end = Math.min(lines.length, line + contextLines)

  return lines.slice(start, end).join("\n")
}

const javascriptRules: SastRule[] = [
  {
    id: "javascript:S1116",
    name: "Empty statements",
    description: "Empty statements (semicolons) should be removed",
    severity: "minor",
    tags: ["convention", "unused"],
    languages: ["javascript", "typescript"],
    check: (code: string) => {
      const regex = /(?<!;);\s*(?!\s*[)};,])/g
      const issues: SastIssue[] = []

      let match
      while ((match = regex.exec(code)) !== null) {
        const line = findLineNumber(code, match.index)
        issues.push({
          ruleId: "javascript:S1116",
          message: "Remove this empty statement.",
          severity: "minor",
          line,
          codeSnippet: extractCodeSnippet(code, line),
        })
      }
      return issues
    },
  },
  {
    id: "javascript:S1481",
    name: "Unused local variables",
    description: "Unused local variables should be removed",
    severity: "minor",
    tags: ["unused"],
    languages: ["javascript", "typescript"],
    check: (code: string) => {
      const varDeclarationRegex = /(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:=|;)/g
      const issues: SastIssue[] = []

      let match
      while ((match = varDeclarationRegex.exec(code)) !== null) {
        const varName = match[1]
        const varUsageRegex = new RegExp(`[^a-zA-Z0-9_$]${varName}[^a-zA-Z0-9_$]`, "g")
        varUsageRegex.lastIndex = match.index + match[0].length

        if (!varUsageRegex.test(code)) {
          const line = findLineNumber(code, match.index)
          issues.push({
            ruleId: "javascript:S1481",
            message: `Remove the declaration of the unused '${varName}' variable.`,
            severity: "minor",
            line,
            codeSnippet: extractCodeSnippet(code, line),
          })
        }
      }

      return issues
    },
  },
  {
    id: "javascript:S1105",
    name: "Opening curly braces should be at the end of lines",
    description: "Opening curly braces should be at the end of lines, not the beginning",
    severity: "minor",
    tags: ["convention"],
    languages: ["javascript", "typescript"],
    check: (code: string) => {
      const regex = /\n\s*\{(?!\s*\n\s*(['"`])\1)/g
      const issues: SastIssue[] = []

      let match
      while ((match = regex.exec(code)) !== null) {
        const line = findLineNumber(code, match.index)
        issues.push({
          ruleId: "javascript:S1105",
          message: "Move this opening curly brace to the end of the previous line.",
          severity: "minor",
          line,
          codeSnippet: extractCodeSnippet(code, line),
        })
      }

      return issues
    },
  },
  {
    id: "javascript:S1848",
    name: "Objects should not be created to be dropped immediately without being used",
    description: "Creating objects without using them is wasteful",
    severity: "major",
    tags: ["unused", "performance"],
    languages: ["javascript", "typescript"],
    check: (code: string) => {
      const regex = /new\s+([A-Z][a-zA-Z0-9_$]*)$$[^)]*$$(?!\s*[.;,)\]}])/g
      const issues: SastIssue[] = []
      let match
      while ((match = regex.exec(code)) !== null) {
        const line = findLineNumber(code, match.index)
        issues.push({
          ruleId: "javascript:S1848",
          message: `Either use this object or remove this new ${match[1]}().`,
          severity: "major",
          line,
          codeSnippet: extractCodeSnippet(code, line),
        })
      }

      return issues
    },
  },
  {
    id: "javascript:S2819",
    name: "eval usage",
    description: "eval should not be used",
    severity: "critical",
    tags: ["security"],
    languages: ["javascript", "typescript"],
    check: (code: string) => {
      const regex = /\beval\s*\(/g
      const issues: SastIssue[] = []

      let match
      while ((match = regex.exec(code)) !== null) {
        const line = findLineNumber(code, match.index)
        issues.push({
          ruleId: "javascript:S2819",
          message: 'Replace this use of the JavaScript "eval" function with safer alternatives.',
          severity: "critical",
          line,
          codeSnippet: extractCodeSnippet(code, line),
        })
      }

      return issues
    },
  },
  {
    id: "javascript:S3776",
    name: "Cognitive Complexity",
    description: "Functions should not be too complex",
    severity: "major",
    tags: ["brain-overload"],
    languages: ["javascript", "typescript"],
    check: (code: string) => {
      const regex = /\b(if|for|while|switch)\b/g
      const issues: SastIssue[] = []
      let count = 0
      let match
      while ((match = regex.exec(code)) !== null) {
        count++
      }

      if (count > 10) {
        issues.push({
          ruleId: "javascript:S3776",
          message: `Refactor this code to reduce its Cognitive Complexity from ${count} to the 10 allowed.`,
          severity: "major",
          line: 1,
        })
      }

      return issues
    },
  },
  {
    id: "javascript:S1134",
    name: "TODO comments",
    description: "TODO comments should be resolved",
    severity: "info",
    tags: ["convention"],
    languages: ["javascript", "typescript"],
    check: (code: string) => {
      const regex = /\/\/\s*TODO|\/\*\s*TODO[\s\S]*?\*\//g
      const issues: SastIssue[] = []

      let match
      while ((match = regex.exec(code)) !== null) {
        const line = findLineNumber(code, match.index)
        issues.push({
          ruleId: "javascript:S1134",
          message: "Complete the task associated to this TODO comment.",
          severity: "info",
          line,
          codeSnippet: extractCodeSnippet(code, line),
        })
      }

      return issues
    },
  },
  {
    id: "javascript:S1472",
    name: "Function declaration inside loop",
    description: "Function declarations should not be made within loops",
    severity: "major",
    tags: ["bug", "performance"],
    languages: ["javascript", "typescript"],
    check: (code: string) => {
      const regex = /\b(for|while)\b[^{]*\{[^}]*function\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/g
      const issues: SastIssue[] = []

      let match
      while ((match = regex.exec(code)) !== null) {
        const line = findLineNumber(code, match.index)
        issues.push({
          ruleId: "javascript:S1472",
          message: "Declare this function outside of a loop.",
          severity: "major",
          line,
          codeSnippet: extractCodeSnippet(code, line),
        })
      }

      return issues
    },
  },
]

const pythonRules: SastRule[] = [
  {
    id: "python:S1481",
    name: "Unused local variables",
    description: "Unused local variables should be removed",
    severity: "minor",
    tags: ["unused"],
    languages: ["python"],
    check: (code: string) => {
      const varDeclarationRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*[^=]/g
      const issues: SastIssue[] = []

      let match
      while ((match = varDeclarationRegex.exec(code)) !== null) {
        const varName = match[1]
        if (["self", "cls", "_", "i", "j", "k"].includes(varName)) {
          continue
        }

        const varUsageRegex = new RegExp(`[^a-zA-Z0-9_]${varName}[^a-zA-Z0-9_=]`, "g")
        varUsageRegex.lastIndex = match.index + match[0].length

        if (!varUsageRegex.test(code)) {
          const line = findLineNumber(code, match.index)
          issues.push({
            ruleId: "python:S1481",
            message: `Remove the unused local variable "${varName}".`,
            severity: "minor",
            line,
            codeSnippet: extractCodeSnippet(code, line),
          })
        }
      }

      return issues
    },
  },
  {
    id: "python:S1066",
    name: 'Collapsible "if" statements',
    description: 'Collapsible "if" statements should be merged',
    severity: "minor",
    tags: ["convention"],
    languages: ["python"],
    check: (code: string) => {
      const regex = /if\s+.*:\s*\n\s+if\s+/g
      const issues: SastIssue[] = []

      let match
      while ((match = regex.exec(code)) !== null) {
        const line = findLineNumber(code, match.index)
        issues.push({
          ruleId: "python:S1066",
          message: "Merge this if statement with the enclosing one.",
          severity: "minor",
          line,
          codeSnippet: extractCodeSnippet(code, line),
        })
      }

      return issues
    },
  },
  {
    id: "python:S1716",
    name: "eval usage",
    description: "eval, exec should not be used",
    severity: "critical",
    tags: ["security"],
    languages: ["python"],
    check: (code: string) => {
      const regex = /\b(eval|exec)\s*\(/g
      const issues: SastIssue[] = []

      let match
      while ((match = regex.exec(code)) !== null) {
        const line = findLineNumber(code, match.index)
        issues.push({
          ruleId: "python:S1716",
          message: `Replace this use of the Python "${match[1]}" function with safer alternatives.`,
          severity: "critical",
          line,
          codeSnippet: extractCodeSnippet(code, line),
        })
      }

      return issues
    },
  },
  {
    id: "python:S5332",
    name: "Insecure HTTP connection",
    description: "Using HTTP instead of HTTPS is insecure",
    severity: "critical",
    tags: ["security"],
    languages: ["python"],
    check: (code: string) => {
      const regex = /\b(http:\/\/|requests\.get\(\s*['"]http:\/\/)/g
      const issues: SastIssue[] = []

      let match
      while ((match = regex.exec(code)) !== null) {
        const line = findLineNumber(code, match.index)
        issues.push({
          ruleId: "python:S5332",
          message: "Use HTTPS instead of HTTP.",
          severity: "critical",
          line,
          codeSnippet: extractCodeSnippet(code, line),
        })
      }

      return issues
    },
  },
]

const htmlRules: SastRule[] = [
  {
    id: "html:S1827",
    name: "Deprecated HTML attributes",
    description: "Deprecated HTML attributes should not be used",
    severity: "minor",
    tags: ["obsolete"],
    languages: ["html"],
    check: (code: string) => {
      const regex =
        /<[^>]+\s(align|alink|background|bgcolor|border|cellpadding|cellspacing|char|charoff|clear|compact|frame|hspace|link|marginheight|marginwidth|noshade|nowrap|rules|scrolling|size|text|valign|vlink|vspace)=/gi
      const issues: SastIssue[] = []

      let match
      while ((match = regex.exec(code)) !== null) {
        const line = findLineNumber(code, match.index)
        issues.push({
          ruleId: "html:S1827",
          message: `Remove this deprecated "${match[1]}" attribute.`,
          severity: "minor",
          line,
          codeSnippet: extractCodeSnippet(code, line),
        })
      }

      return issues
    },
  },
  {
    id: "html:S5254",
    name: 'Missing "lang" attribute',
    description: 'The "lang" attribute should be defined on the "html" tag',
    severity: "minor",
    tags: ["accessibility"],
    languages: ["html"],
    check: (code: string) => {
      const hasHtmlTag = /<html[^>]*>/i.test(code)
      const hasLangAttr = /<html[^>]*\slang=/i.test(code)

      if (hasHtmlTag && !hasLangAttr) {
        const match = /<html[^>]*>/i.exec(code)
        if (match) {
          const line = findLineNumber(code, match.index)
          return [
            {
              ruleId: "html:S5254",
              message: 'Add a "lang" attribute to this "<html>" tag.',
              severity: "minor",
              line,
              codeSnippet: extractCodeSnippet(code, line),
            },
          ]
        }
      }

      return []
    },
  },
  {
    id: "html:S5255",
    name: 'Missing "alt" attribute',
    description: 'The "alt" attribute should be defined on "img" tags',
    severity: "minor",
    tags: ["accessibility"],
    languages: ["html"],
    check: (code: string) => {
      const regex = /<img[^>]*(?!alt=)[^>]*>/gi
      const issues: SastIssue[] = []

      let match
      while ((match = regex.exec(code)) !== null) {
        if (!/<img[^>]*\salt=/i.test(match[0])) {
          const line = findLineNumber(code, match.index)
          issues.push({
            ruleId: "html:S5255",
            message: 'Add an "alt" attribute to this "<img>" tag.',
            severity: "minor",
            line,
            codeSnippet: extractCodeSnippet(code, line),
          })
        }
      }

      return issues
    },
  },
]

const securityRules: SastRule[] = [
  {
    id: "security:S5131",
    name: "Cross-Site Scripting (XSS)",
    description: "User-controlled data should not be used in HTML output without proper escaping",
    severity: "blocker",
    tags: ["security", "xss"],
    languages: ["javascript", "typescript", "python", "html"],
    check: (code: string) => {
      const jsRegex = /\.(innerHTML|outerHTML)\s*=|document\.write\(/g
      const reactRegex = /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:/g
      const issues: SastIssue[] = []

      ;[jsRegex, reactRegex].forEach((regex) => {
        let match
        while ((match = regex.exec(code)) !== null) {
          const line = findLineNumber(code, match.index)
          issues.push({
            ruleId: "security:S5131",
            message: "Make sure using user-controlled data in this HTML context is safe.",
            severity: "blocker",
            line,
            codeSnippet: extractCodeSnippet(code, line),
          })
        }
      })

      return issues
    },
  },
  {
    id: "security:S5144",
    name: "Server-Side Request Forgery (SSRF)",
    description: "User-controlled data should not be used in HTTP requests without validation",
    severity: "blocker",
    tags: ["security", "ssrf"],
    languages: ["javascript", "typescript", "python"],
    check: (code: string) => {
      const jsRegex = /\b(fetch|axios\.get|http\.get)\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)/g
      const pyRegex = /\b(requests\.get|urllib\.request\.urlopen)\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)/g
      const issues: SastIssue[] = []
      let match
      while ((match = jsRegex.exec(code)) !== null) {
        const line = findLineNumber(code, match.index)
        issues.push({
          ruleId: "security:S5144",
          message: `Make sure using user-controlled data in this HTTP request is safe. Variable: "${match[2]}"`,
          severity: "blocker",
          line,
          codeSnippet: extractCodeSnippet(code, line),
        })
      }

      while ((match = pyRegex.exec(code)) !== null) {
        const line = findLineNumber(code, match.index)
        issues.push({
          ruleId: "security:S5144",
          message: `Make sure using user-controlled data in this HTTP request is safe. Variable: "${match[2]}"`,
          severity: "blocker",
          line,
          codeSnippet: extractCodeSnippet(code, line),
        })
      }

      return issues
    },
  },
  {
    id: "security:S5334",
    name: "Weak Cryptography",
    description: "Weak cryptographic algorithms should not be used",
    severity: "critical",
    tags: ["security", "cryptography"],
    languages: ["javascript", "typescript", "python"],
    check: (code: string) => {
      const jsRegex = /\bcreateHash\s*$$\s*['"]md5['"]$$|\bcreateHash\s*$$\s*['"]sha1['"]$$/g
      const pyRegex = /\bhashlib\.(md5|sha1)\b/g
      const issues: SastIssue[] = []

      let match
      while ((match = jsRegex.exec(code)) !== null) {
        const line = findLineNumber(code, match.index)
        issues.push({
          ruleId: "security:S5334",
          message: "Use a stronger hashing algorithm than MD5 or SHA1.",
          severity: "critical",
          line,
          codeSnippet: extractCodeSnippet(code, line),
        })
      }

      while ((match = pyRegex.exec(code)) !== null) {
        const line = findLineNumber(code, match.index)
        issues.push({
          ruleId: "security:S5334",
          message: `Use a stronger hashing algorithm than ${match[1].toUpperCase()}.`,
          severity: "critical",
          line,
          codeSnippet: extractCodeSnippet(code, line),
        })
      }

      return issues
    },
  },
]

const allRules: SastRule[] = [...javascriptRules, ...pythonRules, ...htmlRules, ...securityRules]

export function analyzeSast(code: string, language: string): SastResult {

  const applicableRules = allRules.filter((rule) => rule.languages.includes(language) || rule.languages.includes("*"))

  const allIssues: SastIssue[] = []
  applicableRules.forEach((rule) => {
    const issues = rule.check(code)
    allIssues.push(...issues)
  })

  const summary = {
    blockers: allIssues.filter((i) => i.severity === "blocker").length,
    critical: allIssues.filter((i) => i.severity === "critical").length,
    major: allIssues.filter((i) => i.severity === "major").length,
    minor: allIssues.filter((i) => i.severity === "minor").length,
    info: allIssues.filter((i) => i.severity === "info").length,
    total: allIssues.length,
  }

  const metrics = {
    reliability: calculateReliabilityScore(allIssues),
    security: calculateSecurityScore(allIssues),
    maintainability: calculateMaintainabilityScore(allIssues),
    duplication: 0, 
    complexity: calculateComplexityScore(code),
  }

  const passed = summary.blockers === 0 && summary.critical <= 1

  return {
    issues: allIssues,
    summary,
    metrics,
    passed,
  }
}

function calculateReliabilityScore(issues: SastIssue[]): number {
  const reliabilityIssues = issues.filter(
    (i) => i.ruleId.includes("bug") || i.severity === "blocker" || i.severity === "critical",
  )

  return Math.max(0, 100 - reliabilityIssues.length * 10)
}

function calculateSecurityScore(issues: SastIssue[]): number {
  const securityIssues = issues.filter((i) => i.ruleId.includes("security"))

  return Math.max(0, 100 - securityIssues.length * 20)
}

function calculateMaintainabilityScore(issues: SastIssue[]): number {
  const maintainabilityIssues = issues.filter(
    (i) =>
      i.severity === "minor" || i.severity === "info",
  )

  return Math.max(0, 100 - maintainabilityIssues.length * 5)
}

function calculateComplexityScore(code: string): number {
  const controlFlowCount = (code.match(/\b(if|for|while|switch|catch)\b/g) || []).length
  const functionCount = (code.match(/\b(function|=>)\b/g) || []).length

  return Math.min(10, (controlFlowCount + functionCount) / 10)
}
