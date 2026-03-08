import type { FC } from "react";
import type { ImageTool } from "../hooks/useImageCanvas";
import { FONT_FAMILIES, FONT_SIZES } from "../hooks/useImageCanvas";
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
  strokeColor: string;
  onStrokeColorChange: (color: string) => void;
  fillColor: string;
  onFillColorChange: (color: string) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  fontFamily: string;
  onFontFamilyChange: (family: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
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

const PRESET_COLORS = [
  "#ff0000", "#ff6600", "#ffcc00", "#00cc00", "#0066ff",
  "#9933ff", "#ff00ff", "#000000", "#666666", "#ffffff",
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
  strokeColor,
  onStrokeColorChange,
  fillColor,
  onFillColorChange,
  fontSize,
  onFontSizeChange,
  fontFamily,
  onFontFamilyChange,
  strokeWidth,
  onStrokeWidthChange,
}) => {
  const showTextOptions = activeTool === "text";
  const showShapeOptions = ["rect", "circle"].includes(activeTool);
  const showStrokeOptions = ["rect", "circle", "arrow", "line", "pen", "text"].includes(activeTool);

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

      {showStrokeOptions && (
        <>
          <label className="im-tb-color-label" title="線の色">
            <span className="im-tb-color-swatch" style={{ background: strokeColor }} />
            <input
              type="color"
              className="im-tb-color-input"
              value={strokeColor === "transparent" ? "#000000" : strokeColor}
              onChange={(e) => onStrokeColorChange(e.target.value)}
            />
            色
          </label>
          <select
            className="im-tb-select"
            value={strokeWidth}
            onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
            title="線の太さ"
          >
            {[1, 2, 3, 4, 5, 6, 8, 10].map((w) => (
              <option key={w} value={w}>{w}px</option>
            ))}
          </select>
          <div className="im-tb-preset-colors">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className={`im-tb-preset-swatch${strokeColor === c ? " im-tb-preset-swatch--active" : ""}`}
                style={{ background: c }}
                onClick={() => onStrokeColorChange(c)}
                title={c}
              />
            ))}
          </div>
          <span className="im-tb-sep" />
        </>
      )}

      {showShapeOptions && (
        <>
          <label className="im-tb-color-label" title="塗りつぶし">
            <span
              className="im-tb-color-swatch im-tb-color-swatch--fill"
              style={{ background: fillColor === "transparent" ? "transparent" : fillColor }}
            />
            <input
              type="color"
              className="im-tb-color-input"
              value={fillColor === "transparent" ? "#ffffff" : fillColor}
              onChange={(e) => onFillColorChange(e.target.value)}
            />
            塗り
          </label>
          <button
            className={`im-tb-btn im-tb-btn--small${fillColor === "transparent" ? " im-tb-btn--active" : ""}`}
            onClick={() => onFillColorChange("transparent")}
            title="塗りなし"
          >
            なし
          </button>
          <span className="im-tb-sep" />
        </>
      )}

      {showTextOptions && (
        <>
          <select
            className="im-tb-select"
            value={fontFamily}
            onChange={(e) => onFontFamilyChange(e.target.value)}
            title="フォント"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <select
            className="im-tb-select"
            value={fontSize}
            onChange={(e) => onFontSizeChange(Number(e.target.value))}
            title="フォントサイズ"
          >
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>{s}px</option>
            ))}
          </select>
          <span className="im-tb-sep" />
        </>
      )}

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

      <button className="im-tb-btn" onClick={onSave} title="画像を保存">
        保存
      </button>
    </div>
  );
};

export default ImagePreviewToolbar;
