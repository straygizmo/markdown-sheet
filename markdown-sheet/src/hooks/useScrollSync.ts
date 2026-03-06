import { useEffect, useRef, useState } from "react";

export function useScrollSync(
  editorRef: React.RefObject<HTMLTextAreaElement | null>,
  previewRef: React.RefObject<HTMLDivElement | null>,
  editorVisible: boolean,
  activeViewTab: string,
  officeFileData: Uint8Array | null,
  officeFileType: string | null,
) {
  const [syncScroll, setSyncScroll] = useState(
    () => localStorage.getItem("md-sync-scroll") !== "false"
  );
  const isSyncingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem("md-sync-scroll", String(syncScroll));
  }, [syncScroll]);

  useEffect(() => {
    if (!syncScroll || !editorVisible || activeViewTab !== "preview") return;
    const editor = editorRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;

    const syncFromEditor = () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      const ratio = editor.scrollTop / Math.max(editor.scrollHeight - editor.clientHeight, 1);
      preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
      requestAnimationFrame(() => { isSyncingRef.current = false; });
    };

    const syncFromPreview = () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      const ratio = preview.scrollTop / Math.max(preview.scrollHeight - preview.clientHeight, 1);
      editor.scrollTop = ratio * (editor.scrollHeight - editor.clientHeight);
      requestAnimationFrame(() => { isSyncingRef.current = false; });
    };

    editor.addEventListener("scroll", syncFromEditor, { passive: true });
    preview.addEventListener("scroll", syncFromPreview, { passive: true });
    return () => {
      editor.removeEventListener("scroll", syncFromEditor);
      preview.removeEventListener("scroll", syncFromPreview);
    };
  }, [syncScroll, editorVisible, activeViewTab, officeFileData, officeFileType, editorRef, previewRef]);

  return { syncScroll, setSyncScroll } as const;
}
