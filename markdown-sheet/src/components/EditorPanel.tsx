import { useEffect } from "react";
import type { AiSettings } from "../types";
import { MERMAID_TEMPLATES, TRANSFORM_OPTIONS } from "../lib/constants";
import TableGridSelector from "./TableGridSelector";

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
}: EditorPanelProps) {
  const aiEnabled = !!aiSettings.apiKey;

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
      <textarea
        ref={editorRef}
        className="editor-textarea"
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder="Markdownを入力するか、ファイルを開いてください..."
      />
    </div>
  );
}
