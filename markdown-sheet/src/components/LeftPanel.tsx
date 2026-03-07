import type { FileEntry, ZennArticleMeta } from "../types";
import FileTree from "./FileTree";
import OutlinePanel from "./OutlinePanel";
import ZennPublishPanel from "./ZennPublishPanel";

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
  filterImages: boolean;
  onToggleDocx: () => void;
  onToggleXls: () => void;
  onToggleKm: () => void;
  onToggleImages: () => void;
  showDocxBtn: boolean;
  showXlsBtn: boolean;
  showKmBtn: boolean;
  showImagesBtn: boolean;
  onImageDragStart?: (path: string) => void;
  isZennMode?: boolean;
  zennArticlesMeta?: Record<string, ZennArticleMeta>;
  folderPath?: string | null;
  showToast?: (message: string, isError?: boolean) => void;
  onRefreshZenn?: () => void;
  showZennBtn?: boolean;
  onInitZenn?: () => void;
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
  filterImages,
  onToggleDocx,
  onToggleXls,
  onToggleKm,
  onToggleImages,
  showDocxBtn,
  showXlsBtn,
  showKmBtn,
  showImagesBtn,
  onImageDragStart,
  isZennMode,
  zennArticlesMeta,
  folderPath,
  showToast,
  onRefreshZenn,
  showZennBtn,
  onInitZenn,
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
          filterImages={filterImages}
          onToggleDocx={onToggleDocx}
          onToggleXls={onToggleXls}
          onToggleKm={onToggleKm}
          onToggleImages={onToggleImages}
          showDocxBtn={showDocxBtn}
          showXlsBtn={showXlsBtn}
          showKmBtn={showKmBtn}
          showImagesBtn={showImagesBtn}
          onImageDragStart={onImageDragStart}
          isZennMode={isZennMode}
          zennArticlesMeta={zennArticlesMeta}
          showZennBtn={showZennBtn}
          onInitZenn={onInitZenn}
        />
      ) : (
        <OutlinePanel content={content} onHeadingClick={onHeadingClick} />
      )}
      {isZennMode && folderPath && showToast && onRefreshZenn && (
        <ZennPublishPanel
          folderPath={folderPath}
          showToast={showToast}
          onRefreshFileTree={onRefresh}
          onRefreshZenn={onRefreshZenn}
          zennArticlesMeta={zennArticlesMeta}
        />
      )}
    </div>
  );
}
