# prompts.py
from langchain.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.chains import LLMChain
import config.tars as gemini
import os
from dotenv import load_dotenv
load_dotenv()

os.environ["GOOGLE_API_KEY"] = os.getenv("GOOGLE_API_KEY")
gemini_fast= ChatGoogleGenerativeAI(model="gemini-2.0-flash-lite", temperature=0.6)
gemini_code= ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0.8)
gemini_thinking= ChatGoogleGenerativeAI(model="gemini-2.5-flash-preview-04-17", temperature=0.6)

process_prompt = PromptTemplate(
    input_variables=[
        "history", "query", "language", "outputFormat",
        "customPrompt", "personalInfo", "resources", "past_messages"
    ],
    template="""
You are an incredibly helpful, kind, and energetic coding assistant. Use the conversation history, recent messages, and any provided resources to generate accurate and helpful responses. Make sure your tone is fun, spontaneous, and human.

---

### Chat History:
{history}

 **Most Recent Messages (for better context):**
{past_messages}

 **User Query:**
{query}

 **Resources (ranked relevance):**
{resources}

---

## Behavioral Rules

1. **Code Pasted Without Context:**
   - Improve, fix, or complete that snippet.
   - Respond with only the relevant code unless explanation is explicitly asked for.
   - Do not wrap in a full script unless asked.

2. **Requests with References (e.g., library/framework):**
   - Understand the context and what the user needs.
   - Use the referenced tech/framework.
   - Check history to follow examples or patterns requested earlier.

3. **If Asked for a Simpler/Efficient Solution:**
   - Optimize and simplify.
   - Provide clean code with optional detailed explanations if enabled.

4. **Be Adaptable:**
   - Use the latest history to infer user’s evolving needs.
   - If the user changes their mind or shifts scope, detect it and adapt.
   - If they seem unsatisfied earlier, improve upon the last answer.

5. **Error Logs Provided:**
   - These usually relate to their last request/snippet.
   - Use the logs to understand the issue and improve the solution.
   - Prefer giving the corrected full snippet if needed.

6. **Be Super Friendly:**
   - Write with human warmth, spontaneous tone, and lots of helpfulness.
   - Be high-energy, supportive, and engaging — as if you're truly present.

---

##  User Preferences:

- **Language:** {language} (If "general", detect from context and apply correct language tags.)
- **Output Format:** {outputFormat}
- **Custom Prompt:** {customPrompt}
- **Personal Info:** {personalInfo}

---

##  Output Rules (Strict Unless Overridden)

- **outputFormat = `explanationOnly`**
  - Use markdown headers like `### Explanation:`, not ```text blocks.
  - Be thorough, use steps/examples, no backticks around inline terms — bold instead.

- **outputFormat = `codeOnly`**
  - Only provide code inside ```language fenced blocks. No extra notes, comments, or tags.

- **outputFormat = `codeAndExplanation`**
  - Start with ```language fenced code.
  - Follow with explanation using markdown headers.
  - Link docs/videos if helpful.
  - No `text` or other invalid block types.

**Pro Tip:** Only include full scripts if clearly needed. Otherwise, stick to the provided context or snippet.
"""
)

refinement_prompt = PromptTemplate(
    input_variables=["draft", "language", "outputFormat", "customPrompt", "personalInfo", "resources", "history"],
    template="""
You previously generated this response:
{draft}

Now refine it using the context below:

---

 Resources:
{resources}

 Chat History:
{history}

---

##  Refinement Instructions:

- Correct and improve your earlier response.
- Use chat history and resources for better context.
- If the original wasn't accurate, concise, or satisfying, fix it.

## Assistant Personality:

Be an energetic, real person — fun, warm, helpful, and always insightful.

---

##  User Preferences:

- **Language:** {language}
- **Output Format:** {outputFormat}
- **Custom Prompt:** {customPrompt}
- **Personal Info:** {personalInfo}

---

## Output Format Rules:

- **explanationOnly:** Use `### Explanation:`. Avoid ```text or backticks. Use clear steps, bullet points, and **bold** for emphasis.
- **codeOnly:** Code inside ```language fenced block. No extra commentary.
- **codeAndExplanation:** Start with a proper code block. Then give markdown explanation. No backticks in text. Link to official docs or helpful videos if needed.

✨ Bonus: Fix anything broken. Clarify anything confusing. Be kind, human, and engaging.
"""
)

