import { useCallback, useState } from "react";
import type { RecentFile, RecentFolder } from "../types";

export function useRecentItems() {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("md-recent-files") || "[]");
    } catch { return []; }
  });

  const addRecentFile = useCallback((filePath: string) => {
    const name = filePath.split(/[\\/]/).pop() ?? filePath;
    setRecentFiles((prev) => {
      const filtered = prev.filter((f) => f.path !== filePath);
      const next = [{ path: filePath, name, ts: Date.now() }, ...filtered].slice(0, 10);
      localStorage.setItem("md-recent-files", JSON.stringify(next));
      return next;
    });
  }, []);

  const [recentFolders, setRecentFolders] = useState<RecentFolder[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("md-recent-folders") || "[]");
    } catch { return []; }
  });

  const addRecentFolder = useCallback((folderPathStr: string) => {
    const name = folderPathStr.split(/[\\/]/).pop() ?? folderPathStr;
    setRecentFolders((prev) => {
      const filtered = prev.filter((f) => f.path !== folderPathStr);
      const next = [{ path: folderPathStr, name, ts: Date.now() }, ...filtered].slice(0, 10);
      localStorage.setItem("md-recent-folders", JSON.stringify(next));
      return next;
    });
  }, []);

  return { recentFiles, addRecentFile, recentFolders, addRecentFolder } as const;
}
