import { useState } from "react";
import MarkdownPreview from "./MarkdownPreview";
import OfficePreview from "./OfficePreview";
import type { AiSettings } from "../types";
import { docxToMarkdown } from "../lib/docxToMarkdown";
import "./PreviewPanel.css";

interface Props {
  content: string;
  filePath?: string | null;
  previewRef?: React.RefObject<HTMLDivElement | null>;
  aiSettings?: AiSettings;
  onUpdateMermaidBlock?: (blockIndex: number, newSource: string) => void;
  theme: "light" | "dark";
  officeFileData?: Uint8Array | null;
  officeFileType?: string | null;
  onOpenFile?: (path: string) => void;
  onRefreshFileTree?: () => void;
  activeViewTab?: "preview" | "table";
  onViewTabChange?: (tab: "preview" | "table") => void;
  onExportPdf?: () => void;
  onExportHtml?: () => void;
  onExportDocx?: () => void;
  onCopyRichText?: () => void;
}

export default function PreviewPanel({
  content,
  filePath,
  previewRef,
  aiSettings,
  onUpdateMermaidBlock,
  theme,
  officeFileData,
  officeFileType,
  onOpenFile,
  onRefreshFileTree,
  activeViewTab,
  onViewTabChange,
  onExportPdf,
  onExportHtml,
  onExportDocx,
  onCopyRichText,
}: Props) {
  const [converting, setConverting] = useState(false);

  const isOffice = officeFileData && officeFileType;
  const isDocx = filePath?.toLowerCase().endsWith(".docx");

  const handleConvertToMarkdown = async () => {
    if (!officeFileData || !filePath) return;
    setConverting(true);
    try {
      const { mdPath } = await docxToMarkdown(officeFileData, filePath);
      onRefreshFileTree?.();
      onOpenFile?.(mdPath);
    } catch (e) {
      alert(`変換に失敗しました: ${e instanceof Error ? e.message : e}`);
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="preview-panel-wrapper">
      <div className="preview-panel-header">
        {onViewTabChange ? (
          <>
            <button
              className={`view-tab ${activeViewTab === "preview" ? "active" : ""}`}
              onClick={() => onViewTabChange("preview")}
            >
              プレビュー
            </button>
            <button
              className={`view-tab ${activeViewTab === "table" ? "active" : ""}`}
              onClick={() => onViewTabChange("table")}
            >
              テーブル編集
            </button>
          </>
        ) : (
          <span>プレビュー</span>
        )}
        {(onExportPdf || onExportHtml || onExportDocx || onCopyRichText) && (
          <div className="preview-export-group">
            <span className="preview-export-label">出力</span>
            {onCopyRichText && (
              <button onClick={onCopyRichText} title="書式付きでコピー (PPT/Excel向け)">
                書式コピー
              </button>
            )}
            {onExportPdf && (
              <button onClick={onExportPdf} title="PDFとしてエクスポート">
                PDF
              </button>
            )}
            {onExportHtml && (
              <button onClick={onExportHtml} title="HTMLとしてエクスポート">
                HTML
              </button>
            )}
            {onExportDocx && (
              <button onClick={onExportDocx} title="DOCXとしてエクスポート">
                DOCX
              </button>
            )}
          </div>
        )}
      </div>
      {isOffice && isDocx && (
        <div className="preview-convert-bar">
          <button
            onClick={handleConvertToMarkdown}
            disabled={converting}
          >
            {converting ? "変換中..." : "Markdownに変換"}
          </button>
        </div>
      )}
      <div className="preview-panel-content">
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
    </div>
  );
}
