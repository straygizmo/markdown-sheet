import { useCallback, useEffect, useRef, useState } from "react";
import type { AiSettings, ZennFrontMatter } from "../types";
import { MERMAID_TEMPLATES, TRANSFORM_OPTIONS } from "../lib/constants";
import { useSpeechToText } from "../hooks/useSpeechToText";
import TableGridSelector from "./TableGridSelector";
import ZennFrontmatterForm from "./ZennFrontmatterForm";

interface EditorPanelProps {
  content: string;
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  editorRatio: number;
  syncScroll: boolean;
  onToggleSyncScroll: () => void;
  onContentChange: (value: string) => void;
  // Format bar
  onInsertFormatting: (format: string) => void;
  onInsertToc: () => void;
  onImportCsv: () => void;
  // Table grid
  showTableGrid: boolean;
  setShowTableGrid: React.Dispatch<React.SetStateAction<boolean>>;
  tableGridBtnRef: React.RefObject<HTMLButtonElement | null>;
  onInsertTable: (rows: number, cols: number) => void;
  // AI bar
  aiSettings: AiSettings;
  showSettings: boolean;
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
  showToast: (message: string, isError?: boolean) => void;
  // AI transform
  aiTransformOpen: boolean;
  setAiTransformOpen: React.Dispatch<React.SetStateAction<boolean>>;
  aiTransformPos: { x: number; y: number } | null;
  setAiTransformPos: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  aiTransforming: boolean;
  savedSelectionRef: React.MutableRefObject<{ start: number; end: number } | null>;
  aiTransformBtnRef: React.RefObject<HTMLButtonElement | null>;
  // AI generate
  setShowAiGenerate: React.Dispatch<React.SetStateAction<boolean>>;
  setAiGenerateError: React.Dispatch<React.SetStateAction<string>>;
  // Templates
  templatePos: { x: number; y: number } | null;
  setTemplatePos: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  templateBtnRef: React.RefObject<HTMLButtonElement | null>;
  // Zenn
  isZennMode?: boolean;
  zennFrontMatter?: ZennFrontMatter | null;
  onZennFrontMatterUpdate?: (fm: ZennFrontMatter) => void;
  // AI instruction (Zenn mode)
  onAiInstruct?: (instruction: string) => void;
  aiInstructing?: boolean;
}

