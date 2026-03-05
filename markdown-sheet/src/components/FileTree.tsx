import { type FC, useState } from "react";
import type { FileEntry } from "../types";
import "./FileTree.css";

interface Props {
  entries: FileEntry[];
  activeFile: string | null;
  onSelectFile: (path: string) => void;
  onRefresh?: () => void;
  filterDocx: boolean;
  filterXls: boolean;
  filterKm: boolean;
  onToggleDocx: () => void;
  onToggleXls: () => void;
  onToggleKm: () => void;
}

const FileTreeNode: FC<{
  entry: FileEntry;
  activeFile: string | null;
  onSelectFile: (path: string) => void;
  depth: number;
}> = ({ entry, activeFile, onSelectFile, depth }) => {
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
              depth={depth + 1}
            />
          ))}
      </div>
    );
  }

  return (
    <div
      className={`tree-item tree-file ${activeFile === entry.path ? "active" : ""}`}
      style={{ paddingLeft: depth * 16 + 8 }}
      onClick={() => onSelectFile(entry.path)}
    >
      <span className="tree-icon tree-file-icon">·</span>
      <span className="tree-label">{entry.name}</span>
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
  onToggleDocx,
  onToggleXls,
  onToggleKm,
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
        <button
          className={`file-tree-filter-btn ${filterDocx ? "active" : ""}`}
          onClick={onToggleDocx}
          title=".docx 表示切替"
        >
          .docx
        </button>
        <button
          className={`file-tree-filter-btn ${filterXls ? "active" : ""}`}
          onClick={onToggleXls}
          title=".xlsx/.xlsm 表示切替"
        >
          .xls*
        </button>
        <button
          className={`file-tree-filter-btn ${filterKm ? "active" : ""}`}
          onClick={onToggleKm}
          title=".km/.xmind 表示切替"
        >
          .km/.xmind
        </button>
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
              depth={0}
            />
          ))
        )}
      </div>
    </>
  );
};

export default FileTree;
