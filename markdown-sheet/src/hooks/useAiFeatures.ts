import { useCallback, useRef, useState } from "react";
import type { AiSettings } from "../types";
import { callAI } from "../lib/callAI";
import { MERMAID_GENERATE_PROMPT } from "../lib/constants";

interface UseAiFeaturesParams {
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  contentRef: React.MutableRefObject<string>;
  handleContentChange: (newContent: string) => void;
  showToast: (message: string, isError?: boolean) => void;
}

export function useAiFeatures({
  editorRef,
  contentRef,
  handleContentChange,
  showToast,
}: UseAiFeaturesParams) {
  // --- AI Settings ---
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => {
    const defaults: AiSettings = {
      provider: "deepseek",
      apiKey: "",
      model: "deepseek-chat",
      baseUrl: "https://api.deepseek.com/v1",
      apiFormat: "openai",
    };
    try {
      const saved = JSON.parse(localStorage.getItem("md-ai-settings") || "null");
      return saved ? { ...defaults, ...saved } : defaults;
    } catch {
      return defaults;
    }
  });

  const handleSaveAiSettings = useCallback((s: AiSettings) => {
    setAiSettings(s);
    localStorage.setItem("md-ai-settings", JSON.stringify(s));
  }, []);

  // --- Feature 1: AI Mermaid generation ---
  const [showAiGenerate, setShowAiGenerate] = useState(false);
  const [aiGenerateDesc, setAiGenerateDesc] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGenerateError, setAiGenerateError] = useState("");

  const handleAiGenerateMermaid = useCallback(async () => {
    if (!aiSettings.apiKey) {
      setAiGenerateError("⚙ 設定でAPIキーを入力してください");
      return;
    }
    if (!aiGenerateDesc.trim()) return;
    setAiGenerating(true);
    setAiGenerateError("");
    try {
      let result = await callAI(aiSettings, MERMAID_GENERATE_PROMPT, aiGenerateDesc);
      result = result.replace(/^```(?:mermaid)?\r?\n?/, "").replace(/\r?\n?```$/, "").trim();
      const textarea = editorRef.current;
      const pos = textarea ? textarea.selectionStart : contentRef.current.length;
      const block = "\n\n```mermaid\n" + result + "\n```\n";
      const newContent =
        contentRef.current.substring(0, pos) + block + contentRef.current.substring(pos);
      handleContentChange(newContent);
      setShowAiGenerate(false);
      setAiGenerateDesc("");
    } catch (err) {
      setAiGenerateError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiGenerating(false);
    }
  }, [aiSettings, aiGenerateDesc, handleContentChange, editorRef, contentRef]);

  // --- Feature 2: AI text transform ---
  const [aiTransformOpen, setAiTransformOpen] = useState(false);
  const [aiTransformPos, setAiTransformPos] = useState<{ x: number; y: number } | null>(null);
  const [aiTransforming, setAiTransforming] = useState(false);
  const savedSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const aiTransformBtnRef = useRef<HTMLButtonElement>(null);

  const handleAiTransform = useCallback(
    async (prompt: string) => {
      setAiTransformOpen(false);
      setAiTransformPos(null);
      const sel = savedSelectionRef.current;
      if (!sel || sel.start === sel.end) return;
      if (!aiSettings.apiKey) {
        showToast("⚙ 設定でAPIキーを入力してください", true);
        return;
      }
      const selectedText = contentRef.current.substring(sel.start, sel.end);
      setAiTransforming(true);
      try {
        const result = await callAI(aiSettings, prompt, selectedText);
        const newContent =
          contentRef.current.substring(0, sel.start) +
          result +
          contentRef.current.substring(sel.end);
        handleContentChange(newContent);
        showToast("AIが変換しました");
      } catch (err) {
        showToast(`AI変換失敗: ${err instanceof Error ? err.message : String(err)}`, true);
      } finally {
        setAiTransforming(false);
      }
    },
    [aiSettings, handleContentChange, contentRef, showToast]
  );

  // --- Feature 3: Mermaid templates ---
  const [templatePos, setTemplatePos] = useState<{ x: number; y: number } | null>(null);
  const templateBtnRef = useRef<HTMLButtonElement>(null);

  const handleInsertTemplate = useCallback(
    (code: string) => {
      setTemplatePos(null);
      const textarea = editorRef.current;
      const pos = textarea ? textarea.selectionStart : contentRef.current.length;
      const block = "\n\n```mermaid\n" + code + "\n```\n";
      const newContent =
        contentRef.current.substring(0, pos) + block + contentRef.current.substring(pos);
      handleContentChange(newContent);
      setTimeout(() => {
        textarea?.focus();
        textarea?.setSelectionRange(pos + block.length, pos + block.length);
      }, 0);
    },
    [handleContentChange, editorRef, contentRef]
  );

  // --- Mermaid block update (from preview AI) ---
  const handleUpdateMermaidBlock = useCallback(
    (blockIndex: number, newSource: string) => {
      const regex = /```mermaid\r?\n([\s\S]*?)```/g;
      let idx = 0;
      const newContent = contentRef.current.replace(regex, (match) => {
        if (idx++ === blockIndex) {
          const nl = match.includes("\r\n") ? "\r\n" : "\n";
          return "```mermaid" + nl + newSource.trim() + nl + "```";
        }
        return match;
      });
      handleContentChange(newContent);
    },
    [handleContentChange, contentRef]
  );

  return {
    aiSettings,
    handleSaveAiSettings,
    // Feature 1
    showAiGenerate, setShowAiGenerate,
    aiGenerateDesc, setAiGenerateDesc,
    aiGenerating,
    aiGenerateError, setAiGenerateError,
    handleAiGenerateMermaid,
    // Feature 2
    aiTransformOpen, setAiTransformOpen,
    aiTransformPos, setAiTransformPos,
    aiTransforming,
    savedSelectionRef,
    aiTransformBtnRef,
    handleAiTransform,
    // Feature 3
    templatePos, setTemplatePos,
    templateBtnRef,
    handleInsertTemplate,
    // Mermaid block
    handleUpdateMermaidBlock,
  } as const;
}
