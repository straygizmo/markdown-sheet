import { type FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import type { RagMessage } from "../hooks/useRagFeatures";
import "./RagPanel.css";

marked.setOptions({ breaks: true });

interface Props {
  folderPath: string | null;
  embeddingStatus: "idle" | "loading" | "ready" | "error";
  embeddingProgress: number;
  embeddingError: string | null;
  indexStatus: "none" | "building" | "ready";
  indexInfo: { indexed: boolean; chunk_count: number; file_count: number } | null;
  indexProgress: string;
  messages: RagMessage[];
  querying: boolean;
  onBuildIndex: (folderPath: string) => void;
  onDeleteIndex: (folderPath: string) => void;
  onAskQuestion: (folderPath: string, question: string) => void;
  onClearMessages: () => void;
  onLoadModel: () => void;
  onOpenFile: (filePath: string, line?: number) => void;
}

const RagPanel: FC<Props> = ({
  folderPath,
  embeddingStatus,
  embeddingProgress,
  embeddingError,
  indexStatus,
  indexInfo,
  indexProgress,
  messages,
  querying,
  onBuildIndex,
  onDeleteIndex,
  onAskQuestion,
  onClearMessages,
  onLoadModel,
  onOpenFile,
}) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = useCallback(() => {
    const q = input.trim();
    if (!q || !folderPath || querying) return;
    setInput("");
    onAskQuestion(folderPath, q);
  }, [input, folderPath, querying, onAskQuestion]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const shortPath = (fp: string) => {
    if (!folderPath) return fp;
    const rel = fp.startsWith(folderPath)
      ? fp.slice(folderPath.length).replace(/^[\\/]/, "")
      : fp.split(/[\\/]/).pop() || fp;
    return rel;
  };

  if (!folderPath) {
    return (
      <div className="rag-panel-empty">
        フォルダを開くとRAG検索が使えます
      </div>
    );
  }

  return (
    <div className="rag-panel-content">
      {/* Header / Status */}
      <div className="rag-status-bar">
        <div className="rag-status-left">
          {indexStatus === "ready" && indexInfo && (
            <span className="rag-badge rag-badge-ready">
              {indexInfo.file_count}ファイル / {indexInfo.chunk_count}チャンク
            </span>
          )}
          {indexStatus === "building" && (
            <span className="rag-badge rag-badge-building">
              {indexProgress || "構築中..."}
            </span>
          )}
          {indexStatus === "none" && (
            <span className="rag-badge rag-badge-none">未構築</span>
          )}
          {embeddingStatus === "loading" && (
            <span className="rag-badge rag-badge-building">
              モデル {embeddingProgress}%
            </span>
          )}
        </div>
        <div className="rag-status-actions">
          <button
            className="rag-action-btn"
            onClick={() => onBuildIndex(folderPath)}
            disabled={indexStatus === "building"}
            title={indexStatus === "ready" ? "再構築" : "インデックス構築"}
          >
            {indexStatus === "ready" ? "再構築" : "構築"}
          </button>
          {indexStatus === "ready" && (
            <>
              <button
                className="rag-action-btn"
                onClick={onClearMessages}
                title="会話をクリア"
              >
                クリア
              </button>
              <button
                className="rag-action-btn rag-action-danger"
                onClick={() => onDeleteIndex(folderPath)}
                title="インデックスを削除"
              >
                削除
              </button>
            </>
          )}
        </div>
      </div>

      {embeddingError && (
        <div className="rag-error">{embeddingError}</div>
      )}

      {/* Messages */}
      <div className="rag-messages">
        {messages.length === 0 && indexStatus === "ready" && (
          <div className="rag-welcome">
            フォルダ内のドキュメントについて質問できます
          </div>
        )}
        {messages.length === 0 && indexStatus === "none" && (
          <div className="rag-welcome">
            「構築」ボタンでインデックスを作成してください
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`rag-msg rag-msg-${msg.role}`}>
            <div
              className="rag-msg-content"
              dangerouslySetInnerHTML={{
                __html: msg.role === "assistant" ? (marked.parse(msg.content) as string) : msg.content,
              }}
            />
            {msg.sources && msg.sources.length > 0 && (
              <div className="rag-sources">
                <div className="rag-sources-label">参照元:</div>
                {msg.sources.map((s, j) => (
                  <button
                    key={j}
                    className="rag-source-link"
                    onClick={() => onOpenFile(s.file_path, s.start_line)}
                    title={`${s.file_path}:${s.start_line + 1}`}
                  >
                    {shortPath(s.file_path)}
                    {s.heading ? ` - ${s.heading}` : ""}
                    <span className="rag-source-score">
                      {(s.score * 100).toFixed(0)}%
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {querying && (
          <div className="rag-msg rag-msg-assistant rag-msg-loading">
            <span className="rag-loading-dots">考え中...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="rag-input-area">
        <textarea
          ref={inputRef}
          className="rag-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            indexStatus === "ready"
              ? "質問を入力... (Enter で送信)"
              : "インデックスを構築してください"
          }
          disabled={indexStatus !== "ready" || querying}
          rows={2}
        />
        <button
          className="rag-send-btn"
          onClick={handleSubmit}
          disabled={!input.trim() || indexStatus !== "ready" || querying}
        >
          送信
        </button>
      </div>
    </div>
  );
};

export default RagPanel;
