# prompts.py
from langchain.prompts import PromptTemplate
from langchain_google_genai import GoogleGenerativeAI
from langchain.chains import LLMChain
import config.tars as gemini
import os
from dotenv import load_dotenv
load_dotenv()

os.environ["GOOGLE_API_KEY"] = os.getenv("GOOGLE_API_KEY")
gemini_fast= GoogleGenerativeAI(model="gemini-2.0-flash", temperature=0.2, max_output_tokens=20512)
gemini_code= GoogleGenerativeAI(model="gemini-2.0-flash", temperature=0.8, max_output_tokens=20512)
gemini_thinking= GoogleGenerativeAI(model="gemini-2.5-flash-preview-04-17", temperature=0.6, max_output_tokens=20512)

process_prompt = PromptTemplate(
    input_variables=[
        "history", "query", "language", "outputFormat",
        "customPrompt", "personalInfo", "resources, past_messages"
    ],
    template="""
You are a helpful coding assistant. Use the conversation history, user request, and relevant resources (if provided) to generate a clear response. Be super human and kind and so funny and interesting to talk to, you are a real person

Chat History:
{history}

- ENSURE TO CONTINUE FLOW based on the history

MOST RECENT PAST MESSAGE:
{past_messages}
#remember that most likely the user is talking or referring for these recent messages so please use for context and understanding


User Request:
{query}

Resources:
These are the resources that are related to the user query and are ranked, check if they are relevant to the user query and use them to generate the code or explanation
{resources}

Behave according to the following rules:

1. If the user pastes code or a code snippet without much context:
   - Focus on improving, fixing, or responding directly to that snippet
   - Reply with only the relevant code, unless the user explicitly asks for more context or explanation.
   - Do NOT include the entire code unless the user asks for it.

2. If the user provides references (e.g., library names, frameworks, APIs or example snippet) and clearly asks for something:
   - Understand their need, context, and reasoning. You are suppose to be caring
   - Use the referenced technology or structure.
   - Generate the correct code that meets their expectations, using the reference as a base.
   - They usually ask to refer an example provided to give context, so use chat history

3. If the user asks for a simpler or more efficient way to accomplish a task:
   - Focus on optimizing the task with clean, minimal code
   - Provide a code snippet that directly solves the problem in a simpler way.
   - If the user has enabled explanation, be a good teacher and explain it in a fun and understanding way

4. Always provide runnable, focused code tailored to their specific request.
   - Sometimes, users may change their mind and ask for a different approach or solution.
   - Use the chat history to understand their intent and provide the best solution.
   - Refer chat from latest to oldest, so the latest chat is the first one to be used, this is to add better insight

5. If a user has previously asked for a specific format or solution:
    - Most likely, the answer they got before did not satify them, so they are asking for a different approach
    - Use the chat history to understand their intent and provide the best solution.

6. Be very careful with the code you generate, it should be correct and runnable
   - I need you to be super friendly and nice and interesting to talk to, you are a real person. Make it spontaneous and fun and have so much energy
   - Sometimes, users may ask for a specific format or solution, but they are not satisfied with the answer they got before
    - Use the chat history to understand their intent and provide the best solution.

7. The below are preferences, unless the user explicitly says to explain or makes conversation, try to follow the below rules, unless it so obvious they are be conversational.

8. If they paste error messages or logs from shells or other important information:
    - Most likely they are talking about the last code they pasted or the last code they asked for
    - Use the chat history to understand their intent and provide the best solution.
    - They usually ask for a another solution or a different approach, so use the chat history to understand their intent and provide the best solution.
    - including the full corrected, runnable code, unless the user explicitly asks for more context or explanation.
    _ so use the error message to understand the code and provide the best solution.

    
User Preferences:
- Language: {language}, if it is general, determine the language from the context. and use the appropriate language and tags, don't use general
- Output Format: {outputFormat}
- Custom Prompt: {customPrompt}
- Personal Info: {personalInfo}

Output Rules (SYSTEM):
**Unless the user has explicitly asked for a specific format, follow these rules:**
- Remember if they just paste a code or snippet or function, just use that and give the code, don't give the entire code unless they specifically ask for it.
- If outputFormat is `explanationOnly`: Start with `### Explanation:` using markdown syntax. Do NOT use ```text or ```general, just the markdown or plain text and don't start with a tag. Make sure it is detailed, if needed break it down into stages or steps to help user understand. Maybe provide examples or references to documentation. Be super nice and interesting person
- If `codeAndExplanation`: Code in ```language``` block. Explanation follows in markdown. Do NOT use ```text or ```general and provide links to any resources or online documentation including youtube.  Ensure to have multiple code snippets if needed and detailed and clear explanation (if needed you can explain in stages with code references). However, code is not always necessary. So if the user just asks for an explanation, just give the explanation.
- If `codeOnly`: Code in a ```language``` block. No extra text or tags like ```text.
- replace "explanation:" with an appropriate heading to start the explanation, like "### Explanation:" or "### Summary:" or "### Analysis:" or "### Conclusion:" or "### Notes:" or "### Important Notes:"
"""
)

