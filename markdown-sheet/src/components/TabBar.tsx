import { type FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Tab } from "../types";
import "./ContextMenu.css";
import "./TabBar.css";

interface Props {
  tabs: Tab[];
  activeTabId: string;
  activeFolderPath: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onSelectFolder: (folder: string) => void;
  onCloseFolder: (folder: string) => void;
  onOpenFolderInExplorer: (folder: string) => void;
  onBatchConvertDocx: (folder: string) => void;
}

function getFolderDisplayName(folderPath: string): string {
  if (!folderPath) return "新規";
  return folderPath.split(/[\\/]/).pop() ?? folderPath;
}

const TabBar: FC<Props> = ({
  tabs,
  activeTabId,
  activeFolderPath,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onSelectFolder,
  onCloseFolder,
  onOpenFolderInExplorer,
  onBatchConvertDocx,
}) => {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; folder: string } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  const closeCtx = useCallback(() => setCtxMenu(null), []);

  useEffect(() => {
    if (!ctxMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) closeCtx();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeCtx(); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [ctxMenu, closeCtx]);
  // フォルダごとにタブをグループ化（出現順を保持）
  const folderOrder = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const tab of tabs) {
      if (!seen.has(tab.folderPath)) {
        seen.add(tab.folderPath);
        order.push(tab.folderPath);
      }
    }
    return order;
  }, [tabs]);

  // アクティブフォルダ内のタブのみ表示
  const activeFolderTabs = useMemo(
    () => tabs.filter((t) => t.folderPath === activeFolderPath),
    [tabs, activeFolderPath]
  );

  // フォルダ内に未保存タブがあるかチェック
  const folderHasDirty = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const tab of tabs) {
      if (tab.dirty) map[tab.folderPath] = true;
    }
    return map;
  }, [tabs]);

  return (
    <div className="tab-bar-container">
      {/* フォルダタブ（上段） */}
      <div className="folder-tab-bar">
        {folderOrder.map((folder) => {
          const isActive = folder === activeFolderPath;
          const folderName = getFolderDisplayName(folder);
          return (
            <div
              key={folder}
              className={`folder-tab-item ${isActive ? "active" : ""}`}
              onClick={() => onSelectFolder(folder)}
              onDoubleClick={() => { if (folder) onOpenFolderInExplorer(folder); }}
              onContextMenu={(e) => {
                if (!folder) return;
                e.preventDefault();
                setCtxMenu({ x: e.clientX, y: e.clientY, folder });
              }}
              title={folder || "保存されていない新規ファイル"}
            >
              <span className="folder-tab-label">
                📁 {folderName}
                {folderHasDirty[folder] ? " *" : ""}
              </span>
              <button
                type="button"
                className="folder-tab-close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onCloseFolder(folder);
                }}
                title="フォルダ内の全タブを閉じる"
                disabled={folderOrder.length <= 1}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* ファイルタブ（下段） */}
      <div className="file-tab-bar">
        {activeFolderTabs.map((tab) => {
          const name = tab.filePath
            ? tab.filePath.split(/[\\/]/).pop() ?? "無題"
            : "無題";
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`tab-item ${isActive ? "active" : ""}`}
              onClick={() => onSelectTab(tab.id)}
              title={tab.filePath ?? "保存されていない新規ファイル"}
            >
              <span className="tab-label">
                {name.endsWith(".md") ? "📄 " : name.endsWith(".docx") ? "📘 " : name.match(/\.xls.?$/) ? "📗 " : name.endsWith(".km") ? "💡 " : name.endsWith(".xmind") ? "📕 " : ""}{name}
                {tab.dirty ? " *" : ""}
              </span>
              <button
                type="button"
                className="tab-close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (tab.dirty) {
                    if (!window.confirm(`"${name}" の変更は保存されていません。閉じますか？`)) return;
                  }
                  onCloseTab(tab.id);
                }}
                title="タブを閉じる"
                disabled={tabs.length <= 1}
              >
                ×
              </button>
            </div>
          );
        })}
        <button className="tab-new-btn" onClick={onNewTab} title="新しいタブ">
          +
        </button>
      </div>

      {ctxMenu && (
        <div
          ref={ctxRef}
          className="context-menu"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          <div className="ctx-group">
            <button
              type="button"
              onClick={() => { onOpenFolderInExplorer(ctxMenu.folder); closeCtx(); }}
            >
              <span className="ctx-label">エクスプローラーで開く</span>
            </button>
            <button
              type="button"
              onClick={() => { onBatchConvertDocx(ctxMenu.folder); closeCtx(); }}
            >
              <span className="ctx-label">.docx → .md 一括変換</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TabBar;
