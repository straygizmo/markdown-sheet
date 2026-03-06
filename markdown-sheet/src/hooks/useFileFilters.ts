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
  const [filterImages, setFilterImages] = useState(
    () => localStorage.getItem("md-filter-images") === "true"
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
  const [showImagesBtn, setShowImagesBtn] = useState(
    () => localStorage.getItem("md-show-images-btn") === "true"
  );

  const handleSaveFilterVisibility = useCallback((v: { showDocx: boolean; showXls: boolean; showKm: boolean; showImages: boolean }) => {
    setShowDocxBtn(v.showDocx);
    setShowXlsBtn(v.showXls);
    setShowKmBtn(v.showKm);
    setShowImagesBtn(v.showImages);
    localStorage.setItem("md-show-docx-btn", String(v.showDocx));
    localStorage.setItem("md-show-xls-btn", String(v.showXls));
    localStorage.setItem("md-show-km-btn", String(v.showKm));
    localStorage.setItem("md-show-images-btn", String(v.showImages));
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
    if (!v.showImages && filterImages) {
      setFilterImages(false);
      localStorage.setItem("md-filter-images", "false");
    }
  }, [filterDocx, filterXls, filterKm, filterImages]);

  const toggleFilterDocx = useCallback(() => {
    setFilterDocx((v) => { localStorage.setItem("md-filter-docx", String(!v)); return !v; });
  }, []);
  const toggleFilterXls = useCallback(() => {
    setFilterXls((v) => { localStorage.setItem("md-filter-xls", String(!v)); return !v; });
  }, []);
  const toggleFilterKm = useCallback(() => {
    setFilterKm((v) => { localStorage.setItem("md-filter-km", String(!v)); return !v; });
  }, []);
  const toggleFilterImages = useCallback(() => {
    setFilterImages((v) => { localStorage.setItem("md-filter-images", String(!v)); return !v; });
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
          includeImages: filterImages,
        });
        setFileTree(entries);
      } catch { /* ignore */ }
    })();
  }, [filterDocx, filterXls, filterKm, filterImages, folderPath, setFileTree]);

  // ファイルツリーを再取得するコールバック
  const refreshFileTree = useCallback(async () => {
    if (!folderPath) return;
    try {
      const entries: FileEntry[] = await invoke("get_file_tree", {
        dirPath: folderPath,
        includeDocx: filterDocx,
        includeXls: filterXls,
        includeKm: filterKm,
        includeImages: filterImages,
      });
      setFileTree(entries);
    } catch { /* ignore */ }
  }, [folderPath, filterDocx, filterXls, filterKm, filterImages, setFileTree]);

  return {
    filterDocx, filterXls, filterKm, filterImages,
    toggleFilterDocx, toggleFilterXls, toggleFilterKm, toggleFilterImages,
    showDocxBtn, showXlsBtn, showKmBtn, showImagesBtn,
    handleSaveFilterVisibility,
    refreshFileTree,
  } as const;
}