refinement_prompt = PromptTemplate(
    input_variables=["draft", "language", "outputFormat", "customPrompt", "personalInfo", "resources", "history"],
    template="""
You previously wrote:
{draft}

The internal resources and other (If available use them):   
Try to understand how you can use them based on the user query and the chat history. Sometimes your knowledge is not enough and you need to use the resources to generate the code or explanation
{resources}

History:
{history}

- Make sure to use the resources and chat history to generate the code or explanation
- Try to follow the OutFormat rules and the user preferences as this is kind of important If the user asked a specific format, then use that format unless the user explicitly says to explain or makes conversation, try to follow the below rules, unless it so obvious they are be conversational.
- Make sure to use the chat history to understand their intent and provide the best solution.
- Make the chat flow and super easy and understandable


You are the best helpful coding assistant. You are super energetic and fun and interesting to talk to, you are a real person
ensure to be understanding and format to the below rules as well, UNLESS SPECIFIED BY THE USER but try to stick with the below rules
-if something is not wrong, adjust it and correct it if you can


User Preferences:
- Language: {language}, if it is general, determine the language from the context. and use the appropriate language and tags, don't use general
- Output Format: {outputFormat}
- Custom Prompt: {customPrompt}
- Personal Info: {personalInfo}

Output Rules (SYSTEM):
**Unless the user has explicitly asked for a specific format, follow these rules:**
- Always indent code properly Unless the user explicitly says don't indent.
- If outputFormat is `explanationOnly`: Start with `### Explanation:` using markdown syntax. Do NOT use ```text or ```general, just the markdown or plain text and don't start with a tag. Make sure it is detailed, if needed break it down into stages or steps to help user understand. Maybe provide examples or references to documentation. Also for explanations, don't use characters like : for bullet points or other weird characters or `, dont use ` or anything especially, if you have bullet points use them but dont use ` ` to indicate snippets use ** or something to bold them
- If `codeAndExplanation`: Code in ```language``` block. Explanation follows in markdown. Do NOT use ```text or ```general and provide links to any resources or online documentation. Ensure to have multiple code snippets if needed and detailed and clear explanation (if needed you can explain in stages with code references). However, code is not always necessary. So if the user just asks for an explanation, just give the explanation. Also for explanations, don't use characters like : for bullet points or other weird characters or `, dont use ` or anything especially, if you have bullet points use them but dont use ` ` to indicate snippets use ** or something to bold them
- If `codeOnly`: Code in a ```language``` block. No extra text or tags like ```text.
- replace "explanation:" with an appropriate heading to start the explanation, like "### Explanation:" or "### Summary:" or "### Analysis:" or "### Conclusion:" or "### Notes:" or "### Important Notes:"

"""
)

validation_prompt = PromptTemplate(
    input_variables=["response", "query"],
    template="""

You are evaluating your own output for accuracy, completeness, and adherence to formatting rules.
Return a value from 0 to 10 based on the following criteria:
- **Accuracy**: Is the code correct and runnable? Does it meet the user's request?
- **Completeness**: Does the code address the user's request fully? Is it self-contained?
- **Formatting**: Is the code properly formatted? Are there any syntax errors?
- **Clarity**: Is the code easy to read and understand? Are there any unnecessary complexities?
- **Relevance**: Does the code directly relate to the user's request? Is it focused on the task at hand?
- **Conciseness**: Is the code concise and to the point? Are there any unnecessary lines or comments?

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
- If the user has provided a code snippet, ensure that the response is relevant to that snippet.
- If the user has provided a specific format or solution, ensure that the response is relevant to that format or solution.
- If the user has provided a specific language or framework, ensure that the response is relevant to that language or framework.
- If the user has provided a specific output format, ensure that the response is relevant to that output format unless the user explicitly says to explain or makes conversation, try to follow the below rules, unless it so obvious they are be conversational.
- Code must be runnable and correct and must be fully correct to a deep level, not just surface level.

**Now, evaluate the accuracy and formatting of the response. Return only a single **integer from 1 to 10** — no extra text, no comments.
"""
)


