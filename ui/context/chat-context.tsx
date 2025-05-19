"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
  useCallback,
  useMemo,
} from "react";
import type {
  Preferences,
  MemoryState,
  ChatContextType,
  ActiveView,
  Message,
} from "@/types";
import { STORAGE_KEYS, API_ENDPOINT, DEFAULT_PREFERENCES } from "@/config/constants";
import { createPromptFromAction, validateInput } from "@/utils/chat-utils";
import { prepareApiRequest } from "@/utils/api";
import { toast } from "@/utils/toast-util";
import { v4 as uuidv4 } from "uuid";
import { autoSaveCurrentChat } from "@/utils/chat-utils";

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const MAX_PINNED_FILES = 5;
const MAX_PINNED_CHARS = 80000;

export function ChatProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<string>("general");
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [freeModel, setFreeModel] = useState<string>("");
  const [memoryState, setMemoryState] = useState<MemoryState>({
    noComments: false,
    forgetMemory: false,
    rememberMemory: false,
  });
  const [activeView, setActiveView] = useState<ActiveView>("chat");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [personalInfo, setPersonalInfo] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chatId, setChatId] = useState<string>(uuidv4());
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [mcp, setMcp] = useState<string>("auto");
  const [modelType, setModelType] = useState<string>("fast");
  const [providerName, setProviderName] = useState<string>("gemini");
  const [pinnedFiles, setPinnedFiles] = useState<{
    path: string;
    name: string;
    charCount?: number;
  }>([]);

  const isLoading = isProcessing;

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      const savedPrefs = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
      if (savedPrefs) {
        try {
          const parsedPrefs = JSON.parse(savedPrefs);
          setPreferences((prev) => ({
            ...DEFAULT_PREFERENCES,
            ...parsedPrefs,
            codeQuality: {
              ...DEFAULT_PREFERENCES.codeQuality,
              ...(parsedPrefs.codeQuality || {}),
            },
          }));
        } catch (parseError) {
          console.error("Failed to parse preferences:", parseError);
          setPreferences(DEFAULT_PREFERENCES);
        }
      }

      const savedCustomPrompt = localStorage.getItem(
        STORAGE_KEYS.CUSTOM_PROMPT
      );
      if (savedCustomPrompt) setCustomPrompt(savedCustomPrompt);

      const savedPersonalInfo = localStorage.getItem(
        STORAGE_KEYS.PERSONAL_INFO
      );
      if (savedPersonalInfo) setPersonalInfo(savedPersonalInfo);

    } catch (error) {
      console.error("Failed to load preferences:", error);
    }
  }, []);

  useEffect(() => {
    if (!hasMounted) return;
    loadPreferences();
  }, [hasMounted, loadPreferences]);

  useEffect(() => {
    if (preferences.freeModel) {
      setFreeModel(preferences.freeModel);
    }
  }, [preferences.freeModel]);

  useEffect(() => {
    if (messages.length > 0) {
      autoSaveCurrentChat(messages, chatId);
      setLastAutoSave(new Date());
    }
  }, [messages, chatId]);

  const handleMemoryState = useCallback(async () => {
    if (memoryState.forgetMemory) {
      setMessages([]);
      setMemoryState((prev) => ({ ...prev, forgetMemory: false }));
    }

    if (memoryState.rememberMemory) {
      try {
        localStorage.setItem(
          STORAGE_KEYS.PREFERENCES,
          JSON.stringify(preferences)
        );
        if (customPrompt) {
          localStorage.setItem(STORAGE_KEYS.CUSTOM_PROMPT, customPrompt);
        }
        if (personalInfo) {
          localStorage.setItem(STORAGE_KEYS.PERSONAL_INFO, personalInfo);
        }

        setMemoryState((prev) => ({ ...prev, rememberMemory: false }));
        toast.success("All preferences have been saved");
      } catch (error) {
        console.error("Failed to save preferences:", error);
        toast.error("Failed to save preferences. Please try again.");
      }
    }
  }, [memoryState, preferences, customPrompt, personalInfo]);

  useEffect(() => {
    handleMemoryState();
  }, [handleMemoryState]);


  const handleInputChange = useCallback(
    (
      e: React.ChangeEvent<HTMLInputElement> | { target: { value: string } }
    ) => {
      setInput(e.target.value);
    },
    []
  );

  const append = useCallback((message: Omit<Message, "id">) => {
    const newMessage: Message = {
      ...message,
      id: uuidv4(),
    };
    setMessages((prev) => [...prev, newMessage]);
  }, []);

  const reload = useCallback(() => {
    window.dispatchEvent(new CustomEvent("new-chat"));
  }, []);

  const handleLoad = useCallback(async () => {
    try {
      append({
        role: "user",
        content: "Loading chat history...",
      });
    } catch (error) {
      console.error("Failed to load chat history:", error);
      toast.error("Failed to load chat history. Please try again.");
    }
  }, [append]);

  const handleSubmit = useCallback(
    async (messageInput: string) => {
      const validation = validateInput(messageInput);
      if (!validation.isValid) {
        toast.error(validation.message ?? "Please enter a valid message");
        return;
      }
      if (!language) {
        toast.error("Please select a programming language before submitting.");
        return;
      }
      if (!preferences.outputFormat) {
        toast.error("Please select an output format before submitting.");
        return;
      }

      setIsProcessing(true);
      try {
        append({
          role: "user",
          content:
            messageInput.length > 50000
              ? "Large message detected. Using CodeMasterProAnalyst for processing."
              : messageInput,
        });

        const request = prepareApiRequest(
          messageInput,
          language,
          mcp,
          providerName,
          freeModel,
          preferences,
          chatId,
          modelType,
          customPrompt,
          personalInfo,
          pinnedFiles
        );

        const response = await fetch(`${API_ENDPOINT}/process`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          let errorMessage = "An unexpected error occurred.";
          switch (response.status) {
            case 429:
              errorMessage = "Rate limit exceeded. Please try again later.";
              break;
            case 500:
              errorMessage = "Internal server error. Please try again later.";
              break;
            case 503:
              errorMessage = "Service unavailable. Please try again later.";
              break;
            case 400:
              const errorData = await response.json();
              errorMessage = errorData.text || "Bad request. Please try again.";
              break;
          }
          toast.error(errorMessage);
          return;
        }

        const data = await response.json();
        append({
          role: "assistant",
          content: data.result,
          dataImage: data.image_url,
        });

        if (!["context", "github", "quick"].includes(mcp)) {
          setMcp("auto");
        }
      } catch (error: any) {
        toast.error(
          error.message || "Failed to process your message. Please try again."
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [
      append,
      chatId,
      customPrompt,
      freeModel,
      language,
      mcp,
      modelType,
      personalInfo,
      pinnedFiles,
      preferences,
      providerName,
    ]
  );

  const handleCodeAction = useCallback(
    async (
      action: string,
      code: string,
      lang: string = language
    ) => {
      if (!code.trim()) {
        toast.error("Please provide code to perform this action on.");
        return;
      }
      if (code.length > 100000) {
        toast.error("The code is too long. Please provide a shorter snippet.");
        return;
      }

      const prompt = createPromptFromAction(action, code, lang);
      if (!prompt) {
        toast.error("The selected action is not supported.");
        return;
      }

      if (action === "no-comments") {
        setMemoryState((prev) => ({
          ...prev,
          noComments: !prev.noComments,
        }));
        toast.success(
          memoryState.noComments
            ? "Comments will now be included"
            : "Comments will be removed"
        );
        return;
      }

      const actionMap: Record<string, string> = {
        "explain-code": "Explaining the code",
        "debug-code": "Fixing the code",
        "optimize-code": "Optimizing the code",
        "refactor-code": "Refactoring the code",
        "format-code": "Formatting the code",
        "add-comments": "Adding comments to the code",
        "convert-code": "Converting the code",
        "generate-tests": "Generating tests for the code",
        "complete-code": "Completing the code",
        "run-sast": "Run static analysis on the code and provide feedback",
        "no-comments": "Removing comments from the code",
      };

      const userMessage = actionMap[action] || `Performing ${action} on the code`;

      append({
        role: "user",
        content: userMessage,
      });

      setIsProcessing(true);

      try {
        const request = prepareApiRequest(
          prompt,
          language,
          mcp,
          providerName,
          freeModel,
          preferences,
          chatId,
          modelType,
          customPrompt,
          personalInfo,
          pinnedFiles
        );

        const response = await fetch(`${API_ENDPOINT}/process`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          throw new Error("Failed to process code action");
        }

        const data = await response.json();
        append({
          role: "assistant",
          content: data.result,
        });
      } catch (error: any) {
        console.error("Failed to process code action:", error);
        toast.error(
          error.message || "Failed to process your code. Please try again."
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [
      append,
      chatId,
      customPrompt,
      freeModel,
      language,
      mcp,
      memoryState.noComments,
      modelType,
      personalInfo,
      pinnedFiles,
      preferences,
      providerName,
    ]
  );

  const addPinnedFile = useCallback(
    async (path: string, name: string) => {
      if (pinnedFiles.some((file) => file.path === path)) {
        toast.info(`File "${name}" is already in context`);
        return;
      }

      if (pinnedFiles.length >= MAX_PINNED_FILES) {
        toast.warning(`Maximum number of pinned files (${MAX_PINNED_FILES}) reached.`);
        return;
      }

      const normalizedPath =
        path.includes("/") && !path.startsWith("/") ? path : path;

      try {
        const response = await fetch(
          `${API_ENDPOINT}/file_content/?file_path=${encodeURIComponent(
            normalizedPath
          )}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch file content: ${response.statusText}`);
        }

        const data = await response.json();
        const content = data.content;
        const charCount = content ? content.length : 0;

        const totalChars =
          pinnedFiles.reduce((total, file) => total + (file.charCount || 0), 0) +
          charCount;

        if (totalChars > MAX_PINNED_CHARS) {
          toast.warning(
            `Adding this file would exceed the ${MAX_PINNED_CHARS} character limit. Remove some files first.`
          );
          return;
        }

        const newFile = { path: normalizedPath, name, charCount };
        setPinnedFiles((current) => {
          const updated = [...current, newFile];
          return updated;
        });
      } catch (error) {
        console.error("Error fetching file content:", error);
        toast.error(
          `Error adding file: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    [pinnedFiles]
  );

  const removePinnedFile = useCallback((path: string) => {
    setPinnedFiles((prev) => prev.filter((file) => file.path !== path));
  }, []);

  const clearPinnedFiles = useCallback(() => {
    setPinnedFiles([]);
    toast.info("Cleared all context files");
  }, []);

  const getTotalPinnedChars = useCallback(() => {
    return pinnedFiles.reduce((total, file) => total + (file.charCount || 0), 0);
  }, [pinnedFiles]);

  const value = useMemo(
    () => ({
      messages,
      input,
      handleInputChange,
      append,
      reload,
      setMessages,
      isLoading,
      language,
      setLanguage,
      preferences,
      setPreferences,
      memoryState,
      setMemoryState,
      handleSubmit,
      handleLoad,
      handleCodeAction,
      activeView,
      setActiveView,
      customPrompt,
      setCustomPrompt,
      personalInfo,
      setPersonalInfo,
      error,
      chatId,
      setChatId,
      lastAutoSave,
      mcp,
      setMcp,
      modelType,
      setModelType,
      providerName,
      setProviderName,
      freeModel,
      setFreeModel,
      pinnedFiles,
      addPinnedFile,
      removePinnedFile,
      clearPinnedFiles,
      getTotalPinnedChars,
    }),
    [
      messages,
      input,
      handleInputChange,
      append,
      reload,
      setMessages,
      isLoading,
      language,
      setLanguage,
      preferences,
      setPreferences,
      memoryState,
      setMemoryState,
      handleSubmit,
      handleLoad,
      handleCodeAction,
      activeView,
      setActiveView,
      customPrompt,
      setCustomPrompt,
      personalInfo,
      setPersonalInfo,
      error,
      chatId,
      setChatId,
      lastAutoSave,
      mcp,
      setMcp,
      modelType,
      setModelType,
      providerName,
      setProviderName,
      freeModel,
      setFreeModel,
      pinnedFiles,
      addPinnedFile,
      removePinnedFile,
      clearPinnedFiles,
      getTotalPinnedChars,
    ]
  );

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}