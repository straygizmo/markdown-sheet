import { type FC, useState } from "react";
import type { FileEntry, ZennArticleMeta } from "../types";
import "./FileTree.css";

interface Props {
  entries: FileEntry[];
  activeFile: string | null;
  onSelectFile: (path: string) => void;
  onRefresh?: () => void;
  filterDocx: boolean;
  filterXls: boolean;
  filterKm: boolean;
  filterImages: boolean;
  onToggleDocx: () => void;
  onToggleXls: () => void;
  onToggleKm: () => void;
  onToggleImages: () => void;
  showDocxBtn?: boolean;
  showXlsBtn?: boolean;
  showKmBtn?: boolean;
  showImagesBtn?: boolean;
  onImageDragStart?: (path: string) => void;
  isZennMode?: boolean;
  zennArticlesMeta?: Record<string, ZennArticleMeta>;
}

function getFileIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".md")) return "📄 ";
  if (lower.endsWith(".docx")) return "📘 ";
  if (lower.match(/\.xls.?$/)) return "📗 ";
  if (lower.endsWith(".km")) return "💡 ";
  if (lower.endsWith(".xmind")) return "📕 ";
  if (lower.match(/\.(png|jpe?g|gif|bmp|svg|webp)$/)) return "🖼️ ";
  return "";
}

const FileTreeNode: FC<{
  entry: FileEntry;
  activeFile: string | null;
  onSelectFile: (path: string) => void;
  onImageDragStart?: (path: string) => void;
  depth: number;
  isZennMode?: boolean;
  zennArticlesMeta?: Record<string, ZennArticleMeta>;
}> = ({ entry, activeFile, onSelectFile, onImageDragStart, depth, isZennMode, zennArticlesMeta }) => {
  const [expanded, setExpanded] = useState(true);

  if (entry.is_dir) {
    return (
      <div className="tree-node">
        <div
          className="tree-item tree-dir"
          style={{ paddingLeft: depth * 16 + 8 }}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="tree-icon tree-dir-icon">{expanded ? "▼" : "▶"}</span>
          <span className="tree-dir-label">{entry.name}</span>
        </div>
        {expanded &&
          entry.children?.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              activeFile={activeFile}
              onSelectFile={onSelectFile}
              onImageDragStart={onImageDragStart}
              depth={depth + 1}
              isZennMode={isZennMode}
              zennArticlesMeta={zennArticlesMeta}
            />
          ))}
      </div>
    );
  }

  const isImage = !!entry.name.toLowerCase().match(/\.(png|jpe?g|gif|bmp|svg|webp)$/);

  return (
    <div
      className={`tree-item tree-file ${activeFile === entry.path ? "active" : ""}`}
      style={{ paddingLeft: depth * 16 + 8 }}
      onClick={() => onSelectFile(entry.path)}
      onMouseDown={isImage && onImageDragStart ? (e) => {
        if (e.button === 0) {
          e.preventDefault();
          onImageDragStart(entry.path);
        }
      } : undefined}
    >
      <span className="tree-icon tree-file-icon">{getFileIcon(entry.name) || "·"}</span>
      {isZennMode && zennArticlesMeta?.[entry.path] ? (
        <span className="tree-label" title={entry.name}>
          <span className="zenn-file-emoji">{zennArticlesMeta[entry.path].emoji}</span>
          {" "}
          {zennArticlesMeta[entry.path].title || entry.name}
          {zennArticlesMeta[entry.path].published
            ? <span className="zenn-published-icon" title="公開中"> ✅</span>
            : <span className="zenn-draft-icon" title="下書き"> 📝</span>}
        </span>
      ) : (
        <span className="tree-label">{entry.name}</span>
      )}
    </div>
  );
};

const FileTree: FC<Props> = ({
  entries,
  activeFile,
  onSelectFile,
  onRefresh,
  filterDocx,
  filterXls,
  filterKm,
  filterImages,
  onToggleDocx,
  onToggleXls,
  onToggleKm,
  onToggleImages,
  showDocxBtn = true,
  showXlsBtn = true,
  showKmBtn = true,
  showImagesBtn = false,
  onImageDragStart,
  isZennMode = false,
  zennArticlesMeta,
}) => {
  return (
    <>
      <div className="file-tree-toolbar">
        <button
          className="file-tree-toolbar-btn"
          onClick={onRefresh}
          title="ツリーを再読込"
        >
          ↻
        </button>
        <div className="file-tree-toolbar-sep" />
        <button
          className="file-tree-filter-btn active"
          disabled
          title=".md (常に表示)"
        >
          .md
        </button>
        {showImagesBtn && (
          <button
            className={`file-tree-filter-btn ${filterImages ? "active" : ""}`}
            onClick={onToggleImages}
            title="画像ファイル 表示切替"
          >
            🖼️
          </button>
        )}
        {showDocxBtn && (
          <button
            className={`file-tree-filter-btn ${filterDocx ? "active" : ""}`}
            onClick={onToggleDocx}
            title=".docx 表示切替"
          >
            .docx
          </button>
        )}
        {showXlsBtn && (
          <button
            className={`file-tree-filter-btn ${filterXls ? "active" : ""}`}
            onClick={onToggleXls}
            title=".xlsx/.xlsm 表示切替"
          >
            .xls*
          </button>
        )}
        {showKmBtn && (
          <button
            className={`file-tree-filter-btn ${filterKm ? "active" : ""}`}
            onClick={onToggleKm}
            title=".km/.xmind 表示切替"
          >
            .km/.xmind
          </button>
        )}
      </div>
      <div className="file-tree">
        {entries.length === 0 ? (
          <div className="tree-empty">フォルダを開いてください</div>
        ) : (
          entries.map((entry) => (
            <FileTreeNode
              key={entry.path}
              entry={entry}
              activeFile={activeFile}
              onSelectFile={onSelectFile}
              onImageDragStart={onImageDragStart}
              depth={0}
              isZennMode={isZennMode}
              zennArticlesMeta={zennArticlesMeta}
            />
          ))
        )}
      </div>
    </>
  );
};

export default FileTree;
