import type { FileEntry } from "../types";
import FileTree from "./FileTree";
import OutlinePanel from "./OutlinePanel";

interface LeftPanelProps {
  leftPanel: "folder" | "outline";
  setLeftPanel: React.Dispatch<React.SetStateAction<"folder" | "outline">>;
  // FileTree
  fileTree: FileEntry[];
  activeFile: string | null;
  onSelectFile: (filePath: string) => void;
  onRefresh: () => void;
  filterDocx: boolean;
  filterXls: boolean;
  filterKm: boolean;
  onToggleDocx: () => void;
  onToggleXls: () => void;
  onToggleKm: () => void;
  showDocxBtn: boolean;
  showXlsBtn: boolean;
  showKmBtn: boolean;
  // OutlinePanel
  content: string;
  onHeadingClick: (headingId: string) => void;
}

export default function LeftPanel({
  leftPanel,
  setLeftPanel,
  fileTree,
  activeFile,
  onSelectFile,
  onRefresh,
  filterDocx,
  filterXls,
  filterKm,
  onToggleDocx,
  onToggleXls,
  onToggleKm,
  showDocxBtn,
  showXlsBtn,
  showKmBtn,
  content,
  onHeadingClick,
}: LeftPanelProps) {
  return (
    <div className="left-panel">
      <div className="left-panel-tabs">
        <button
          className={`left-tab ${leftPanel === "folder" ? "active" : ""}`}
          onClick={() => setLeftPanel("folder")}
        >
          フォルダ
        </button>
        <button
          className={`left-tab ${leftPanel === "outline" ? "active" : ""}`}
          onClick={() => setLeftPanel("outline")}
        >
          アウトライン
        </button>
      </div>
      {leftPanel === "folder" ? (
        <FileTree
          entries={fileTree}
          activeFile={activeFile}
          onSelectFile={onSelectFile}
          onRefresh={onRefresh}
          filterDocx={filterDocx}
          filterXls={filterXls}
          filterKm={filterKm}
          onToggleDocx={onToggleDocx}
          onToggleXls={onToggleXls}
          onToggleKm={onToggleKm}
          showDocxBtn={showDocxBtn}
          showXlsBtn={showXlsBtn}
          showKmBtn={showKmBtn}
        />
      ) : (
        <OutlinePanel content={content} onHeadingClick={onHeadingClick} />
      )}
    </div>
  );
}