export default function EditorPanel({
  content,
  editorRef,
  editorRatio,
  syncScroll,
  onToggleSyncScroll,
  onContentChange,
  onInsertFormatting,
  onInsertToc,
  onImportCsv,
  showTableGrid,
  setShowTableGrid,
  tableGridBtnRef,
  onInsertTable,
  aiSettings,
  showSettings: _showSettings,
  setShowSettings,
  showToast,
  aiTransformOpen,
  setAiTransformOpen,
  aiTransformPos: _aiTransformPos,
  setAiTransformPos,
  aiTransforming,
  savedSelectionRef,
  aiTransformBtnRef,
  setShowAiGenerate,
  setAiGenerateError,
  templatePos,
  setTemplatePos,
  templateBtnRef,
  isZennMode,
  zennFrontMatter,
  onZennFrontMatterUpdate,
  onAiInstruct,
  aiInstructing,
}: EditorPanelProps) {
  const aiEnabled = !!aiSettings.apiKey;

  // AI instruction textbox state (Zenn mode)
  const [instructionText, setInstructionText] = useState("");
  const instructionRef = useRef<HTMLTextAreaElement>(null);

  const handleInstructSttTranscribed = useCallback((text: string) => {
    setInstructionText((prev) => prev + text);
  }, []);

  const instructStt = useSpeechToText(handleInstructSttTranscribed, showToast);

  const handleSttTranscribed = useCallback((text: string) => {
    const textarea = editorRef.current;
    if (!textarea) return;
    const pos = textarea.selectionStart;
    const before = content.slice(0, pos);
    const after = content.slice(pos);
    onContentChange(before + text + after);
    // Move cursor after inserted text
    requestAnimationFrame(() => {
      const newPos = pos + text.length;
      textarea.selectionStart = newPos;
      textarea.selectionEnd = newPos;
      textarea.focus();
    });
  }, [content, editorRef, onContentChange]);

  const stt = useSpeechToText(handleSttTranscribed, showToast);

  // Ctrl+Space で音声入力の On/Off を切り替え
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey && e.code === "Space") {
        e.preventDefault();
        stt.toggle();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stt.toggle]);

  return (
    <div
      className="editor-panel"
      style={{ flex: `0 0 ${editorRatio}%` }}
    >
      <div className="editor-panel-header">
        <span>Markdown ソース</span>
        <button
          className={`sync-scroll-btn ${syncScroll ? "active" : ""}`}
          onClick={onToggleSyncScroll}
          title={syncScroll ? "スクロール同期: ON (クリックでOFF)" : "スクロール同期: OFF (クリックでON)"}
        >
          ⇅ 同期
        </button>
      </div>
      <div className="format-bar">
        <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); onInsertFormatting("bold"); }} title="太字 (Ctrl+B)"><b>B</b></button>
        <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); onInsertFormatting("italic"); }} title="斜体 (Ctrl+I)"><i>I</i></button>
        <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); onInsertFormatting("strike"); }} title="取り消し線"><s>S</s></button>
        <span className="format-separator" />
        <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); onInsertFormatting("h1"); }} title="見出し1">H1</button>
        <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); onInsertFormatting("h2"); }} title="見出し2">H2</button>
        <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); onInsertFormatting("h3"); }} title="見出し3">H3</button>
        <span className="format-separator" />
        <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); onInsertFormatting("ul"); }} title="箇条書きリスト">• リスト</button>
        <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); onInsertFormatting("ol"); }} title="番号付きリスト">1. リスト</button>
        <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); onInsertFormatting("quote"); }} title="引用">&gt; 引用</button>
        <span className="format-separator" />
        <button className="format-btn format-btn-mono" onMouseDown={(e) => { e.preventDefault(); onInsertFormatting("code"); }} title="コード">`code`</button>
        <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); onInsertFormatting("link"); }} title="リンク">&#128279; リンク</button>
        <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); onInsertFormatting("hr"); }} title="水平線">&#8212; 区切り</button>
        <span className="format-separator" />
        <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); onInsertToc(); }} title="目次を挿入">目次</button>
        <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); onImportCsv(); }} title="CSVをインポートして追加">CSV</button>
        <span className="format-separator" />
        <button ref={tableGridBtnRef} className="format-btn" onMouseDown={(e) => { e.preventDefault(); setShowTableGrid((v) => !v); }} title="表を挿入">&#9638; 表</button>
        {showTableGrid && (
          <TableGridSelector
            anchorRef={tableGridBtnRef}
            onSelect={onInsertTable}
            onClose={() => setShowTableGrid(false)}
          />
        )}
      </div>
      {/* ===== AI ツールバー ===== */}
      <div className={`ai-bar ${aiEnabled ? "ai-bar--on" : "ai-bar--off"}`}>
        <span
          className="ai-bar__chip"
          title={aiEnabled
            ? `AI有効: ${aiSettings.provider} / ${aiSettings.model}`
            : "APIキーが未設定です。右の「⚙ 設定する」から設定してください"}
        >
          {aiEnabled ? "✦ AI" : "⚙ AI"}
        </span>
        <span className="ai-bar__sep" />
        {/* Feature 3: Mermaid テンプレート */}
        <button
          ref={templateBtnRef}
          className="ai-bar__btn"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (templatePos) {
              setTemplatePos(null);
            } else {
              const rect = templateBtnRef.current?.getBoundingClientRect();
              if (rect) setTemplatePos({ x: rect.left, y: rect.bottom + 2 });
            }
          }}
          title="Mermaid図テンプレートを挿入（APIキー不要）"
        >
          図テンプレ ▾
        </button>
        <span className="ai-bar__sep" />
        {/* Feature 2: AI テキスト変換 */}
        <button
          ref={aiTransformBtnRef}
          className={`ai-bar__btn${!aiEnabled ? " ai-bar__btn--inactive" : ""}${aiTransforming ? " ai-bar__btn--busy" : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!aiEnabled) {
              showToast("APIキーが設定されていません。設定を開きます");
              setShowSettings(true);
              return;
            }
            const textarea = editorRef.current;
            if (!textarea) return;
            if (textarea.selectionStart === textarea.selectionEnd) {
              showToast("テキストを選択してからクリックしてください");
              return;
            }
            savedSelectionRef.current = {
              start: textarea.selectionStart,
              end: textarea.selectionEnd,
            };
            if (aiTransformOpen) {
              setAiTransformOpen(false);
              setAiTransformPos(null);
            } else {
              const rect = aiTransformBtnRef.current?.getBoundingClientRect();
              if (rect) setAiTransformPos({ x: rect.left, y: rect.bottom + 2 });
              setAiTransformOpen(true);
            }
          }}
          title={aiEnabled ? "選択テキストをAIで変換（翻訳・要約・校正・箇条書き）" : "⚙ APIキー未設定 — クリックして設定を開く"}
          disabled={aiTransforming}
        >
          {aiTransforming ? "変換中..." : "AI変換"}
        </button>
        {/* Feature 1: AI Mermaid 生成 */}
        <button
          className={`ai-bar__btn${!aiEnabled ? " ai-bar__btn--inactive" : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            if (!aiEnabled) {
              showToast("APIキーが設定されていません。設定を開きます");
              setShowSettings(true);
              return;
            }
            setAiGenerateError("");
            setShowAiGenerate(true);
          }}
          title={aiEnabled ? "AIでMermaid図をゼロから生成" : "⚙ APIキー未設定 — クリックして設定を開く"}
        >
          AI図生成
        </button>
        <span className="ai-bar__sep" />
        {/* 音声入力 (Moonshine - オフライン) */}
        <button
          className={`ai-bar__btn${stt.status === "recording" ? " ai-bar__btn--recording" : ""}${stt.status === "loading" || stt.status === "transcribing" ? " ai-bar__btn--busy" : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            stt.toggle();
          }}
          title={
            stt.status === "idle" ? "音声入力を開始（オフライン・日本語） [Ctrl+Space]" :
            stt.status === "loading" ? "モデル読み込み中..." :
            stt.status === "recording" ? "クリックで音声入力を停止" :
            "文字起こし中..."
          }
          disabled={stt.status === "loading"}
        >
          {stt.status === "recording" ? "⏹ 停止" : stt.status === "loading" ? "読込中..." : stt.status === "transcribing" ? "認識中..." : "🎤 音声"}
        </button>
        {stt.interimText && (
          <span className="ai-bar__stt-interim" title="認識中のテキスト（確定前）">
            {stt.interimText.length > 20 ? stt.interimText.slice(0, 20) + "..." : stt.interimText}
          </span>
        )}
        {!aiEnabled && (
          <button
            className="ai-bar__setup-hint"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowSettings(true);
            }}
            title="設定画面を開いてAPIキーを入力してください"
          >
            ⚙ 設定する →
          </button>
        )}
      </div>
      {isZennMode && onZennFrontMatterUpdate && (
        <ZennFrontmatterForm
          frontMatter={zennFrontMatter ?? null}
          onUpdate={onZennFrontMatterUpdate}
        />
      )}
      <textarea
        ref={editorRef}
        className="editor-textarea"
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder="Markdownを入力するか、ファイルを開いてください..."
      />
      {isZennMode && onAiInstruct && (
        <div className="ai-instruct-bar">
          <textarea
            ref={instructionRef}
            className="ai-instruct-bar__input"
            value={instructionText}
            onChange={(e) => setInstructionText(e.target.value)}
            placeholder="AIへの指示を入力（例：文章を校正して、見出しを追加して...）"
            disabled={aiInstructing}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (instructionText.trim() && !aiInstructing) {
                  onAiInstruct(instructionText.trim());
                  setInstructionText("");
                }
              }
            }}
          />
          <div className="ai-instruct-bar__actions">
            <button
              className={`ai-instruct-bar__mic${instructStt.status === "recording" ? " ai-instruct-bar__mic--recording" : ""}${instructStt.status === "loading" || instructStt.status === "transcribing" ? " ai-instruct-bar__mic--busy" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                instructStt.toggle();
              }}
              title={
                instructStt.status === "idle" ? "音声入力" :
                instructStt.status === "recording" ? "停止" :
                instructStt.status === "loading" ? "読込中..." : "認識中..."
              }
              disabled={instructStt.status === "loading" || aiInstructing}
            >
              {instructStt.status === "recording" ? "⏹" : instructStt.status === "loading" ? "..." : instructStt.status === "transcribing" ? "..." : "🎤"}
            </button>
            <button
              className={`ai-instruct-bar__send${aiInstructing ? " ai-instruct-bar__send--busy" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                if (instructionText.trim() && !aiInstructing) {
                  onAiInstruct(instructionText.trim());
                  setInstructionText("");
                }
              }}
              disabled={!instructionText.trim() || aiInstructing || !aiEnabled}
              title={aiEnabled ? "AIに指示を送信 (Ctrl+Enter)" : "APIキーが未設定です"}
            >
              {aiInstructing ? "処理中..." : "送信"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
