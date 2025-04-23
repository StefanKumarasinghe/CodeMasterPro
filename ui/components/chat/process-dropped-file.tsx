import { readFileAsText, detectLanguage, MAX_FILE_SIZE } from "@/utils/file-utils"

export const processDroppedFile = async (
  file: File,
): Promise<{ content: string; language: string; fileName: string }> => {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`)
  }

  const content = await readFileAsText(file)
  const language = detectLanguage(file.name)

  return { content, language, fileName: file.name }
}
