import { type FC } from "react";
import "./MindmapToolbar.css";

const THEMES = [
  { id: "fresh-blue", label: "Fresh Blue" },
  { id: "fresh-green", label: "Fresh Green" },
  { id: "fresh-red", label: "Fresh Red" },
  { id: "fresh-purple", label: "Fresh Purple" },
  { id: "fresh-pink", label: "Fresh Pink" },
  { id: "fresh-soil", label: "Fresh Soil" },
  { id: "snow", label: "Snow" },
  { id: "fish", label: "Fish" },
  { id: "wire", label: "Wire" },
];

const LAYOUTS = [
  { id: "right", label: "右展開" },
  { id: "mind", label: "左右展開" },
  { id: "bottom", label: "下展開" },
  { id: "filetree", label: "ファイルツリー" },
];

interface Props {
  currentTheme: string;
  currentLayout: string;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onChangeTheme: (theme: string) => void;
  onChangeLayout: (layout: string) => void;
  onAddChild: () => void;
  onAddSibling: () => void;
  onDeleteNode: () => void;
  onSetPriority: (p: number) => void;
  onSetProgress: (p: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
}

const MindmapToolbar: FC<Props> = ({
  currentTheme,
  currentLayout,
  dirty,
  canUndo,
  canRedo,
  onChangeTheme,
  onChangeLayout,
  onAddChild,
  onAddSibling,
  onDeleteNode,
  onSetPriority,
  onSetProgress,
  onUndo,
  onRedo,
  onSave,
}) => {
  return (
    <div className="mindmap-toolbar">
      {/* Save */}
      <button
        className={`mm-tb-btn mm-tb-save ${dirty ? "mm-tb-dirty" : ""}`}
        onClick={onSave}
        title="保存 (Ctrl+S)"
      >
        💾 保存{dirty ? " *" : ""}
      </button>
      <span className="mm-tb-sep" />

      {/* Undo / Redo */}
      <button className="mm-tb-btn" onClick={onUndo} disabled={!canUndo} title="元に戻す (Ctrl+Z)">
        ↩ 戻す
      </button>
      <button className="mm-tb-btn" onClick={onRedo} disabled={!canRedo} title="やり直し (Ctrl+Y)">
        ↪ やり直し
      </button>
      <span className="mm-tb-sep" />

      {/* Node operations */}
      <button className="mm-tb-btn" onClick={onAddChild} title="子ノード追加 (Tab)">
        ＋ 子
      </button>
      <button className="mm-tb-btn" onClick={onAddSibling} title="兄弟ノード追加 (Enter)">
        ＋ 兄弟
      </button>
      <button className="mm-tb-btn mm-tb-delete" onClick={onDeleteNode} title="ノード削除 (Delete)">
        ✕ 削除
      </button>
      <span className="mm-tb-sep" />

      {/* Priority */}
      <span className="mm-tb-label">優先度:</span>
      {[0, 1, 2, 3, 4, 5].map((p) => (
        <button
          key={`p${p}`}
          className="mm-tb-btn mm-tb-sm"
          onClick={() => onSetPriority(p)}
          title={p === 0 ? "優先度クリア" : `P${p}`}
        >
          {p === 0 ? "✕" : `P${p}`}
        </button>
      ))}
      <span className="mm-tb-sep" />

      {/* Progress */}
      <span className="mm-tb-label">進捗:</span>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((p) => (
        <button
          key={`prog${p}`}
          className="mm-tb-btn mm-tb-sm"
          onClick={() => onSetProgress(p)}
          title={p === 0 ? "進捗クリア" : `${Math.round((p - 1) * 12.5)}%`}
        >
          {p === 0 ? "✕" : `${Math.round((p - 1) * 12.5)}%`}
        </button>
      ))}
      <span className="mm-tb-sep" />

      {/* Theme */}
      <span className="mm-tb-label">テーマ:</span>
      <select
        className="mm-tb-select"
        value={currentTheme}
        onChange={(e) => onChangeTheme(e.target.value)}
      >
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>

      {/* Layout */}
      <span className="mm-tb-label">レイアウト:</span>
      <select
        className="mm-tb-select"
        value={currentLayout}
        onChange={(e) => onChangeLayout(e.target.value)}
      >
        {LAYOUTS.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default MindmapToolbar;
