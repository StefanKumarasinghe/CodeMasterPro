import type { ApiRequest, Preferences, PinnedFile } from "@/types"


export function prepareApiRequest(
  message: string,
  language: string,
  mcp: string,
  providerName: string,
  freeModel: string,
  preferences: Preferences,
  chatId: string,
  modelType: string,
  customPrompt?: string,
  personalInfo?: string,
  pinnedFiles?: PinnedFile[]
): ApiRequest {
  // Create a deep copy of pinnedFiles to avoid any reference issues
  const processedPinnedFiles = pinnedFiles ? 
    pinnedFiles.map(file => ({
      path: file.path,
      name: file.name
    })) : 
    undefined;

  // Log the pinned files that we're sending
  if (processedPinnedFiles && processedPinnedFiles.length > 0) {
    console.log("Using pinned files for context:", processedPinnedFiles);
  }

  return {
    message,
    language,
    mcp,
    providerName,
    freeModel,
    outputFormat: preferences.outputFormat,
    syntaxHighlighting: preferences.syntaxHighlighting,
    showLineNumbers: preferences.showLineNumbers,
    autoComplete: preferences.autoComplete,
    customPrompt: customPrompt || "",
    personalInfo: personalInfo || "",
    chatId,
    modelType,
    pinnedFiles: processedPinnedFiles,
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


export async function eraseLongTermMemory() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_ENDPOINT}/erase_long_term_memory`, {
    method: "POST",
  })

  if (!response.ok) {
    throw new Error(`Failed with status: ${response.status}`)
  }

  return response.json()
}
