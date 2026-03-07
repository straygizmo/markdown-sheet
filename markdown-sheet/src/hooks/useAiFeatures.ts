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

  // --- Feature 4: AI instruction (Zenn mode) ---
  const [aiInstructing, setAiInstructing] = useState(false);

  const handleAiInstruct = useCallback(
    async (instruction: string) => {
      if (!aiSettings.apiKey) {
        showToast("APIキーが設定されていません", true);
        return;
      }
      if (!instruction.trim()) return;
      setAiInstructing(true);
      try {
        const systemPrompt =
          "あなたはZenn (zenn.dev) 記事のMarkdown編集アシスタントです。ユーザーの指示に従って、与えられたMarkdown本文を編集・加筆・修正してください。\n" +
          "結果はMarkdown本文のみを返してください。説明やコードブロック囲みは不要です。\n\n" +
          "## Zenn記事のルール\n" +
          "- フロントマター(---で囲まれたYAML部分)は必須です。必ずそのまま残してください。指示がある場合のみ編集してください。\n" +
          "  フロントマターの形式:\n" +
          "  ---\n" +
          "  title: \"記事タイトル\"\n" +
          "  emoji: \"🚀\"\n" +
          "  type: \"tech\"  # tech or idea\n" +
          "  topics: [\"python\", \"automation\"]\n" +
          "  published: true  # false = 下書き\n" +
          "  ---\n\n" +
          "## Zenn独自の記法（積極的に活用してください）\n" +
          "- メッセージボックス: :::message ... ::: または :::message alert ... :::\n" +
          "- アコーディオン: :::details タイトル ... :::\n" +
          "- コードブロックにファイル名: ```python:main.py\n" +
          "- diffハイライト: ```diff python\n" +
          "- 数式(KaTeX): $ E = mc^2 $\n" +
          "- Mermaid図: ```mermaid ... ```\n" +
          "- リンクカード: URLを単独の行に置くだけで自動展開\n" +
          "- 画像サイズ指定: ![alt](url =250x) — =〇〇x でpx幅指定\n";
        const result = await callAI(aiSettings, systemPrompt, `## 指示\n${instruction}\n\n## 現在の本文\n${contentRef.current}`);
        handleContentChange(result);
        showToast("AIが記事を更新しました");
      } catch (err) {
        showToast(`AI指示失敗: ${err instanceof Error ? err.message : String(err)}`, true);
      } finally {
        setAiInstructing(false);
      }
    },
    [aiSettings, handleContentChange, contentRef, showToast]
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
    // Feature 4
    aiInstructing,
    handleAiInstruct,
    // Mermaid block
    handleUpdateMermaidBlock,
  } as const;
}