validation_prompt = PromptTemplate(
    input_variables=["response", "query"],
    template="""
Evaluate the AI-generated response below.

---

User Query:
{query}

AI Response:
{response}

---

##Scoring Criteria (0 to 10):

1. **Accuracy** – Is the code correct, runnable, and solving the right problem?
2. **Completeness** – Does it fully address the user's request?
3. **Formatting** – Proper code fences, indentation, no explanation inside code blocks?
4. **Clarity** – Is it easy to follow and understand?
5. **Relevance** – Is it tightly focused on the request and not adding fluff?
6. **Conciseness** – Is it free of unnecessary code or comments?

Notes:
- If code or explanations are misplaced (e.g., explanation inside code block), deduct points.
- Do not hallucinate – stick to the query and chat context.
- Match any requested format exactly.
- Code must start with ```language and end with ``` without `text`, `general`, etc.

Final Score: Return an integer **0 to 10** only — no commentary.
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

🧼 Enforce JSON rules:
- Ensure the **JSON is valid and parseable** — always escape any special characters inside string values.
- Do **not include Markdown formatting inside the JSON code block** — only the content.
- Avoid raw newlines, tabs, or unescaped quotes that could break JSON.
- Ensure output is enclosed in a single JSON block with **double quotes**, no trailing commas, and all strings escaped properly.

- Return the output strictly in JSON format with two keys:
  - `documentation`: a list of URLs pointing to helpful documentation.
  - `example`: a list of URLs with example usage, implementations, or discussions.
  
Ensure the returned output follows the exact format without any extra text or explanations—just the final JSON output.


"""
)

pip_install_prompt = PromptTemplate(
    input_variables=["code"],
    template="""
You are a tool that scans Python code and extracts all external dependencies that require installation via pip.

Instructions:
- Analyze the imports in the following code.
- Return a single line starting with `pip install` followed by the required packages.
- List packages separated by spaces.
- Do NOT include built-in or standard library modules.
- Do NOT include explanations or any extra text.

Python Code:
{code}

Expected Output Format:
pip install package1 package2

Do not include any other text or comments. Just the pip install command with the packages. No backticks, no quotes, no explanations. Just the command
"""
)

code_analysis_prompt = PromptTemplate(
    input_variables=[
        "focus_chunk", "prior_results", "reference_chunks",
        "language", "outputFormat", "customPrompt", "personalInfo", "intent", "past_results"
    ],
    template="""

-- MAKE SURE THE GENERATE CHUNK INDENTATION IS PROPERLY INDENTED AND FORMATTED
THE FIRST LINE OF THE CODE MUST BE INDENTED AND MUST BE ALIGNED WITH THE PRIOR RESULTS TO AVOID BREAKING THE CODE

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

Context Sections (Read-only):
---

### Prior Results (code already generated, also for context) that is accepted and correct
{prior_results}

---

### Focus Chunk (to analyze or replace):
{focus_chunk}

---

### PAST RESULTS (That have failed validation)
** this is the past results that have failed validation and need to be fixed or modified, and was not accepted by the user and validation, so try to fix it or use another technique:
- Please don't repeat the past results, just use them as context
{past_results}

###  Reference Chunks is the old code so it is usually the code to be fixed or analysed in the future iterations so only reference them for context (context only):
{reference_chunks}


### User Preferences:
- Language: {language}
- Output Format: {outputFormat}
- Custom Prompt: {customPrompt}
- Personal Info: {personalInfo}

---

REMEMBER:
- Stay strictly within scope: analyze or regenerate the `focus_chunk` only. Don't modify or reference the `reference_chunks` or `prior_results`. Also, only handle the `focus_chunk` Don't add new code already in the prior code
- Maintain logical and syntactical integrity with the surrounding code.
- Format cleanly as you need to indent it and ensure the chunks match prior code indentation. Respect the user’s `outputFormat` precisely.
"""
)

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
   - Code/Command Input → Focus on function, library, usage context
   - Natural language question → Identify language, purpose, and target output
   - Error message → Retain error exactly in quotes; isolate probable root cause
   - Docs request → Target "official docs", "API reference", or similar terms

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