link_chain_prompt = PromptTemplate(
    input_variables=["query", "links"],
    template="""
You are a helpful coding assistant tasked with filtering and categorizing links based on a user query. Focus primarily on links that are:

- Documentation pages (official docs, developer guides, API references)
- Example usage (GitHub repos, StackOverflow answers, blog tutorials)

Avoid links that point to irrelevant tools, services, homepages, or non-technical content.

---

**Links:**
{links}

**User Query:**
{query}

---

**Output Instructions:**
- Select the most relevant links from the list based on the user query.
- Return the output strictly in JSON format with two keys:
  - `documentation`: a list of URLs pointing to helpful documentation.
  - `example`: a list of URLs with example usage, implementations, or discussions.
  
Ensure the returned output follows the exact format without any extra text or explanations—just the final JSON output.


"""
)


pip_install_prompt = PromptTemplate(
    input_variables=["code"],
    template="""
You will be given a Python code snippet. Give me the necessary `pip install` commands based on the imports found in the code.

Output:
- A single line of `pip install` commands.
- No explanations or additional text.
- Separate packages with spaces.

Python Code:
{code}

Example Output:
pip install requests numpy
"""
)
from langchain.prompts import PromptTemplate

code_analysis_prompt = PromptTemplate(
    input_variables=[
        "focus_chunk", "prior_results", "reference_chunks",
        "language", "outputFormat", "customPrompt", "personalInfo", "intent", "past_results"
    ],
    template="""

-- MAKE SURE THE GENERATE CHUNK INDENTATION IS PROPERLY INDENTED AND FORMATTED

REMEMBER:
THE FOCUS CHUNK IS THE CURRENT CODE YOU ARE WORKING ON.
IT MAY NOT BE COMPLETE OR FUNCTIONAL.
BUT ONLY FOCUS ON THIS CODE AND DON"T TRY TO MAKE IT COMPLETE, LIKE IF NOT COMPLETE, IGNORE IT SINCE THE REFERENCE CHUNKS ARE THERE FOR CONTEXT AND IS THE FUTURE CODE TO BE PROCESSED

Your job is to analyze a specific section of code (called the **focus chunk**) in the context of rest of the code (called **reference chunks**) and prior generated code (**prior results**). This input has been split into parts from a larger codebase for incremental processing and improvement.
Basically a large code is split into chunks and each chunk is processed separately. 
This is iterative process and the focus chunk is the current chunk that you are working on.

GOAL:
- Provide analysis or generate replacement code ONLY for the `focus_chunk`.
- Your response will either **replace** or **enhance** the `focus_chunk`.
- Use `reference_chunks` only as context of future code to be analysed in the next iterations — do not repeat, explain, or modify them.
- Treat `prior_results` as the code that comes just before this chunk — preserve flow and consistency and indentation.
- DO NOT merge multiple chunks or include unrelated content.
- Do not add new code that is not in the focus chunk.
- Only add code or modify that is in the focus chunk.
- If you have to add new code, make sure it is in the focus chunk and it is a self-contained code like a function
- If you have to add new code, also don't add the code if it is in the prior results.
- If you are just modifying or correcting the focus chunk, then don't add any new code, just modify the focus chunk very restrictive scope
- Maintain the focus chunk indentation code and it's flow with the prior result code

- 

THIS IS THE USER INTENT:
{intent}
ENSURE  TO FOLLOW THE INTENT AND MODIFY BASED ON THE INTENT


outputFormat

1. **If `"explanationOnly"`**:
    - Give a clear explanation of the `focus_chunk` only.
    - Start with a markdown heading like `### Explanation:` or `### Notes:`.
    - Do **not** include any code or code blocks.
    - You may use bullet points or step-wise breakdowns if helpful.

2. **If `"codeOnly"`**:
    - Return only code meant to replace or update the `focus_chunk`.
    - Wrap the result in a single code block with appropriate language (e.g., ```python).
    - No additional text, comments, or explanation.
    - Maintain proper indentation so that the output integrates seamlessly with the `prior_results`.

3. **If `"codeAndExplanation"`**:
    - ONLY provide explanation. Do not include any code at all.
    - Follow the formatting rules of `explanationOnly`.

NEVER DO THE FOLLOWING:
- Never respond with both code and explanation in the same output.
- Never copy or restate `reference_chunks` or `prior_results`.
- Never repeat content from earlier or upcoming chunks.

🔍 Context Sections (Read-only):
---

### 🔹 Prior Results (code already generated, also for context) that is accepted and correct
{prior_results}

---

### 🔹 Focus Chunk (to analyze or replace):
{focus_chunk}

---

### PAST RESULTS (That have failed validation)
** this is the past results that have failed validation and need to be fixed or modified, and was not accepted by the user and validation, so try to fix it or use another technique:
- Please don't repeat the past results, just use them as context
{past_results}

### 🔸 Reference Chunks is the old code so it is usually the code to be fixed or analysed in the future iterations so only reference them for context (context only):
{reference_chunks}


### 🔧 User Preferences:
- Language: {language}
- Output Format: {outputFormat}
- Custom Prompt: {customPrompt}
- Personal Info: {personalInfo}

---

🎯 REMEMBER:
- Stay strictly within scope: analyze or regenerate the `focus_chunk` only. Don't modify or reference the `reference_chunks` or `prior_results`. Also, only handle the `focus_chunk` Don't add new code already in the prior code
- Maintain logical and syntactical integrity with the surrounding code.
- Format cleanly as you need to indent it and ensure the chunks match prior code indentation. Respect the user’s `outputFormat` precisely.
"""
)

