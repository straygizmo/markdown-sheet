import type { FC } from "react";
import type { ImageTool } from "../hooks/useImageCanvas";
import "./ImagePreviewToolbar.css";

interface Props {
  activeTool: ImageTool;
  onToolChange: (tool: ImageTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onSave: () => void;
  onOcr: () => void;
  ocrLoading: boolean;
  onDelete: () => void;
}

const TOOLS: { id: ImageTool; label: string }[] = [
  { id: "select", label: "選択" },
  { id: "text", label: "T テキスト" },
  { id: "rect", label: "□ 矩形" },
  { id: "circle", label: "○ 円" },
  { id: "arrow", label: "→ 矢印" },
  { id: "line", label: "/ 線" },
  { id: "pen", label: "✎ ペン" },
  { id: "ocr", label: "OCR 範囲選択" },
];

const ImagePreviewToolbar: FC<Props> = ({
  activeTool,
  onToolChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onSave,
  onOcr,
  ocrLoading,
  onDelete,
}) => {
  return (
    <div className="image-preview-toolbar">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={`im-tb-btn${activeTool === t.id ? " im-tb-btn--active" : ""}`}
          onClick={() => onToolChange(t.id)}
          title={t.label}
        >
          {t.label}
        </button>
      ))}

      <span className="im-tb-sep" />

      <button className="im-tb-btn" onClick={onZoomOut} title="縮小">
        -
      </button>
      <span className="im-tb-label" onClick={onResetZoom} style={{ cursor: "pointer" }} title="ズームリセット">
        {Math.round(zoomLevel * 100)}%
      </span>
      <button className="im-tb-btn" onClick={onZoomIn} title="拡大">
        +
      </button>

      <span className="im-tb-sep" />

      <button className="im-tb-btn" onClick={onUndo} disabled={!canUndo} title="元に戻す (Ctrl+Z)">
        ↩ 戻す
      </button>
      <button className="im-tb-btn" onClick={onRedo} disabled={!canRedo} title="やり直し (Ctrl+Y)">
        ↪ やり直し
      </button>

      <span className="im-tb-sep" />

      <button className="im-tb-btn" onClick={onDelete} title="選択を削除 (Delete)">
        削除
      </button>

      <span className="im-tb-sep" />

      <button className="im-tb-btn" onClick={onSave} title="画像を保存">
        保存
      </button>
    </div>
  );
};

export default ImagePreviewToolbar;
