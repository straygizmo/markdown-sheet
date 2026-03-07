import { useEffect, useRef, useState } from "react";

export function useScrollSync(
  editorRef: React.RefObject<HTMLTextAreaElement | null>,
  previewRef: React.RefObject<HTMLDivElement | null>,
  editorVisible: boolean,
  activeViewTab: string,
  officeFileData: Uint8Array | null,
  officeFileType: string | null,
  activeTabId: string,
) {
  const [syncScroll, setSyncScroll] = useState(
    () => localStorage.getItem("md-sync-scroll") !== "false"
  );
  const isSyncingRef = useRef(false);
  // エディタ入力中は preview→editor のスクロール同期を抑制するタイマー
  const editorEditingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorEditingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem("md-sync-scroll", String(syncScroll));
  }, [syncScroll]);

  useEffect(() => {
    isSyncingRef.current = false;
    if (!syncScroll || !editorVisible || activeViewTab !== "preview") return;
    const editor = editorRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;

    // エディタで入力があったら一定時間 preview→editor 同期を抑制する。
    // 入力によりプレビューの innerHTML が更新され scrollHeight が変わると
    // スクロールイベントが発火し、エディタのスクロール位置がずれる問題を防ぐ。
    const onEditorInput = () => {
      editorEditingRef.current = true;
      if (editorEditingTimerRef.current) clearTimeout(editorEditingTimerRef.current);
      editorEditingTimerRef.current = setTimeout(() => {
        editorEditingRef.current = false;
      }, 1000);
    };

    const syncFromEditor = () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      const ratio = editor.scrollTop / Math.max(editor.scrollHeight - editor.clientHeight, 1);
      preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
      requestAnimationFrame(() => { isSyncingRef.current = false; });
    };

    const syncFromPreview = () => {
      if (isSyncingRef.current) return;
      // MarkdownPreview が innerHTML を更新中は preview→editor 同期をスキップする。
      // innerHTML 全置換で scrollHeight が変わり scrollTop がクランプされると
      // scroll イベントが発火し、エディタのスクロールが微妙にずれる問題を防ぐ。
      if (preview.dataset.contentUpdating) return;
      // エディタで入力中は preview→editor 同期をスキップする。
      // プレビュー更新に伴う非同期処理（Mermaid、画像読み込み等）による
      // スクロール変化でエディタのカーソル位置が見えなくなる問題を防ぐ。
      if (editorEditingRef.current) return;
      isSyncingRef.current = true;
      const ratio = preview.scrollTop / Math.max(preview.scrollHeight - preview.clientHeight, 1);
      editor.scrollTop = ratio * (editor.scrollHeight - editor.clientHeight);
      requestAnimationFrame(() => { isSyncingRef.current = false; });
    };

    editor.addEventListener("input", onEditorInput);
    editor.addEventListener("scroll", syncFromEditor, { passive: true });
    preview.addEventListener("scroll", syncFromPreview, { passive: true });
    return () => {
      editor.removeEventListener("input", onEditorInput);
      editor.removeEventListener("scroll", syncFromEditor);
      preview.removeEventListener("scroll", syncFromPreview);
      if (editorEditingTimerRef.current) clearTimeout(editorEditingTimerRef.current);
    };
  }, [syncScroll, editorVisible, activeViewTab, officeFileData, officeFileType, editorRef, previewRef, activeTabId]);

  return { syncScroll, setSyncScroll } as const;
}