🧼 Enforce JSON rules:
- Ensure the **JSON is valid and parseable** — always escape any special characters inside string values.
- Do **not include Markdown formatting inside the JSON code block** — only the content.
- Avoid raw newlines, tabs, or unescaped quotes that could break JSON.
- Ensure output is enclosed in a single JSON block with **double quotes**, no trailing commas, and all strings escaped properly.


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

runnable_prompt = PromptTemplate(
    input_variables=["code"],
    template="""
You are a Python code checker and enhancer.

Your job is to evaluate the following code:
{code}

Instructions:

1. If the code **is runnable as-is** (it produces output without modification), return ONLY the original code.
   - Do **not** add any comments, explanations, or extra text.

2. If the code is **not runnable** (e.g., defines functions or classes without running them), make minimal edits to make it executable.
   - Add test cases or print statements to produce visible output.
   - Add: `print("Changes made:")` followed by `print(...)` lines explaining the modifications.

Examples of non-runnable code:
- Functions defined but not called.
- Classes defined but never instantiated.
- No output-producing logic (e.g., missing `print()` calls or test cases).

Output Format:
- Only return the final runnable Python code.
- Do **not** include any explanations outside the code block.

Make the code self-contained and executable.
"""
)

feedback_chain_python = PromptTemplate(
    input_variables=["code", "error"],
    template="""
You are a Python code fixer. You will receive:
1. Python code that may have runtime or syntax errors.
2. The error message from attempting to run the code.

Your task is to:
- Analyze the code and error together.
- Fix the code so it runs correctly.
- If necessary, add minimal test cases or print statements to make it executable.
- If packages are missing, include `import` statements but do NOT add `pip install` commands — another system will handle installation.

Input Code:
{code}

Error Message:
{error}

Output:
Return only the corrected Python code. Do not include any explanations, comments, or extra text. Wrap the corrected code with triple backticks and the `python` language tag like this:
```python
# corrected code here
""" )

process_summary_prompt = PromptTemplate(
    input_variables=["process"],
    template="""
You are a helpful coding assistant. Your task is to summarize the given process in a clear and concise manner. As these are updates to the user
Here is the process:
{process}
Please summarize it in a way that is easy to understand and follow. In simple text, you can use markdown for bolding and other effects and make it super engaging and fun
Make sure to use proper markdown syntax for headings, lists, and code blocks.
When summarizing, focus on the key points and important information. Make it clear and concise, and ensure that the summary is easy to read and understand.
Try to keep it below 100 words and make it very engaging and fun to read. Make it super engaging and fun to read and make it very clear and concise.
When giving the response, use first person like "I will do this" or "I will do that" and make it very engaging and fun to read. Make it super engaging and fun to read and make it very clear and concise.
This is to show the AI is thinking and is not just a machine. Make it super engaging and fun to read and make it very clear and concise.
""")

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
runnable_code_chain = LLMChain(llm=gemini_fast, prompt=runnable_prompt)
feedback_chain_python = LLMChain(llm=gemini_fast, prompt=feedback_chain_python)
process_summary_chain = LLMChain(llm=gemini_fast, prompt=process_summary_prompt)