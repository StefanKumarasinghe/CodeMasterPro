from utils.invoke_retry import invoke_with_retry
from ai.model_switcher import relevance_chain_ai, summarize_file_chain

async def calculate_file_relevance(filename, content, query, gemini):
    try:
        relevance_chain = relevance_chain_ai(model_type=gemini.modelType, provider_type=gemini.providerName)
        result = await invoke_with_retry(relevance_chain, {
            "filename": filename,
            "file_snippet": content[:5000], 
            "query": query
        })
        
        score = float(result.content.strip())
        return min(max(score, 0), 1)
    except Exception as e:
        gemini.logger.error(f"Error calculating relevance for {filename}: {e}")
        return 0.5

async def summarize_file_content(filename, content, query, gemini):
    try:
        if len(content) < 2000:
            return f"FULL FILE CONTENT: {content}"
        
        summarize_chain = summarize_file_chain(model_type=gemini.modelType, provider_type=gemini.providerName)
        result = await invoke_with_retry(summarize_chain, {
            "filename": filename,
            "file_content": content[:50000],
            "query": query
        })
        
        summary = result.content.strip()
        
        file_ext = filename.split('.')[-1] if '.' in filename else 'unknown'
        file_type_info = get_file_type_description(file_ext)
        
        return f"FILE SUMMARY: {filename} ({file_type_info})\n\n{summary}"
    except Exception as e:
        gemini.logger.error(f"Error summarizing {filename}: {e}")
        return f"FILE CONTENT (first 1000 chars): {content[:1000]}..."

def get_file_type_description(extension):
    ext_map = {
        'py': 'Python source code',
        'js': 'JavaScript source code',
        'ts': 'TypeScript source code',
        'html': 'HTML document',
        'css': 'CSS stylesheet',
        'json': 'JSON data file',
        'md': 'Markdown document',
        'txt': 'Text file',
        'csv': 'CSV data file',
        'xml': 'XML file',
        'yaml': 'YAML configuration file',
        'yml': 'YAML configuration file',
        'sql': 'SQL script',
        'java': 'Java source code',
        'rb': 'Ruby source code',
        'c': 'C source code',
        'cpp': 'C++ source code',
        'h': 'C/C++ header file',
        'go': 'Go source code',
        'rs': 'Rust source code',
        'php': 'PHP source code',
        'sh': 'Shell script',
        'bat': 'Windows batch file',
    }
    return ext_map.get(extension.lower(), f'{extension} file')

def format_context_for_llm(context_data):
    result = [
        "# QUERY ANALYSIS",
        f"User Query: {context_data['query']}",
        "\n# SEARCH RESULTS",
        str(context_data['search_results']),
    ]
    
    if context_data.get("file_error"):
        result.append(f"\n# FILE ERROR\n{context_data['file_error']}")
    
    file_contexts = context_data.get("file_contexts", [])
    if file_contexts:
        result.append("\n# FILE ANALYSIS")
        
        result.append("\n## FILE SUMMARIES")
        for idx, file_ctx in enumerate(file_contexts, 1):
            relevance = f" (Relevance: {file_ctx.get('relevance_score', 'N/A')})" if 'relevance_score' in file_ctx else ""
            result.append(f"\n### {idx}. {file_ctx['filename']}{relevance}")
            result.append(file_ctx['summary'])
        
        result.append("\n## FILE CONTENTS")
        for idx, file_ctx in enumerate(file_contexts, 1):
            truncated_note = " (TRUNCATED)" if file_ctx.get('truncated') else ""
            result.append(f"\n### {idx}. {file_ctx['filename']}{truncated_note}")
            result.append(f"```\n{file_ctx['content']}\n```")
    
    if context_data.get("skipped_files"):
        result.append("\n# SKIPPED FILES")
        result.append("The following files were not included due to size constraints:")
        result.append(", ".join(context_data["skipped_files"]))
    
    result.append("\n# INSTRUCTIONS FOR RESPONSE")
    result.append("""
    When answering the user's query:
    1. Focus on information from the most relevant files and search results
    2. Be specific and reference code or text from the files when applicable
    3. If code examples are needed, ensure they follow the patterns in the relevant files
    4. Clearly indicate if the available context doesn't contain sufficient information to answer the query
    """)
    return "\n".join(result)
