from typing import Literal
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai.chat_models import ChatOpenAI
from langchain_anthropic.chat_models import ChatAnthropic

ProviderType = Literal["gemini", "chatgpt", "claude"]

PROVIDER_DEFAULTS = {
    "gemini": {
        "lite": {"temperature": 0.5, "max_tokens": 100000},
        "super-lite": {"temperature": 0.3, "max_tokens": 100000},
        "fast": {"temperature": 0.6, "max_tokens": 100000},
        "summary": {"temperature": 1.0, "max_tokens": 100000},
        "code": {"temperature": 0.8, "max_tokens": 100000},
        "thinking": {"temperature": 1.0, "max_tokens": 100000},
        "suggest": {"temperature": 0.6, "max_tokens": 100000},
        "pro": {"temperature": 0.7, "max_tokens": 100000},
        "quick-think": {"temperature": 0.9, "max_tokens": 100000},
    },
    "chatgpt": {
        "lite": {"temperature": 0.7, "max_tokens": 4096},
        "super-lite": {"temperature": 0.4, "max_tokens": 4096},
        "fast": {"temperature": 0.7, "max_tokens": 4096},
        "summary": {"temperature": 1.0, "max_tokens": 4096},
        "code": {"temperature": 0.2, "max_tokens": 4096},
        "thinking": {"temperature": 1.0, "max_tokens": 4096},
        "suggest": {"temperature": 0.5, "max_tokens": 4096},
        "pro": {"temperature": 0.7, "max_tokens": 4096},
        "quick-think": {"temperature": 0.85, "max_tokens": 4096},
    },
    "claude": {
        "lite": {"temperature": 0.6, "max_tokens": 8192},
        "super-lite": {"temperature": 0.4, "max_tokens": 8192},
        "fast": {"temperature": 0.7, "max_tokens": 8192},
        "summary": {"temperature": 1.0, "max_tokens": 8192},
        "code": {"temperature": 0.3, "max_tokens": 8192},
        "thinking": {"temperature": 1.0, "max_tokens": 8192},
        "suggest": {"temperature": 0.6, "max_tokens": 8192},
        "pro": {"temperature": 0.5, "max_tokens": 8192},
        "quick-think": {"temperature": 0.8, "max_tokens": 8192},
    }
}

MODEL_NAMES = {
    "gemini": {
        "lite": "gemini-2.0-flash-lite",
        "super-lite": "gemini-2.0-flash-lite",
        "fast": "gemini-2.0-flash",
        "summary": "gemini-2.0-flash-lite",
        "code": "gemini-2.5-flash-preview-04-17",
        "thinking": "gemini-2.5-flash-preview-04-17",
        "suggest": "gemini-2.0-flash-lite",
        "pro": "gemini-2.5-pro-exp-03-25",
        "advanced": "gemini-2.5-flash-preview-04-17",
        "quick-think": "gemini-2.5-flash-preview-04-17",
    },
    "chatgpt": {
        "lite": "gpt-3.5-turbo",
        "super-lite": "gpt-3.5-turbo",
        "fast": "gpt-3.5-turbo",
        "summary": "gpt-3.5-turbo",
        "code": "gpt-4o",
        "thinking": "gpt-4o",
        "suggest": "gpt-3.5-turbo",
        "pro": "gpt-4o",
        "advanced": "gpt-4o",
        "quick-think": "gpt-4o-mini",
    },
    "claude": {
        "lite": "claude-3-haiku-20240307",
        "super-lite": "claude-3-haiku-20240307",
        "fast": "claude-3-haiku-20240307",
        "summary": "claude-3-haiku-20240307",
        "code": "claude-3-sonnet-20240229",
        "thinking": "claude-3-opus-20240229",
        "suggest": "claude-3-haiku-20240307",
        "pro": "claude-3-opus-20240229",
        "quick-think": "claude-3-haiku-20240307",
    }
}

class ModelProvider:
    def __init__(self, provider_type: ProviderType):
        self.provider_type = provider_type

    def get_model(self, model_type: str, **kwargs):
        raise NotImplementedError("Subclasses must implement get_model")

    def get_defaults(self, model_type: str) -> dict:
        return PROVIDER_DEFAULTS.get(self.provider_type, {}).get(model_type, {}).copy()

class GeminiProvider(ModelProvider):
    def __init__(self):
        super().__init__("gemini")

    def get_model(self, model_type: str, **kwargs):
        model_name = MODEL_NAMES["gemini"].get(model_type)
        if not model_name:
            return None
        config = self.get_defaults(model_type)
        config.update(kwargs)
        return ChatGoogleGenerativeAI(model=model_name, **config)

class ChatGPTProvider(ModelProvider):
    def __init__(self):
        super().__init__("chatgpt")

    def get_model(self, model_type: str, **kwargs):
        model_name = MODEL_NAMES["chatgpt"].get(model_type)
        if not model_name:
            return None
        config = self.get_defaults(model_type)
        config.update(kwargs)
        return ChatOpenAI(model_name=model_name, **config)

class ClaudeProvider(ModelProvider):
    def __init__(self):
        super().__init__("claude")

    def get_model(self, model_type: str, **kwargs):
        model_name = MODEL_NAMES["claude"].get(model_type)
        if not model_name:
            return None
        config = self.get_defaults(model_type)
        config.update(kwargs)
        return ChatAnthropic(model=model_name, **config)

class ModelFactory:
    def get_provider(self, provider_type: ProviderType) -> ModelProvider:
        if provider_type == "gemini":
            return GeminiProvider()
        elif provider_type == "chatgpt":
            return ChatGPTProvider()
        elif provider_type == "claude":
            return ClaudeProvider()
        else:
            raise ValueError(f"Unsupported provider type: {provider_type}")

    def get_model(self, provider_type: ProviderType, model_type: str, **kwargs):
        provider = self.get_provider(provider_type)
        return provider.get_model(model_type, **kwargs)
