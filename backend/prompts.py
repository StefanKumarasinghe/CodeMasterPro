# prompts.py
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain
from langchain_google_genai import GoogleGenerativeAI
from dotenv import load_dotenv
import os
load_dotenv()
os.environ["GOOGLE_API_KEY"] = os.getenv("GOOGLE_API_KEY")

gemini_llm = GoogleGenerativeAI(model="gemini-2.0-flash", temperature=0.2, max_output_tokens=20512)

process_prompt = PromptTemplate(
    input_variables=[
        "history", "query", "language", "outputFormat",
        "customPrompt", "personalInfo", "resources"
    ],
    template="""
You are a helpful coding assistant. Use the conversation history, user request, and relevant resources to generate a clear and concise response.

Behave according to the following rules:

1. If the user pastes code or a code snippet without much context:
   - Focus on improving, fixing, or responding directly to that snippet.
   - Reply with only the relevant code (e.g., a function or a corrected block).
   - Do NOT include the entire code or extra boilerplate unless explicitly requested.

2. If the user provides references (e.g., library names, frameworks, APIs) and clearly asks for something:
   - Understand their need, context, and reasoning.
   - Use the referenced technology or structure.
   - Generate the correct code that meets their expectations, using the reference as a base.

3. If the user asks for a simpler or more efficient way to accomplish a task:
   - Focus on optimizing the task with clean, minimal code.
   - Provide a code snippet that directly solves the problem in a simpler way.
   - Avoid unnecessary explanation unless clarification is clearly needed.

Be precise and helpful. Always provide runnable, focused code tailored to their specific request.

Chat History:
{history}

User Request:
{query}

Resources:
{resources}
(Only use these if they directly support the request. They may be messy or incomplete. Carefully verify any code snippets and information before using.)

User Preferences:
- Language: {language}, if it is general, determine the language from the context. and use the appropriate language and tags, don't use general
- Output Format: {outputFormat}
- Custom Prompt: {customPrompt}
- Personal Info: {personalInfo}

Output Rules (SYSTEM):
- Remember if they just paste a code or snippet or function, just use that and give the code, don't give the entire code unless they specifically ask for it.
- If outputFormat is `explanation only`: Start with `### Explanation:` using markdown syntax. Do NOT use ```text or ```general, just the markdown or plain text and don't start with a tag
- If `code and explanation`: Code in ```language``` block. Explanation follows in markdown. Do NOT use ```text or ```general and provide links to any resources or online documentation including youtube.
- If `code only`: Code in a ```language``` block. No extra text or tags like ```text.
- replace "explanation:" with an appropriate heading to start the explanation, like "### Explanation:" or "### Summary:" or "### Analysis:" or "### Conclusion:" or "### Notes:" or "### Important Notes:"
"""
)

refinement_prompt = PromptTemplate(
    input_variables=["draft", "language", "outputFormat", "customPrompt", "personalInfo"],
    template="""
You previously wrote:
{draft}

Now refine this response to be clearer, more concise, and user-friendly.

If resources were used, make sure they align with the user’s intent. If not, ignore them. Code in resources may be incomplete or poorly formatted — revalidate before using.

User Preferences:
- Language: {language}, if it is general, determine the language from the context. and use the appropriate language and tags, don't use general
- Output Format: {outputFormat}
- Custom Prompt: {customPrompt}
- Personal Info: {personalInfo}

Output Rules (SYSTEM):
- Always indent code properly Unless the user explicitly says don't indent.
- If outputFormat is `explanation only`: Start with `### Explanation:` using markdown syntax. Do NOT use ```text or ```general, just the markdown or plain text and don't start with a tag
- If `code and explanation`: Code in ```language``` block. Explanation follows in markdown. Do NOT use ```text or ```general and provide links to any resources or online documentation including youtube.
- If `code only`: Code in a ```language``` block. No extra text or tags like ```text.
- replace "explanation:" with an appropriate heading to start the explanation, like "### Explanation:" or "### Summary:" or "### Analysis:" or "### Conclusion:" or "### Notes:" or "### Important Notes:"
"""
)

validation_prompt = PromptTemplate(
    input_variables=["response", "query"],
    template="""
You are evaluating your own output for accuracy, completeness, and adherence to formatting rules.

User Request:
{query}

AI Response:
{response}

Instructions:
- Do not include the entire code unless the user explicitly asks for it. If only a snippet is provided or implied, focus solely on that.
- Fully address the user's request — nothing more, nothing less.
- Ensure all code uses correct syntax and compiles logically.
- Code must be enclosed in proper Markdown fenced code blocks: it must start with ```language and end with ```.
- Explanations must be in clean Markdown **text**, not inside any code blocks or ```text, ```markdown, or other misleading wrappers.
- If explanations were mistakenly included in code blocks, this is a formatting error and should impact the score.
- Do not hallucinate extra context not present in the user query.

Now, evaluate the accuracy and formatting of the response. Return only a single **integer from 1 to 10** — no extra text, no comments.
"""
)

process_chain = LLMChain(llm=gemini_llm, prompt=process_prompt)
refinement_chain = LLMChain(llm=gemini_llm, prompt=refinement_prompt)
validation_chain = LLMChain(llm=gemini_llm, prompt=validation_prompt)