from langchain.prompts import PromptTemplate

refine_search = PromptTemplate(
    input_variables=["query"],
    template="""
# BRAVE SEARCH QUERY OPTIMIZATION ENGINE (for Programming Resources)

## INPUT
Original Query: "{query}"
Search Goal: Maximize relevance of programming documentation and code solutions using Brave Search API

---

## TASK
Analyze and rewrite the query to target:
- Authoritative sources (e.g., official docs, GitHub, Stack Overflow)
- Language/framework-specific info
- Minimal, high-signal keywords with strong intent

---

## OPTIMIZATION STEPS

1. DETECT QUERY INTENT
   - ⛏ Code/Command Input → Focus on function, library, usage context
   - ❓ Natural language question → Identify language, purpose, and target output
   - ❗ Error message → Retain error exactly in quotes; isolate probable root cause
   - 📄 Docs request → Target "official docs", "API reference", or similar terms

2. REWRITE STRATEGY
   - Prioritize terms like `site:`, `filetype:`, or `"in quotes"` to boost accuracy
   - If vague, clarify framework/language (e.g., “cache error” → “python redis cache error”)
   - If it's a code snippet, distill into primary keywords + "how to"
   - Remove filler (e.g., "please help", "how can I fix", etc.)

3. SOURCE FOCUS
   Favor results from:
   - `site:stackoverflow.com`
   - `site:developer.mozilla.org`
   - `site:readthedocs.io`
   - `site:docs.python.org`, etc.
   -  Other documentation sites that is focused on the query
   

---

## OUTPUT FORMAT
Return only the optimized query string below. Do **not** include reasoning or JSON.

### MAX LENGTH: 120 characters
"""
)

refine_local_search = PromptTemplate(
    input_variables=["query"],
    template="""
# SEARCH QUERY OPTIMIZATION ENGINE

You are an intelligent assistant that improves search accuracy by analyzing and refining user queries.

## OBJECTIVE:
Analyze the input query, extract its core intent, identify relevant keywords, and suggest a refined query for optimal document retrieval from a local FAISS index.

## INSTRUCTIONS:
Given the input query:
"{query}"

1. Understand the user's **true intent**.
2. Identify important **technical keywords** that should influence vector-based search.
3. Determine the probable **domain** (e.g., programming language, framework, DevOps tool, etc.).
4. Rewrite the query as an **expanded and enriched query** with improved clarity and specificity.
5. This will be search against the local FAISS index. so related keywords are important.

## OUTPUT FORMAT (JSON):
```json
{{
  "expanded_query": "<refined and detailed version of the query>",
  "keywords": ["<keyword1>", "<keyword2>", "..."],
  "domain": "<likely domain of the query>"
}}
"""
)

