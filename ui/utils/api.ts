import type { ApiRequest, Preferences } from "@/types"

export function prepareApiRequest(
  message: string,
  language: string,
  preferences: Preferences,
  customPrompt?: string,
  personalInfo?: string,
): ApiRequest {
  return {
    message,
    language,
    outputFormat: preferences.outputFormat,
    codeQuality: preferences.codeQuality,
    syntaxHighlighting: preferences.syntaxHighlighting,
    showLineNumbers: preferences.showLineNumbers,
    autoComplete: preferences.autoComplete,
    customPrompt: customPrompt || "",
    personalInfo: personalInfo || "",
    clientInfo: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: navigator.language,
      userAgent: navigator.userAgent,
      screenSize: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    },
  }
}
