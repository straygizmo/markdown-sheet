import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import type { FileEntry } from "../types";

export function useFileFilters(folderPath: string | null, setFileTree: (entries: FileEntry[]) => void) {
  const migrateOld = localStorage.getItem("md-office-viewer") === "true";
  const [filterDocx, setFilterDocx] = useState(
    () => localStorage.getItem("md-filter-docx") !== null
      ? localStorage.getItem("md-filter-docx") === "true"
      : migrateOld
  );
  const [filterXls, setFilterXls] = useState(
    () => localStorage.getItem("md-filter-xls") !== null
      ? localStorage.getItem("md-filter-xls") === "true"
      : migrateOld
  );
  const [filterKm, setFilterKm] = useState(
    () => localStorage.getItem("md-filter-km") === "true"
  );

  const [showDocxBtn, setShowDocxBtn] = useState(
    () => localStorage.getItem("md-show-docx-btn") !== "false"
  );
  const [showXlsBtn, setShowXlsBtn] = useState(
    () => localStorage.getItem("md-show-xls-btn") !== "false"
  );
  const [showKmBtn, setShowKmBtn] = useState(
    () => localStorage.getItem("md-show-km-btn") === "true"
  );

  const handleSaveFilterVisibility = useCallback((v: { showDocx: boolean; showXls: boolean; showKm: boolean }) => {
    setShowDocxBtn(v.showDocx);
    setShowXlsBtn(v.showXls);
    setShowKmBtn(v.showKm);
    localStorage.setItem("md-show-docx-btn", String(v.showDocx));
    localStorage.setItem("md-show-xls-btn", String(v.showXls));
    localStorage.setItem("md-show-km-btn", String(v.showKm));
    if (!v.showDocx && filterDocx) {
      setFilterDocx(false);
      localStorage.setItem("md-filter-docx", "false");
    }
    if (!v.showXls && filterXls) {
      setFilterXls(false);
      localStorage.setItem("md-filter-xls", "false");
    }
    if (!v.showKm && filterKm) {
      setFilterKm(false);
      localStorage.setItem("md-filter-km", "false");
    }
  }, [filterDocx, filterXls, filterKm]);

  const toggleFilterDocx = useCallback(() => {
    setFilterDocx((v) => { localStorage.setItem("md-filter-docx", String(!v)); return !v; });
  }, []);
  const toggleFilterXls = useCallback(() => {
    setFilterXls((v) => { localStorage.setItem("md-filter-xls", String(!v)); return !v; });
  }, []);
  const toggleFilterKm = useCallback(() => {
    setFilterKm((v) => { localStorage.setItem("md-filter-km", String(!v)); return !v; });
  }, []);

  // フォルダツリーをフィルター変更時に再取得
  useEffect(() => {
    if (!folderPath) return;
    (async () => {
      try {
        const entries: FileEntry[] = await invoke("get_file_tree", {
          dirPath: folderPath,
          includeDocx: filterDocx,
          includeXls: filterXls,
          includeKm: filterKm,
        });
        setFileTree(entries);
      } catch { /* ignore */ }
    })();
  }, [filterDocx, filterXls, filterKm, folderPath, setFileTree]);

  // ファイルツリーを再取得するコールバック
  const refreshFileTree = useCallback(async () => {
    if (!folderPath) return;
    try {
      const entries: FileEntry[] = await invoke("get_file_tree", {
        dirPath: folderPath,
        includeDocx: filterDocx,
        includeXls: filterXls,
        includeKm: filterKm,
      });
      setFileTree(entries);
    } catch { /* ignore */ }
  }, [folderPath, filterDocx, filterXls, filterKm, setFileTree]);

  return {
    filterDocx, filterXls, filterKm,
    toggleFilterDocx, toggleFilterXls, toggleFilterKm,
    showDocxBtn, showXlsBtn, showKmBtn,
    handleSaveFilterVisibility,
    refreshFileTree,
  } as const;
}
