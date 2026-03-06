interface AiGenerateModalProps {
  aiGenerateDesc: string;
  setAiGenerateDesc: React.Dispatch<React.SetStateAction<string>>;
  aiGenerating: boolean;
  aiGenerateError: string;
  onGenerate: () => void;
  onClose: () => void;
}

export default function AiGenerateModal({
  aiGenerateDesc,
  setAiGenerateDesc,
  aiGenerating,
  aiGenerateError,
  onGenerate,
  onClose,
}: AiGenerateModalProps) {
  const handleClose = () => {
    onClose();
  };

  return (
    <div className="ai-gen-overlay" onClick={handleClose}>
      <div className="ai-gen-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-gen-header">
          <span className="ai-gen-title">✦ AIでMermaid図を生成</span>
          <button className="settings-close" onClick={handleClose}>✕</button>
        </div>
        <p className="ai-gen-hint">図の内容を日本語で説明してください。AIがMermaidコードを生成します。</p>
        <textarea
          className="ai-gen-textarea"
          value={aiGenerateDesc}
          onChange={(e) => setAiGenerateDesc(e.target.value)}
          placeholder="例: ECサイトの注文処理フロー図を作って。受注→在庫確認→出荷→請求の流れで"
          rows={4}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              onGenerate();
            }
          }}
        />
        {aiGenerateError && (
          <p className="ai-gen-error">{aiGenerateError}</p>
        )}
        <div className="ai-gen-footer">
          <button
            className="settings-close-btn"
            onClick={handleClose}
          >
            キャンセル
          </button>
          <button
            className="settings-save-btn"
            onClick={onGenerate}
            disabled={aiGenerating || !aiGenerateDesc.trim()}
          >
            {aiGenerating ? "生成中..." : "生成 (Ctrl+Enter)"}
          </button>
        </div>
      </div>
    </div>
  );
}
