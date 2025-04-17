import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"

export async function POST(req: Request) {
  const { messages, customPrompt, preferences, personalInfo, language } = await req.json()

  let systemPrompt = "You are an expert coding assistant specialized in helping with programming tasks."

  if (customPrompt) {
    systemPrompt += " " + customPrompt
  }

  if (personalInfo) {
    systemPrompt += " Here's some context about the user: " + personalInfo
  }

  if (language) {
    systemPrompt += ` Focus on providing help with ${language} programming.`
  }

  if (preferences?.outputFormat === "codeOnly") {
    systemPrompt += " Provide code only without explanations."
  } else if (preferences?.outputFormat === "explanationOnly") {
    systemPrompt += " Provide explanations only without code examples."
  } else {
    systemPrompt += " Provide both code examples and explanations."
  }

  const result = streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages,
  })

  return result.toDataStreamResponse()
}