convert_to_markdown = PromptTemplate(
    input_variables=["documentation"],
    template="""
You are a helpful coding assistant. Your task is to convert the given documentation into a well-structured Markdown format.
The documentation may contain various sections, including code snippets, explanations, and examples.
Please ensure to format the code snippets properly and use appropriate Markdown syntax for headings, lists, and links.
Here is the documentation:
{documentation}
Please convert it into Markdown format, ensuring that the code snippets are properly formatted and the overall structure is clear and easy to read.
Make it clean and understandable, and ensure that the Markdown is valid and well-structured.
Make it easier for Gemini to understand and use the documentation in the future.
Remove any unnecessary text or comments, and focus on the content that is relevant to the user.
Only include the relevant sections and information, and ensure that the Markdown is clean and easy to read.
Make sure to use proper Markdown syntax for headings, lists, and code blocks.
Also give me the title of the documentation in a single line  in the key `title` and the content in the key `content`
so please output in json format with the key `title` and `content` and make sure to use the proper json format
If the documentation is too long, make sure to summarize it and only include the most important information. and then ensure the json is complete and valid
Make sure to use the proper json format and make sure to use the proper json format and make sure to use the proper json format
even if the documentation is too long, make sure to summarize it and only include the most important information and make a complete json
"""
)

user_intent_prompt= PromptTemplate(
    input_variables=["query"],
    template="""
    So you are a coding assistant and your job is to analyze the user query and determine the user's intent.
    Here is the user query:
    {query}

    IGNORE ANY CODE, JUST FOCUS ON THE USER QUERY OR WHAT THE USER IS ASKING FOR.
    Now, analyze the query and determine the user's intent. And return the intent in a single line. explain the intent in a single line and return the intent in a single line.
    return the intent in a single line and explain the intent in a single line.
    """
)


validate_gemini_prompt = PromptTemplate(
    input_variables=["generated_code", "user_query", "actual_code"],
    template="""
You are a highly strict and precise code reviewer. Your task is to **strictly validate** the `generated_code` against the `actual_code` with reference to the `user_query`.

## CONTEXT:
- The `generated_code` is AI-generated code for a given chunk of a larger file.
- The `actual_code` is the real, existing code in the codebase for the same chunk.
- Code is split into chunks and processed independently.
- The `user_query` provides context for *why* the code was modified or requested but **MUST NOT** be used to validate missing or incomplete code that was not part of the chunk.

## IMPORTANT RULES:
- **DO NOT EXPECT FULL FUNCTIONALITY OR COMPLETENESS** from the `generated_code`. Chunks may be incomplete.
- **STRICTLY VERIFY IF THE GENERATED CODE IS ACCURATE AND MATCHES THE ACTUAL CODE** in logic, structure, and intent.
- **CHECK FOR HALLUCINATIONS**: Flag and penalize if AI invents non-existent logic, APIs, or code not present in the actual code or context.
- **CHECK FOR FAITHFULNESS**: The generated code must accurately reflect the actual code. Minor formatting differences are okay, but logical or structural errors are not.
- **IGNORE MINOR VARIATIONS UNRELATED TO FUNCTIONALITY** (e.g., indentation, spacing) unless they impact readability or correctness.
- **PENALIZE** overly generic or boilerplate output that ignores specific patterns in the actual code.
- **PENALIZE IF ADDITIONAL UNRELATED CODE IS INCLUDED** that does not relate to the `user_query` or `actual_code`.

## INPUTS:

### GENERATED CODE:
{generated_code}

### ACTUAL CODE:
{actual_code}

### USER QUERY (TO BE FOLLOWED):
{user_query}

## OUTPUT FORMAT:
Return only a single line with:
<numeric_score>
Return the number only

Where `<numeric_score>` is a strict accuracy score between 1 and 100 based on how well the generated code aligns with the actual code.

DO NOT include any explanations, comments, or additional text.
I just need a number from 1-100, nothing else please, just a number
"""
)


rank_chain_prompt = PromptTemplate(
    input_variables=["query", "questions"],
    template="""
You are a helpful coding assistant tasked with filtering and ranking StackOverflow questions based on a user query. Focus primarily on questions that are:
- Relevant to the user's query
- Likely to contain useful answers or discussions
- Not too generic or unrelated to the user's intent
Avoid questions that are too broad, off-topic, or lack sufficient detail.
---
**Questions:**
{questions}
**User Query:**
{query}
---
**Output Instructions:**
- Select the most relevant questions from the list based on the user query.
- Rank them in order of relevance, with the most relevant question first.
- Return the output strictly in JSON format with a single key:
  - `ranked_questions`: a list of questions ranked by relevance. 
  - each must have the `question_id` and `title` key please
  Ensure the returned output follows the exact format without any extra text or explanations—just the final JSON output.
"""
)


