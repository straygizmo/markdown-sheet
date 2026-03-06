import { type FC, useEffect, useRef, useState } from "react";
import type { RecentFile, RecentFolder } from "../types";
import "./Toolbar.css";

interface Props {
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  theme: "light" | "dark";
  activeViewTab: "preview" | "table";
  editorVisible: boolean;
  terminalVisible: boolean;
  recentFiles: RecentFile[];
  recentFolders: RecentFolder[];
  onOpenFolder: () => void;
  onOpenRecentFolder: (path: string) => void;
  onOpenFile: () => void;
  onOpenRecent: (path: string) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleSearch: () => void;
  onToggleTheme: () => void;
  onPasteFromClipboard: () => void;
  onToggleEditor: () => void;
  onToggleTerminal: () => void;
  onOpenSettings: () => void;
}

const Toolbar: FC<Props> = ({
  dirty,
  canUndo,
  canRedo,
  theme,
  activeViewTab,
  editorVisible,
  terminalVisible,
  recentFiles,
  recentFolders,
  onOpenFolder,
  onOpenRecentFolder,
  onOpenFile,
  onOpenRecent,
  onSave,
  onSaveAs,
  onUndo,
  onRedo,
  onToggleSearch,
  onToggleTheme,
  onPasteFromClipboard,
  onToggleEditor,
  onToggleTerminal,
  onOpenSettings,
}) => {
  const [showRecent, setShowRecent] = useState(false);
  const [showRecentFolders, setShowRecentFolders] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const folderDropdownRef = useRef<HTMLDivElement>(null);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (!showRecent && !showRecentFolders) return;
    const handleClick = (e: MouseEvent) => {
      if (showRecent && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowRecent(false);
      }
      if (showRecentFolders && folderDropdownRef.current && !folderDropdownRef.current.contains(e.target as Node)) {
        setShowRecentFolders(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showRecent, showRecentFolders]);

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        {/* ===== 入力グループ ===== */}
        <span className="toolbar-group-label">入力</span>
        <button onClick={onOpenFolder} title="フォルダを開く">
          <span className="icon">&#128194;</span> 開く
        </button>
        <div className="toolbar-dropdown-wrap" ref={folderDropdownRef}>
          <button
            onClick={() => setShowRecentFolders((v) => !v)}
            title="最近開いたフォルダ"
            className={`folder-history-btn${showRecentFolders ? " active-dropdown" : ""}`}
          >
            &#9660;
          </button>
          {showRecentFolders && (
            <div className="toolbar-dropdown">
              {recentFolders.length === 0 ? (
                <div className="dropdown-empty">履歴なし</div>
              ) : (
                recentFolders.map((f) => (
                  <div
                    key={f.path}
                    className="dropdown-item"
                    title={f.path}
                    onClick={() => {
                      onOpenRecentFolder(f.path);
                      setShowRecentFolders(false);
                    }}
                  >
                    {f.name}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <button onClick={onOpenFile} title="ファイルを開く">
          <span className="icon">&#128196;</span> 開く
        </button>
        {/* 履歴ドロップダウン */}
        <div className="toolbar-dropdown-wrap" ref={dropdownRef}>
          <button
            onClick={() => setShowRecent((v) => !v)}
            title="最近開いたファイル"
            className={`folder-history-btn${showRecent ? " active-dropdown" : ""}`}
          >
            ▼
          </button>
          {showRecent && (
            <div className="toolbar-dropdown">
              {recentFiles.length === 0 ? (
                <div className="dropdown-empty">履歴なし</div>
              ) : (
                recentFiles.map((f) => (
                  <div
                    key={f.path}
                    className="dropdown-item"
                    title={f.path}
                    onClick={() => {
                      onOpenRecent(f.path);
                      setShowRecent(false);
                    }}
                  >
                    {f.name}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <button onClick={onPasteFromClipboard} title="クリップボードのテキストを貼り付け">
          <span className="icon">&#128203;</span>
        </button>

        <div className="toolbar-separator" />

        {/* ===== 保存グループ ===== */}
        <span className="toolbar-group-label">保存</span>
        <button onClick={onSave} title="上書き保存 (Ctrl+S)" disabled={!dirty}>
          <span className="icon">&#128190;</span> 保存
        </button>
        <button onClick={onSaveAs} title="別名で保存">
          💾✏
        </button>

        <div className="toolbar-separator" />

        {/* ===== 編集グループ ===== */}
        <span className="toolbar-group-label">編集</span>
        <button onClick={onUndo} disabled={!canUndo} title="元に戻す (Ctrl+Z)">
          &#8630; 戻す
        </button>
        <button onClick={onRedo} disabled={!canRedo} title="やり直す (Ctrl+Y)">
          &#8631; やり直す
        </button>
        <button onClick={onToggleSearch} title="検索・置換 (Ctrl+F)">
          &#128269; 検索
        </button>

        {activeViewTab === "preview" && (
          <>
            <div className="toolbar-separator" />

            {/* ===== 表示グループ ===== */}
            <span className="toolbar-group-label">表示</span>
            <button
              className={editorVisible ? "toggle-active" : ""}
              onClick={onToggleEditor}
              title={`エディタを${editorVisible ? "非表示" : "表示"} (Ctrl+\\)`}
            >
              ✍🏼 エディタ
            </button>
            <button
              className={terminalVisible ? "toggle-active" : ""}
              onClick={onToggleTerminal}
              title={`ターミナルを${terminalVisible ? "非表示" : "表示"} (Ctrl+\`)`}
            >
              💻 ターミナル
            </button>
          </>
        )}
      </div>
      <div className="toolbar-right">
        <button
          className="settings-btn"
          onClick={onOpenSettings}
          title="設定 (AI API など)"
        >
          ⚙
        </button>
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          title={`${theme === "light" ? "ダーク" : "ライト"}テーマに切替`}
        >
          {theme === "light" ? "\u263E" : "\u2600"}
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
