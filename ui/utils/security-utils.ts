let censorshipEnabled = false

const API_KEY_PATTERNS: RegExp[] = [
  /['"]?(sk-[a-zA-Z0-9]{24,})['"]?/g,
  /['"]?(pk_live_[a-zA-Z0-9]{24,})['"]?/g,
  /['"]?(sk_live_[a-zA-Z0-9]{24,})['"]?/g,
  /['"]?(AKIA[0-9A-Z]{16})['"]?/g,
  /['"]?(ghp_[a-zA-Z0-9]{36,})['"]?/g,
  /['"]?(SG\.[\w-]{22}\.[\w-]{43})['"]?/g,
  /['"]?(xox[pbar]-\d{12}-\d{12}-\d{12}-[a-zA-Z0-9]{32})['"]?/g,
  /['"]?(ya29\.[0-9A-Za-z\-_]+)['"]?/g,
  /([A-Z_]+_(KEY|SECRET|TOKEN|PASSWORD|AUTH))=['"]([a-zA-Z0-9_\-.!@#$%^&*]{12,})['"]/g,
  /['"]?([a-zA-Z0-9_\-.]{24,64})['"]?(?=.*[A-Z].*\d|\d.*[A-Z])/g,
]

const COMMON_WORDS = new Set([
  "configuration",
  "development",
  "production",
  "environment",
  "application",
  "authentication",
  "authorization",
  "credentials",
  "certificate",
  "parameter",
  "connection",
  "database",
  "password",
  "username",
  "localhost",
  "server",
  "client",
  "request",
  "response",
  "message",
  "error",
  "warning",
  "information",
  "success",
  "failure",
  "exception",
  "timeout",
  "interval",
  "duration",
])

export function setCensorshipEnabled(enabled: boolean): void {
  censorshipEnabled = enabled
}

export function isCensorshipEnabled(): boolean {
  return censorshipEnabled
}

function calculateEntropy(str: string): number {
  const len = str.length
  const freq = new Map<string, number>()
  for (const char of str) {
    freq.set(char, (freq.get(char) || 0) + 1)
  }
  return Array.from(freq.values()).reduce((acc, count) => {
    const p = count / len
    return acc - p * Math.log2(p)
  }, 0)
}

function isLikelySensitive(value: string): boolean {
  return value.length >= 12 && calculateEntropy(value) > 3.5 && !COMMON_WORDS.has(value.toLowerCase())
}

export function containsSensitiveInfo(text: string): boolean {
  if (!censorshipEnabled) return false
  return API_KEY_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(text))) {
      const value = match[3] || match[1] || match[0]
      if (isLikelySensitive(value)) return true
    }
    return false
  })
}

export function maskSensitiveInfo(text: string): string {
  if (!censorshipEnabled) return text

  let masked = text

  for (const pattern of API_KEY_PATTERNS) {
    pattern.lastIndex = 0
    masked = masked.replace(pattern, (match, ...args) => {
      const groups = args.slice(0, -2)
      const sensitivePart = groups.find(isLikelySensitive)
      if (!sensitivePart) return match

      if (groups.length === 3) {
        return `${groups[0]}="**********"`
      }

      return `"**********"`
    })
  }

  return masked
}

export function processSensitiveCode(code: string): {
  code: string
  containedSensitiveInfo: boolean
  detectedKeys?: string[]
} {
  if (!censorshipEnabled) {
    return { code, containedSensitiveInfo: false }
  }

  const detectedKeys: string[] = []

  for (const pattern of API_KEY_PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(code))) {
      const value = match[3] || match[1] || match[0]
      if (isLikelySensitive(value)) {
        detectedKeys.push(`${value.slice(0, 4)}...${value.slice(-4)}`)
      }
    }
  }

  const containedSensitiveInfo = detectedKeys.length > 0

  return {
    code: containedSensitiveInfo ? maskSensitiveInfo(code) : code,
    containedSensitiveInfo,
    detectedKeys: containedSensitiveInfo ? detectedKeys : undefined,
  }
}