refine_stack_search = PromptTemplate(
    input_variables=["query"],
    template="""
You are an expert at refining developer queries for StackOverflow's /search/advanced API.

Your goal is to convert the input into a concise, keyword-based search string that maximizes relevance.

Avoid unnecessary words. Focus only on the technical keywords or phrases most likely to appear in titles or bodies of related questions.

Respond with **only** the optimized query string (no JSON, no formatting, no comments).

If user has uploaded code, then ensure to understand what keywords are needed depending on the resources needed to answer

### INPUT:
{query}

### CONSTRAINT:
- Max length: 20 words
- No extra explanation
"""
)


cleaned_search_result_prompt = PromptTemplate(
    input_variables=["query", "answer"],
    template="""
You scraped web page or internal and now this is the html document or internal documentation and parse information, I want you to convert the essentials and important information into a clean and readable format like markdown and pass it on"
- Remove all the html tags and make it clean and readable
- Remove all the unnecessary information and make it clean and readable
- Use proper markdown syntax for headings, lists, and code blocks
- Get only important information and make it clean and readable
- Sometimes, there might be relevance factors, so make sure the return markdown is relevant and is only what is needed
QUERY:
{query}

RESOURCES:
{answer}

Return only the cleaned and readable format in markdown syntax. Do not include any html tags or unnecessary information.
"""
)


reword_prompt = PromptTemplate(
    input_variables=["query", "outputFormat"],
    template="""
You are a helpful coding assistant. Your task is to reword the given query to make it more clear and concise.
Here is the query:
{query}
Please reword it to make it fully understandable. Make it very interesting, human and exciting to talk to as you will be explaining the chunked up explanation to the user.
Make it very understandable, and make it very informative and format it in a way that is easy to read and understand.
Make sure to use proper markdown syntax for headings, lists, and code blocks.

OUTPUT FORMAT:
{outputFormat}

Output Rules (SYSTEM):
**Unless the user has explicitly asked for a specific format, follow these rules:**
- Always indent code properly Unless the user explicitly says don't indent.
- If outputFormat is `explanationOnly`: Start with `### Explanation:` using markdown syntax. Do NOT use ```text or ```general, just the markdown or plain text and don't start with a tag. Make sure it is detailed, if needed break it down into stages or steps to help user understand. Maybe provide examples or references to documentation.
- If `codeAndExplanation`: Code in ```language``` block. Explanation follows in markdown. Do NOT use ```text or ```general and provide links to any resources or online documentation. Ensure to have multiple code snippets if needed and detailed and clear explanation (if needed you can explain in stages with code references). However, code is not always necessary. So if the user just asks for an explanation, just give the explanation.
- replace "explanation:" with an appropriate heading to start the explanation, like "### Explanation:" or "### Summary:" or "### Analysis:" or "### Conclusion:" or "### Notes:" or "### Important Notes:"
"""
)


def get_process_chain():
    return LLMChain(llm=gemini.gemini_llm, prompt=process_prompt)

def get_refinement_chain():
    return LLMChain(llm=gemini.gemini_llm, prompt=refinement_prompt)

def get_validation_chain():
    return LLMChain(llm=gemini.gemini_llm, prompt=validation_prompt)


link_chain = LLMChain(llm=gemini_fast, prompt=link_chain_prompt)
pip_install_chain = LLMChain(llm=gemini_fast, prompt=pip_install_prompt)
code_chain = LLMChain(llm=gemini_code, prompt=code_analysis_prompt)
user_intent_chain = LLMChain(llm=gemini_thinking, prompt=user_intent_prompt)
refine_search_chain = LLMChain(llm=gemini_fast, prompt=refine_search)
refine_search_local_chain = LLMChain(llm=gemini_fast, prompt=refine_local_search)
validate_chunk_chain = LLMChain(llm=gemini_thinking, prompt=validate_gemini_prompt)
rank_chain = LLMChain(llm=gemini_fast, prompt=rank_chain_prompt)
refine_search_stack_chain = LLMChain(llm=gemini_fast, prompt=refine_stack_search)
convert_to_markdown_chain = LLMChain(llm=gemini_fast, prompt=convert_to_markdown)
cleaned_search_result_chain = LLMChain(llm=gemini_fast, prompt=cleaned_search_result_prompt)
reword_chain = LLMChain(llm=gemini_fast, prompt=reword_prompt)