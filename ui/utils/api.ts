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

// Add function to upload documentation
export async function uploadDocumentation(files: File[], description: string, eraseLongTermMemory: boolean) {
  const formData = new FormData()

  files.forEach((file) => {
    formData.append("files", file)
  })

  formData.append("description", description)
  formData.append("eraseLongTermMemory", eraseLongTermMemory.toString())

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_ENDPOINT}/add_documentation`, {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Upload failed with status: ${response.status}`)
  }

  return response.json()
}

// Add function to erase long-term memory
export async function eraseLongTermMemory() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_ENDPOINT}/erase_long_term_memory`, {
    method: "POST",
  })

  if (!response.ok) {
    throw new Error(`Failed with status: ${response.status}`)
  }

  return response.json()
}
