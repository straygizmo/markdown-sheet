import { useState } from "react";
import MarkdownPreview from "./MarkdownPreview";
import OfficePreview from "./OfficePreview";
import Terminal from "./Terminal";
import type { AiSettings } from "../types";
import "./PreviewPanel.css";

interface Props {
  content: string;
  filePath?: string | null;
  folderPath?: string | null;
  previewRef?: React.RefObject<HTMLDivElement | null>;
  aiSettings?: AiSettings;
  onUpdateMermaidBlock?: (blockIndex: number, newSource: string) => void;
  theme: "light" | "dark";
  officeFileData?: Uint8Array | null;
  officeFileType?: string | null;
}

export default function PreviewPanel({
  content,
  filePath,
  folderPath,
  previewRef,
  aiSettings,
  onUpdateMermaidBlock,
  theme,
  officeFileData,
  officeFileType,
}: Props) {
  const [activeTab, setActiveTab] = useState<"preview" | "terminal">("preview");

  // Extract directory from filePath for terminal cwd, fall back to open folder path
  const cwd = filePath
    ? filePath.replace(/[\\/][^\\/]*$/, "")
    : folderPath ?? "C:\\";

  const isOffice = officeFileData && officeFileType;

  return (
    <div className="preview-panel-wrapper">
      <div className="preview-panel-tabs">
        <button
          className={`preview-panel-tab${activeTab === "preview" ? " active" : ""}`}
          onClick={() => setActiveTab("preview")}
        >
          プレビュー
        </button>
        <button
          className={`preview-panel-tab${activeTab === "terminal" ? " active" : ""}`}
          onClick={() => setActiveTab("terminal")}
        >
          ターミナル
        </button>
      </div>
      <div className="preview-panel-content">
        <div style={{ display: activeTab === "preview" ? "contents" : "none" }}>
          {isOffice ? (
            <OfficePreview data={officeFileData} fileType={officeFileType} theme={theme} />
          ) : (
            <MarkdownPreview
              content={content}
              filePath={filePath}
              previewRef={previewRef}
              aiSettings={aiSettings}
              onUpdateMermaidBlock={onUpdateMermaidBlock}
            />
          )}
        </div>
        <div style={{
          display: activeTab === "terminal" ? "block" : "none",
          height: "100%",
        }}>
          <Terminal cwd={cwd} visible={activeTab === "terminal"} theme={theme} />
        </div>
      </div>
    </div>
  );
}
