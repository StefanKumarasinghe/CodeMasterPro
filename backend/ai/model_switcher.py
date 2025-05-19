from Model.ModelClass import ModelFactory
from ai.structured_output import ValidationChainOutput, DocumentationChainOutput, RankedQuestionsOutput, LinkCategoriesOutput, RefineLocalSearchOutput
from Prompts.prompts import process_prompt, refinement_prompt, summarize_file_chain_prompt, relevance_chain_prompt, link_chain_prompt, pip_install_prompt, code_analysis_prompt, user_intent_prompt, refine_search, refine_local_search, validate_gemini_prompt, rank_chain_prompt, refine_stack_search, convert_to_markdown, cleaned_search_result_prompt, reword_prompt, runnable_prompt, feedback_chain_python, process_summary_prompt, validation_prompt, user_behavior_prompt, final_code_prompt, reasoning_prompt, tool_prompt, analyse_changes_python_prompt, quick_answer_chain_prompt, analyse_bandit_prompt, analyse_compute_chain_prompt, strategy_prompt, file_format_prompt, memory_analyzer_prompt, github_select_prompt, github_reword_prompt, reference_check_chain_prompt, get_code_completion_prompt, context_chain_prompt, reference_github_check_chain_prompt

model_factory = ModelFactory()

def get_model(provider_name: str, model_type: str):
    provider = model_factory.get_provider(provider_name)
    if not provider:
        raise ValueError(f"Provider '{provider_name}' not found.")
    return provider.get_model(model_type)

def create_dynamic_chain(prompt, model_name, model_type, structured_model=False, model_output=None):
    try:
        model = get_model(model_name, model_type)
        if structured_model:
            model = model.with_structured_output(model_output)
        return prompt | model
    except Exception as e:
        print(f"Error creating chain with {model_name} for {model_type}: {e}")
        return None
    
def reference_github_check_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(reference_github_check_chain_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Reference Github Check Chain Error] Failed to build reference github check chain: {e}")
        return None

def link_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(link_chain_prompt, provider_type,  model_type, True, LinkCategoriesOutput)
    except Exception as e:
        print(f"[Link Chain Error] Failed to build link chain: {e}")
        return None
    
def pip_install_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(pip_install_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Pip Install Chain Error] Failed to build pip install chain: {e}")
        return None

def code_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(code_analysis_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Code Chain Error] Failed to build code chain: {e}")
        return None

def user_intent_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(user_intent_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[User Intent Chain Error] Failed to build user intent chain: {e}")
        return None
    
def refine_search_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(refine_search, provider_type,  model_type)
    except Exception as e:
        print(f"[Refine Search Chain Error] Failed to build refine search chain: {e}")
        return None
    
def refine_search_local_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(refine_local_search, provider_type,  model_type, True, RefineLocalSearchOutput)
    except Exception as e:
        print(f"[Refine Search Local Chain Error] Failed to build refine search local chain: {e}")
        return None
    
def validate_chunk_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(validate_gemini_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Validate Chunk Chain Error] Failed to build validate chunk chain: {e}")
        return None
    
def rank_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(rank_chain_prompt, provider_type,  model_type, True, RankedQuestionsOutput)
    except Exception as e:
        print(f"[Rank Chain Error] Failed to build rank chain: {e}")
        return None
    
def refine_search_stack_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(refine_stack_search, provider_type,  model_type)
    except Exception as e:
        print(f"[Refine Search Stack Chain Error] Failed to build refine search stack chain: {e}")
        return None
    
def convert_to_markdown_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(convert_to_markdown, provider_type,  model_type, True, DocumentationChainOutput)
    except Exception as e:
        print(f"[Convert To Markdown Chain Error] Failed to build convert to markdown chain: {e}")
        return None
    
def cleaned_search_result_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(cleaned_search_result_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Cleaned Search Result Chain Error] Failed to build cleaned search result chain: {e}")
        return None
    
def reword_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(reword_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Reword Chain Error] Failed to build reword chain: {e}")
        return None

def runnable_code_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(runnable_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Runnable Code Chain Error] Failed to build runnable code chain: {e}")
        return None

def feedback_chain_python(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(feedback_chain_python, provider_type,  model_type)
    except Exception as e:
        print(f"[Feedback Chain Python Error] Failed to build feedback chain python: {e}")
        return None

def process_summary_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(process_summary_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Process Summary Chain Error] Failed to build process summary chain: {e}")
        return None     
    
def validation_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(validation_prompt, provider_type,  model_type, True, ValidationChainOutput)
    except Exception as e:
        print(f"[Validation Chain Error] Failed to build validation chain: {e}")
        return None
    
def user_behavior_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(user_behavior_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[User Behavior Chain Error] Failed to build user behavior chain: {e}")
        return None
    
def final_code_prompt_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(final_code_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Final Code Prompt Chain Error] Failed to build final code prompt chain: {e}")
        return None
    
def reasoning_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(reasoning_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Reasoning Chain Error] Failed to build reasoning chain: {e}")
        return None
    
def tool_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(tool_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Tool Chain Error] Failed to build tool chain: {e}")
        return None
    
def analyse_changes_python_chain(model_type: str, provider_type: str):  
    try:
        return create_dynamic_chain(analyse_changes_python_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Analyse Changes Python Chain Error] Failed to build analyse changes python chain: {e}")
        return None
    
def quick_answer_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(quick_answer_chain_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Quick Answer Chain Error] Failed to build quick answer chain: {e}")
        return None
    
def analyse_bandit_chain(model_type: str, provider_type: str):  
    try:
        return create_dynamic_chain(analyse_bandit_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Analyse Bandit Chain Error] Failed to build analyse bandit chain: {e}")
        return None
    
def analyse_compute_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(analyse_compute_chain_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Analyse Compute Chain Error] Failed to build analyse compute chain: {e}")
        return None
    
    
def strategy_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(strategy_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Strategy Chain Error] Failed to build strategy chain: {e}")
        return None

def file_index_chain(model_type: str, provider_type: str):  
    try:
        return create_dynamic_chain(file_format_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[File Index Chain Error] Failed to build file index chain: {e}")
        return None
    
def memory_analyzer_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(memory_analyzer_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Memory Analyzer Chain Error] Failed to build memory analyzer chain: {e}")
        return None
    
def github_select_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(github_select_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Github Select Chain Error] Failed to build github select chain: {e}")
        return None
    
def github_reword_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(github_reword_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Github Reword Chain Error] Failed to build github reword chain: {e}")
        return None
    
def reference_check_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(reference_check_chain_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Reference Check Chain Error] Failed to build reference check chain: {e}")
        return None
    
def autocomplete_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(get_code_completion_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Autocomplete Chain Error] Failed to build autocomplete chain: {e}")
        return None
    
def choose_file_name_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(context_chain_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Choose File Name Chain Error] Failed to build choose file name chain: {e}")
        return None

def get_process_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(process_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Process Chain Error] Failed to build process chain: {e}")
        return None

def get_refinement_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(refinement_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Refinement Chain Error] Failed to build refinement chain: {e}")
        return None
    
def relevance_chain_ai(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(relevance_chain_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Relevance Chain Error] Failed to build relevance chain: {e}")
        return None
    
def summarize_file_chain(model_type: str, provider_type: str):
    try:
        return create_dynamic_chain(summarize_file_chain_prompt, provider_type,  model_type)
    except Exception as e:
        print(f"[Summarize File Chain Error] Failed to build summarize file chain: {e}")
        return None



