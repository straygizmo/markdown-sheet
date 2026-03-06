import { save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback } from "react";
import type { MarkdownTable } from "../types";

interface UseExportParams {
  activeFile: string | null;
  previewRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.MutableRefObject<string>;
  tables: MarkdownTable[];
  content: string;
  handleContentChange: (newContent: string) => void;
  showToast: (message: string, isError?: boolean) => void;
}

export function useExport({
  activeFile,
  previewRef,
  contentRef,
  tables,
  content,
  handleContentChange,
  showToast,
}: UseExportParams) {
  // --- Export PDF ---
  const handleExportPdf = useCallback(async () => {
    const el = previewRef.current;
    if (!el) return;
    try {
      const fileName = activeFile
        ? activeFile.split(/[\\/]/).pop()?.replace(/\.md$/i, "") || "document"
        : "document";

      const savePath = await save({
        defaultPath: `${fileName}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!savePath) return;

      showToast("PDF出力中...");

      // @ts-ignore
      const html2pdf = (await import("html2pdf.js")).default;

      const opt = {
        margin: 10,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const },
      };

      const arrayBuffer: ArrayBuffer = await html2pdf().set(opt).from(el).outputPdf("arraybuffer");
      await writeFile(savePath, new Uint8Array(arrayBuffer));
      showToast("PDFを保存しました");
    } catch (error) {
      console.error("PDF export error:", error);
      showToast("PDF出力に失敗しました", true);
    }
  }, [activeFile, previewRef, showToast]);

  // --- Export HTML ---
  const handleExportHtml = useCallback(async () => {
    const el = previewRef.current;
    if (!el) return;
    try {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll(".mermaid-actions, .mermaid-ai-panel").forEach((n) => n.remove());
      const htmlContent = clone.innerHTML;
      const title = activeFile
        ? activeFile.split(/[\\/]/).pop() || "document"
        : "document";
      const safeTitle = title.replace(/[&<>"]/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c)
      );
      const exportContent = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle}</title>
    <style>
      body { font-family: "Segoe UI", "Meiryo", sans-serif; line-height: 1.8; color: #333; max-width: 800px; margin: 0 auto; padding: 2rem; }
      pre { background-color: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
      code { font-family: "Consolas", monospace; font-size: 85%; background-color: rgba(175,184,193,0.2); padding: 0.2em 0.4em; border-radius: 6px; }
      pre code { background: none; padding: 0; }
      blockquote { border-left: 4px solid #dfe2e5; color: #6a737d; padding-left: 1em; margin-left: 0; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; }
      th, td { border: 1px solid #dfe2e5; padding: 6px 13px; }
      th { background-color: #f6f8fa; }
      img { max-width: 100%; }
      h1 { border-bottom: 2px solid #e9d5ff; padding-bottom: 0.3em; color: #9333ea; }
      h2 { border-bottom: 1px solid #e9d5ff; padding-bottom: 0.3em; color: #a855f7; }
    </style>
</head>
<body>${htmlContent}</body>
</html>`;

      const path = await save({
        filters: [{ name: "HTML", extensions: ["html", "htm"] }],
        defaultPath: `${title.replace(/\.md$/i, "")}.html`,
      });
      if (path) {
        await writeTextFile(path, exportContent);
        showToast("HTMLをエクスポートしました");
      }
    } catch (error) {
      console.error("HTML export error:", error);
      showToast("HTMLエクスポートに失敗しました", true);
    }
  }, [activeFile, previewRef, showToast]);

  // --- DOCX Export ---
  const handleExportDocx = useCallback(async () => {
    const content = contentRef.current;
    if (!content) return;
    try {
      const { exportMarkdownToDocx } = await import("../lib/docx/docx-exporter");
      const title = activeFile
        ? activeFile.split(/[\\/]/).pop() || "document"
        : "document";
      const path = await save({
        filters: [{ name: "Word Document", extensions: ["docx"] }],
        defaultPath: `${title.replace(/\.md$/i, "")}.docx`,
      });
      if (path) {
        const { processSvgForStandaloneUse } = await import("../components/MarkdownPreview");
        const mermaidSvgs: (string | null)[] = [];
        const previewEl = previewRef.current;
        if (previewEl) {
          const placeholders = previewEl.querySelectorAll(".mermaid-placeholder");
          for (const ph of Array.from(placeholders)) {
            const svg = ph.querySelector(".mermaid-rendered svg") as SVGSVGElement | null;
            if (svg) {
              try {
                mermaidSvgs.push(processSvgForStandaloneUse(svg));
              } catch {
                mermaidSvgs.push(null);
              }
            } else {
              mermaidSvgs.push(null);
            }
          }
        }

        const fontKey = localStorage.getItem("md-preview-font") || "meiryo";
        const docxData = await exportMarkdownToDocx(content, {
          baseDir: activeFile || undefined,
          mermaidSvgs,
          fontKey,
        });
        await writeFile(path, docxData);
        showToast("DOCXをエクスポートしました");
      }
    } catch (error) {
      console.error("DOCX export error:", error);
      showToast("DOCXエクスポートに失敗しました", true);
    }
  }, [activeFile, previewRef, contentRef, showToast]);

  // --- CSV Export ---
  const handleExportCsv = useCallback(
    async (tableIndex: number) => {
      const table = tables[tableIndex];
      if (!table) return;

      try {
        const rows = [table.headers, ...table.rows];
        const csv = rows
          .map((row) =>
            row.map((cell) => `"${(cell ?? "").replace(/"/g, '""')}"`).join(",")
          )
          .join("\r\n");

        const safeName = (table.heading || `table${tableIndex + 1}`)
          .replace(/[\\/:*?"<>|]/g, "_");

        const path = await save({
          filters: [{ name: "CSV", extensions: ["csv"] }],
          defaultPath: `${safeName}.csv`,
        });
        if (path) {
          await writeTextFile(path, "\uFEFF" + csv);
          showToast("CSVをエクスポートしました");
        }
      } catch (e) {
        console.error("CSV export error:", e);
        showToast("CSVエクスポートに失敗しました", true);
      }
    },
    [tables, showToast]
  );

  // --- CSV Import ---
  const handleImportCsv = useCallback(async () => {
    try {
      const selected = await open({
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (!selected) return;

      const text = await readTextFile(selected as string);
      const clean = text.startsWith("\uFEFF") ? text.slice(1) : text;
      const lines = clean.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length === 0) return;

      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          if (line[i] === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (line[i] === "," && !inQuotes) {
            result.push(current);
            current = "";
          } else {
            current += line[i];
          }
        }
        result.push(current);
        return result;
      };

      const headers = parseCSVLine(lines[0]);
      const dataRows = lines.slice(1).map(parseCSVLine);

      const tableMarkdown = [
        "| " + headers.join(" | ") + " |",
        "| " + headers.map(() => "---").join(" | ") + " |",
        ...dataRows.map((row) => "| " + row.join(" | ") + " |"),
      ].join("\n");

      const newContent = content + "\n\n" + tableMarkdown + "\n";
      handleContentChange(newContent);
      showToast("CSVをインポートしました");
    } catch (e) {
      showToast("CSVインポートに失敗しました", true);
    }
  }, [content, handleContentChange, showToast]);

  return {
    handleExportPdf,
    handleExportHtml,
    handleExportDocx,
    handleExportCsv,
    handleImportCsv,
  } as const;
}
