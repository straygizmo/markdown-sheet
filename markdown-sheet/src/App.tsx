import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import AiGenerateModal from "./components/AiGenerateModal";
import EditorPanel from "./components/EditorPanel";
import LeftPanel from "./components/LeftPanel";
import MindmapEditor, { type MindmapEditorHandle } from "./components/MindmapEditor";
import PreviewPanel from "./components/PreviewPanel";
import SearchReplace from "./components/SearchReplace";
import Settings from "./components/Settings";
import StatusBar from "./components/StatusBar";
import TabBar from "./components/TabBar";
import TableEditor from "./components/TableEditor";
import Terminal from "./components/Terminal";
import Toolbar from "./components/Toolbar";
import { useAiFeatures } from "./hooks/useAiFeatures";
import { useDividerDrag } from "./hooks/useDividerDrag";
import { useEditorFormatting } from "./hooks/useEditorFormatting";
import { useExport } from "./hooks/useExport";
import { useFileFilters } from "./hooks/useFileFilters";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useRecentItems } from "./hooks/useRecentItems";
import { useScrollSync } from "./hooks/useScrollSync";
import { useTableEditor } from "./hooks/useTableEditor";
import { useTheme } from "./hooks/useTheme";
import { useToast } from "./hooks/useToast";
import { getOfficeExt, getMindmapExt, getImageExt, makeInitialTab, MERMAID_TEMPLATES, TRANSFORM_OPTIONS, MINDMAP_EXTENSIONS } from "./lib/constants";
import { parseMarkdown, rebuildDocument } from "./lib/markdownParser";
import type { KityMinderJson } from "./lib/mindmapTypes";
import type { FileEntry, MarkdownTable, Tab } from "./types";

type ViewTab = "preview" | "table";

function App() {
  // --- Extracted hooks ---
  const { theme, toggleTheme } = useTheme();
  const { toast, showToast } = useToast();
  const { recentFiles, addRecentFile, recentFolders, addRecentFolder } = useRecentItems();

  // --- Tabs ---
  const initialTab = makeInitialTab();
  const [tabs, setTabs] = useState<Tab[]>([initialTab]);
  const [activeTabId, setActiveTabId] = useState<string>(initialTab.id);
  const [activeFolderPath, setActiveFolderPath] = useState<string>(initialTab.folderPath);
  const folderLastActiveTabRef = useRef<Record<string, string>>({ [initialTab.folderPath]: initialTab.id });

  // --- File state (working copy of active tab) ---
  const [fileTree, setFileTree] = useState<FileEntry[]>([]);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const activeFileRef = useRef<string | null>(null);
  activeFileRef.current = activeFile;
  const [content, setContent] = useState("");
  const [originalLines, setOriginalLines] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<ViewTab>("preview");
  const [editorVisible, setEditorVisible] = useState(true);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [leftPanel, setLeftPanel] = useState<"folder" | "outline">("folder");
  const [showSettings, setShowSettings] = useState(false);

  // --- Auto-save ---
  const [autoSave, setAutoSave] = useState(
    () => localStorage.getItem("md-auto-save") !== "false"
  );
  useEffect(() => {
    localStorage.setItem("md-auto-save", String(autoSave));
  }, [autoSave]);

  // --- Office viewer ---
  const [officeFileData, setOfficeFileData] = useState<Uint8Array | null>(null);
  const [officeFileType, setOfficeFileType] = useState<string | null>(null);

  // --- Mindmap editor ---
  const [mindmapFileData, setMindmapFileData] = useState<Uint8Array | null>(null);
  const [mindmapFileType, setMindmapFileType] = useState<string | null>(null);
  const mindmapEditorRef = useRef<MindmapEditorHandle>(null);

  // --- Image preview ---
  const [imageBlobUrl, setImageBlobUrl] = useState<string | null>(null);
  const imageBlobUrlRef = useRef<string | null>(null);

  const clearImagePreview = useCallback(() => {
    if (imageBlobUrlRef.current) {
      URL.revokeObjectURL(imageBlobUrlRef.current);
      imageBlobUrlRef.current = null;
    }
    setImageBlobUrl(null);
  }, []);

  const loadImagePreview = useCallback(async (filePath: string) => {
    clearImagePreview();
    try {
      const bytes = await readFile(filePath);
      const ext = filePath.toLowerCase().split(".").pop() ?? "";
      const mimeMap: Record<string, string> = {
        png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
        gif: "image/gif", bmp: "image/bmp", svg: "image/svg+xml", webp: "image/webp",
      };
      const blob = new Blob([bytes], { type: mimeMap[ext] ?? "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      imageBlobUrlRef.current = url;
      setImageBlobUrl(url);
    } catch { /* ignore */ }
  }, [clearImagePreview]);

  // --- File filters ---
  const {
    filterDocx, filterXls, filterKm, filterImages,
    toggleFilterDocx, toggleFilterXls, toggleFilterKm, toggleFilterImages,
    showDocxBtn, showXlsBtn, showKmBtn, showImagesBtn,
    handleSaveFilterVisibility,
    refreshFileTree,
  } = useFileFilters(folderPath, setFileTree);

  // --- Table editor ---
  const {
    tables,
    updateCell,
    addRow,
    deleteRow,
    addColumn,
    deleteColumn,
    undo,
    redo,
    reset,
    canUndo,
    canRedo,
  } = useTableEditor([]);

  // --- Editor pane ---
  const [editorRatio, setEditorRatio] = useState(40);
  const containerRef = useRef<HTMLDivElement>(null);
  const [terminalRatio, setTerminalRatio] = useState(30);
  const appBodyRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [showTableGrid, setShowTableGrid] = useState(false);
  const tableGridBtnRef = useRef<HTMLButtonElement>(null);

  // --- Editor undo/redo stack ---
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const contentRef = useRef("");
  contentRef.current = content;

  const [contentUndoAvailable, setContentUndoAvailable] = useState(false);
  const [contentRedoAvailable, setContentRedoAvailable] = useState(false);

  // --- Refs for tab switching (always latest values) ---
  const tablesRef = useRef<MarkdownTable[]>([]);
  tablesRef.current = tables;
  const originalLinesRef = useRef<string[]>([]);
  originalLinesRef.current = originalLines;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const tabsRef = useRef<Tab[]>(tabs);
  tabsRef.current = tabs;

  // --- Scroll sync ---
  const { syncScroll, setSyncScroll } = useScrollSync(
    editorRef, previewRef, editorVisible, activeViewTab, officeFileData, officeFileType, activeTabId
  );

  // ====== Tab Management ======

  const saveCurrentToTab = useCallback(() => {
    const id = activeTabIdRef.current;
    setTabs((prev) =>
      prev.map((t) =>
        t.id !== id
          ? t
          : {
              ...t,
              content: contentRef.current,
              originalLines: originalLinesRef.current,
              tables: structuredClone(tablesRef.current),
              dirty: dirtyRef.current,
              contentUndoStack: [...undoStackRef.current],
              contentRedoStack: [...redoStackRef.current],
            }
      )
    );
  }, []);

  const switchToTab = useCallback(
    (tabId: string) => {
      if (tabId === activeTabIdRef.current) return;
      saveCurrentToTab();
      const newTab = tabsRef.current.find((t) => t.id === tabId);
      if (!newTab) return;
      setActiveTabId(tabId);
      setActiveFolderPath(newTab.folderPath);
      getCurrentWindow().setTitle(newTab.folderPath ? `Markdown Studio : ${newTab.folderPath}` : "Markdown Studio");
      folderLastActiveTabRef.current[newTab.folderPath] = tabId;
      setContent(newTab.content);
      setOriginalLines(newTab.originalLines);
      setDirty(newTab.dirty);
      setActiveFile(newTab.filePath);
      undoStackRef.current = [...newTab.contentUndoStack];
      redoStackRef.current = [...newTab.contentRedoStack];
      setContentUndoAvailable(newTab.contentUndoStack.length > 0);
      setContentRedoAvailable(newTab.contentRedoStack.length > 0);
      reset(newTab.tables);
      const officeExt = newTab.filePath ? getOfficeExt(newTab.filePath) : null;
      const mmExt = newTab.filePath ? getMindmapExt(newTab.filePath) : null;
      const imgExt = newTab.filePath ? getImageExt(newTab.filePath) : null;
      if (officeExt && newTab.filePath) {
        readFile(newTab.filePath)
          .then((bytes) => {
            setOfficeFileData(new Uint8Array(bytes));
            setOfficeFileType(officeExt);
            setMindmapFileData(null);
            setMindmapFileType(null);
          })
          .catch(() => {
            setOfficeFileData(null);
            setOfficeFileType(null);
          });
        clearImagePreview();
      } else if (mmExt && newTab.filePath) {
        readFile(newTab.filePath)
          .then((bytes) => {
            setMindmapFileData(new Uint8Array(bytes));
            setMindmapFileType(mmExt);
            setOfficeFileData(null);
            setOfficeFileType(null);
          })
          .catch(() => {
            setMindmapFileData(null);
            setMindmapFileType(null);
          });
        clearImagePreview();
      } else if (imgExt && newTab.filePath) {
        loadImagePreview(newTab.filePath!);
        setOfficeFileData(null);
        setOfficeFileType(null);
        setMindmapFileData(null);
        setMindmapFileType(null);
      } else {
        setOfficeFileData(null);
        setOfficeFileType(null);
        setMindmapFileData(null);
        setMindmapFileType(null);
        clearImagePreview();
      }
    },
    [saveCurrentToTab, reset]
  );

  const openNewTab = useCallback(() => {
    saveCurrentToTab();
    const newTab = makeInitialTab(activeFolderPath);
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    folderLastActiveTabRef.current[activeFolderPath] = newTab.id;
    setContent("");
    setOriginalLines([]);
    setDirty(false);
    setActiveFile(null);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setContentUndoAvailable(false);
    setContentRedoAvailable(false);
    reset([]);
  }, [saveCurrentToTab, reset, activeFolderPath]);

  const closeTab = useCallback(
    (tabId: string) => {
      const currentTabs = tabsRef.current;
      if (currentTabs.length <= 1) return;

      const isActive = tabId === activeTabIdRef.current;

      if (isActive) {
        saveCurrentToTab();
      }

      const latestTabs = tabsRef.current;
      const remaining = latestTabs.filter((t) => t.id !== tabId);

      if (isActive && remaining.length > 0) {
        const closedTab = latestTabs.find((t) => t.id === tabId);
        const closedFolder = closedTab?.folderPath ?? "";
        const sameFolder = remaining.filter((t) => t.folderPath === closedFolder);
        const idx = latestTabs.findIndex((t) => t.id === tabId);
        const newActive = sameFolder.length > 0
          ? sameFolder[0]
          : remaining[Math.min(idx, remaining.length - 1)];
        setContent(newActive.content);
        setOriginalLines(newActive.originalLines);
        setDirty(newActive.dirty);
        setActiveFile(newActive.filePath);
        undoStackRef.current = [...newActive.contentUndoStack];
        redoStackRef.current = [...newActive.contentRedoStack];
        setContentUndoAvailable(newActive.contentUndoStack.length > 0);
        setContentRedoAvailable(newActive.contentRedoStack.length > 0);
        reset(newActive.tables);
        setActiveTabId(newActive.id);
        setActiveFolderPath(newActive.folderPath);
        getCurrentWindow().setTitle(newActive.folderPath ? `Markdown Studio : ${newActive.folderPath}` : "Markdown Studio");
        folderLastActiveTabRef.current[newActive.folderPath] = newActive.id;

        // Office/Mindmap/Image 状態を切り替え先タブに合わせて更新
        const officeExt = newActive.filePath ? getOfficeExt(newActive.filePath) : null;
        const mmExt = newActive.filePath ? getMindmapExt(newActive.filePath) : null;
        const imgExt = newActive.filePath ? getImageExt(newActive.filePath) : null;
        if (officeExt && newActive.filePath) {
          readFile(newActive.filePath)
            .then((bytes) => {
              setOfficeFileData(new Uint8Array(bytes));
              setOfficeFileType(officeExt);
              setMindmapFileData(null);
              setMindmapFileType(null);
            })
            .catch(() => {
              setOfficeFileData(null);
              setOfficeFileType(null);
            });
          clearImagePreview();
        } else if (mmExt && newActive.filePath) {
          readFile(newActive.filePath)
            .then((bytes) => {
              setMindmapFileData(new Uint8Array(bytes));
              setMindmapFileType(mmExt);
              setOfficeFileData(null);
              setOfficeFileType(null);
            })
            .catch(() => {
              setMindmapFileData(null);
              setMindmapFileType(null);
            });
          clearImagePreview();
        } else if (imgExt && newActive.filePath) {
          loadImagePreview(newActive.filePath!);
          setOfficeFileData(null);
          setOfficeFileType(null);
          setMindmapFileData(null);
          setMindmapFileType(null);
        } else {
          setOfficeFileData(null);
          setOfficeFileType(null);
          setMindmapFileData(null);
          setMindmapFileType(null);
          clearImagePreview();
        }
      }

      setTabs(remaining);
    },
    [reset, saveCurrentToTab]
  );

  const switchToFolder = useCallback(
    async (folder: string) => {
      if (folder === activeFolderPath) return;
      const lastTabId = folderLastActiveTabRef.current[folder];
      const folderTabs = tabsRef.current.filter((t) => t.folderPath === folder);
      if (folderTabs.length === 0) return;
      const targetTab = folderTabs.find((t) => t.id === lastTabId) ?? folderTabs[0];
      switchToTab(targetTab.id);

      if (folder) {
        try {
          const entries: FileEntry[] = await invoke("get_file_tree", {
            dirPath: folder,
            includeDocx: filterDocx,
            includeXls: filterXls,
            includeKm: filterKm,
            includeImages: filterImages,
          });
          setFileTree(entries);
          setFolderPath(folder);
          getCurrentWindow().setTitle(`Markdown Studio : ${folder}`);
        } catch { /* ignore */ }
      } else {
        setFileTree([]);
        setFolderPath(null);
        getCurrentWindow().setTitle("Markdown Studio");
      }
    },
    [activeFolderPath, switchToTab, filterDocx, filterXls, filterKm, filterImages]
  );

  const closeFolderTabs = useCallback(
    (folder: string) => {
      const currentTabs = tabsRef.current;
      const folderTabs = currentTabs.filter((t) => t.folderPath === folder);
      const remaining = currentTabs.filter((t) => t.folderPath !== folder);

      if (remaining.length === 0) return;

      const dirtyTabs = folderTabs.filter((t) => t.dirty);
      if (dirtyTabs.length > 0) {
        const folderName = folder ? folder.split(/[\\/]/).pop() ?? folder : "新規";
        if (!window.confirm(`"${folderName}" 内に未保存の変更があります。すべて閉じますか？`)) return;
      }

      const isActiveInFolder = folderTabs.some((t) => t.id === activeTabIdRef.current);
      if (isActiveInFolder) {
        saveCurrentToTab();
        const newActive = remaining[0];
        setContent(newActive.content);
        setOriginalLines(newActive.originalLines);
        setDirty(newActive.dirty);
        setActiveFile(newActive.filePath);
        undoStackRef.current = [...newActive.contentUndoStack];
        redoStackRef.current = [...newActive.contentRedoStack];
        setContentUndoAvailable(newActive.contentUndoStack.length > 0);
        setContentRedoAvailable(newActive.contentRedoStack.length > 0);
        reset(newActive.tables);
        setActiveTabId(newActive.id);
        setActiveFolderPath(newActive.folderPath);
        getCurrentWindow().setTitle(newActive.folderPath ? `Markdown Studio : ${newActive.folderPath}` : "Markdown Studio");
        folderLastActiveTabRef.current[newActive.folderPath] = newActive.id;

        // Office/Mindmap/Image 状態を切り替え先タブに合わせて更新
        const officeExt = newActive.filePath ? getOfficeExt(newActive.filePath) : null;
        const mmExt = newActive.filePath ? getMindmapExt(newActive.filePath) : null;
        const imgExt = newActive.filePath ? getImageExt(newActive.filePath) : null;
        if (officeExt && newActive.filePath) {
          readFile(newActive.filePath)
            .then((bytes) => {
              setOfficeFileData(new Uint8Array(bytes));
              setOfficeFileType(officeExt);
              setMindmapFileData(null);
              setMindmapFileType(null);
            })
            .catch(() => {
              setOfficeFileData(null);
              setOfficeFileType(null);
            });
          clearImagePreview();
        } else if (mmExt && newActive.filePath) {
          readFile(newActive.filePath)
            .then((bytes) => {
              setMindmapFileData(new Uint8Array(bytes));
              setMindmapFileType(mmExt);
              setOfficeFileData(null);
              setOfficeFileType(null);
            })
            .catch(() => {
              setMindmapFileData(null);
              setMindmapFileType(null);
            });
          clearImagePreview();
        } else if (imgExt && newActive.filePath) {
          loadImagePreview(newActive.filePath!);
          setOfficeFileData(null);
          setOfficeFileType(null);
          setMindmapFileData(null);
          setMindmapFileType(null);
        } else {
          setOfficeFileData(null);
          setOfficeFileType(null);
          setMindmapFileData(null);
          setMindmapFileType(null);
          clearImagePreview();
        }
      }

      delete folderLastActiveTabRef.current[folder];
      setTabs(remaining);
    },
    [reset, saveCurrentToTab]
  );

  // ====== File Loading ======

  const loadFile = useCallback(
    async (filePath: string) => {
      const existing = tabsRef.current.find((t) => t.filePath === filePath && t.folderPath === activeFolderPath);
      if (existing) {
        switchToTab(existing.id);
        const officeExt = getOfficeExt(filePath);
        const mmExt = getMindmapExt(filePath);
        const imgExt = getImageExt(filePath);
        if (officeExt) {
          try {
            const bytes = await readFile(filePath);
            setOfficeFileData(new Uint8Array(bytes));
            setOfficeFileType(officeExt);
            setMindmapFileData(null);
            setMindmapFileType(null);
            clearImagePreview();
          } catch { /* ignore */ }
        } else if (mmExt) {
          try {
            const bytes = await readFile(filePath);
            setMindmapFileData(new Uint8Array(bytes));
            setMindmapFileType(mmExt);
            setOfficeFileData(null);
            setOfficeFileType(null);
            clearImagePreview();
          } catch { /* ignore */ }
        } else if (imgExt) {
          loadImagePreview(filePath);
          setOfficeFileData(null);
          setOfficeFileType(null);
          setMindmapFileData(null);
          setMindmapFileType(null);
        } else {
          setOfficeFileData(null);
          setOfficeFileType(null);
          setMindmapFileData(null);
          setMindmapFileType(null);
          clearImagePreview();
        }
        return;
      }

      try {
        const officeExt = getOfficeExt(filePath);
        if (officeExt) {
          const bytes = await readFile(filePath);
          setOfficeFileData(new Uint8Array(bytes));
          setOfficeFileType(officeExt);
          setMindmapFileData(null);
          setMindmapFileType(null);
          clearImagePreview();

          const currentTab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
          const isCurrentEmpty = currentTab && !currentTab.filePath && !currentTab.dirty && !currentTab.content;

          if (isCurrentEmpty) {
            const effectiveFolder = activeFolderPath === "" ? filePath.replace(/[\\/][^\\/]+$/, "") : activeFolderPath;
            if (effectiveFolder !== activeFolderPath) {
              setActiveFolderPath(effectiveFolder);
              setFolderPath(effectiveFolder);
              getCurrentWindow().setTitle(`Markdown Studio : ${effectiveFolder}`);
            }
            const currentId = activeTabIdRef.current;
            setActiveFile(filePath);
            setContent("");
            setOriginalLines([]);
            setDirty(false);
            reset([]);
            setTabs((prev) =>
              prev.map((t) =>
                t.id === currentId
                  ? { ...t, filePath, folderPath: effectiveFolder, content: "", originalLines: [], tables: [], dirty: false }
                  : t
              )
            );
            folderLastActiveTabRef.current[effectiveFolder] = currentId;
          } else {
            saveCurrentToTab();
            const parentFolder = filePath.replace(/[\\/][^\\/]+$/, "");
            const isUnderActiveFolder = activeFolderPath && (filePath.startsWith(activeFolderPath + "\\") || filePath.startsWith(activeFolderPath + "/"));
            const targetFolder = isUnderActiveFolder ? activeFolderPath : parentFolder;
            if (targetFolder !== activeFolderPath) {
              setActiveFolderPath(targetFolder);
              setFolderPath(targetFolder);
              getCurrentWindow().setTitle(`Markdown Studio : ${targetFolder}`);
            }
            const newTab: Tab = {
              id: crypto.randomUUID(),
              filePath,
              folderPath: targetFolder,
              content: "",
              originalLines: [],
              tables: [],
              dirty: false,
              contentUndoStack: [],
              contentRedoStack: [],
            };
            setTabs((prev) => [...prev, newTab]);
            setActiveTabId(newTab.id);
            setContent("");
            setOriginalLines([]);
            setDirty(false);
            setActiveFile(filePath);
            reset([]);
            folderLastActiveTabRef.current[targetFolder] = newTab.id;
          }
          addRecentFile(filePath);
          return;
        }

        const mmExt = getMindmapExt(filePath);
        if (mmExt) {
          const bytes = await readFile(filePath);
          setMindmapFileData(new Uint8Array(bytes));
          setMindmapFileType(mmExt);
          setOfficeFileData(null);
          setOfficeFileType(null);
          clearImagePreview();

          const currentTab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
          const isCurrentEmpty = currentTab && !currentTab.filePath && !currentTab.dirty && !currentTab.content;

          if (isCurrentEmpty) {
            const effectiveFolder = activeFolderPath === "" ? filePath.replace(/[\\/][^\\/]+$/, "") : activeFolderPath;
            if (effectiveFolder !== activeFolderPath) {
              setActiveFolderPath(effectiveFolder);
              setFolderPath(effectiveFolder);
              getCurrentWindow().setTitle(`Markdown Studio : ${effectiveFolder}`);
            }
            const currentId = activeTabIdRef.current;
            setActiveFile(filePath);
            setContent("");
            setOriginalLines([]);
            setDirty(false);
            reset([]);
            setTabs((prev) =>
              prev.map((t) =>
                t.id === currentId
                  ? { ...t, filePath, folderPath: effectiveFolder, content: "", originalLines: [], tables: [], dirty: false }
                  : t
              )
            );
            folderLastActiveTabRef.current[effectiveFolder] = currentId;
          } else {
            saveCurrentToTab();
            const parentFolder = filePath.replace(/[\\/][^\\/]+$/, "");
            const isUnderActiveFolder = activeFolderPath && (filePath.startsWith(activeFolderPath + "\\") || filePath.startsWith(activeFolderPath + "/"));
            const targetFolder = isUnderActiveFolder ? activeFolderPath : parentFolder;
            if (targetFolder !== activeFolderPath) {
              setActiveFolderPath(targetFolder);
              setFolderPath(targetFolder);
              getCurrentWindow().setTitle(`Markdown Studio : ${targetFolder}`);
            }
            const newTab: Tab = {
              id: crypto.randomUUID(),
              filePath,
              folderPath: targetFolder,
              content: "",
              originalLines: [],
              tables: [],
              dirty: false,
              contentUndoStack: [],
              contentRedoStack: [],
            };
            setTabs((prev) => [...prev, newTab]);
            setActiveTabId(newTab.id);
            setContent("");
            setOriginalLines([]);
            setDirty(false);
            setActiveFile(filePath);
            reset([]);
            folderLastActiveTabRef.current[targetFolder] = newTab.id;
          }
          addRecentFile(filePath);
          return;
        }

        // 画像ファイル
        const imgExt = getImageExt(filePath);
        if (imgExt) {
          loadImagePreview(filePath);
          setOfficeFileData(null);
          setOfficeFileType(null);
          setMindmapFileData(null);
          setMindmapFileType(null);

          const currentTab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
          const isCurrentEmpty = currentTab && !currentTab.filePath && !currentTab.dirty && !currentTab.content;

          if (isCurrentEmpty) {
            const effectiveFolder = activeFolderPath === "" ? filePath.replace(/[\\/][^\\/]+$/, "") : activeFolderPath;
            if (effectiveFolder !== activeFolderPath) {
              setActiveFolderPath(effectiveFolder);
              setFolderPath(effectiveFolder);
              getCurrentWindow().setTitle(`Markdown Studio : ${effectiveFolder}`);
            }
            const currentId = activeTabIdRef.current;
            setActiveFile(filePath);
            setContent("");
            setOriginalLines([]);
            setDirty(false);
            reset([]);
            setTabs((prev) =>
              prev.map((t) =>
                t.id === currentId
                  ? { ...t, filePath, folderPath: effectiveFolder, content: "", originalLines: [], tables: [], dirty: false }
                  : t
              )
            );
            folderLastActiveTabRef.current[effectiveFolder] = currentId;
          } else {
            saveCurrentToTab();
            const parentFolder = filePath.replace(/[\\/][^\\/]+$/, "");
            const isUnderActiveFolder = activeFolderPath && (filePath.startsWith(activeFolderPath + "\\") || filePath.startsWith(activeFolderPath + "/"));
            const targetFolder = isUnderActiveFolder ? activeFolderPath : parentFolder;
            if (targetFolder !== activeFolderPath) {
              setActiveFolderPath(targetFolder);
              setFolderPath(targetFolder);
              getCurrentWindow().setTitle(`Markdown Studio : ${targetFolder}`);
            }
            const newTab: Tab = {
              id: crypto.randomUUID(),
              filePath,
              folderPath: targetFolder,
              content: "",
              originalLines: [],
              tables: [],
              dirty: false,
              contentUndoStack: [],
              contentRedoStack: [],
            };
            setTabs((prev) => [...prev, newTab]);
            setActiveTabId(newTab.id);
            setContent("");
            setOriginalLines([]);
            setDirty(false);
            setActiveFile(filePath);
            reset([]);
            folderLastActiveTabRef.current[targetFolder] = newTab.id;
          }
          addRecentFile(filePath);
          return;
        }

        // Markdownファイル
        setOfficeFileData(null);
        setOfficeFileType(null);
        setMindmapFileData(null);
        setMindmapFileType(null);
        clearImagePreview();

        let doc;
        try {
          doc = await invoke("read_markdown_file", { filePath });
        } catch {
          const text = await readTextFile(filePath);
          doc = parseMarkdown(text);
        }

        const text = (doc as { lines: string[] }).lines.join("\n");

        const currentTab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
        const isCurrentEmpty = currentTab && !currentTab.filePath && !currentTab.dirty && !currentTab.content;
        if (isCurrentEmpty) {
          const effectiveFolder = activeFolderPath === "" ? filePath.replace(/[\\/][^\\/]+$/, "") : activeFolderPath;
          if (effectiveFolder !== activeFolderPath) {
            setActiveFolderPath(effectiveFolder);
            setFolderPath(effectiveFolder);
            getCurrentWindow().setTitle(`Markdown Studio : ${effectiveFolder}`);
          }
          const currentId = activeTabIdRef.current;
          setOriginalLines((doc as any).lines);
          reset((doc as any).tables);
          setActiveFile(filePath);
          setContent(text);
          setDirty(false);
          undoStackRef.current = [];
          redoStackRef.current = [];
          setContentUndoAvailable(false);
          setContentRedoAvailable(false);

          setTabs((prev) =>
            prev.map((t) =>
              t.id === currentId
                ? {
                    ...t,
                    filePath,
                    folderPath: effectiveFolder,
                    content: text,
                    originalLines: (doc as any).lines,
                    tables: structuredClone((doc as any).tables),
                    dirty: false,
                    contentUndoStack: [],
                    contentRedoStack: [],
                  }
                : t
            )
          );
          folderLastActiveTabRef.current[effectiveFolder] = currentId;
        } else {
          saveCurrentToTab();
          const parentFolder = filePath.replace(/[\\/][^\\/]+$/, "");
          const isUnderActiveFolder = activeFolderPath && (filePath.startsWith(activeFolderPath + "\\") || filePath.startsWith(activeFolderPath + "/"));
          const targetFolder = isUnderActiveFolder ? activeFolderPath : parentFolder;
          if (targetFolder !== activeFolderPath) {
            setActiveFolderPath(targetFolder);
            setFolderPath(targetFolder);
            getCurrentWindow().setTitle(`Markdown Studio : ${targetFolder}`);
          }
          const newTab: Tab = {
            id: crypto.randomUUID(),
            filePath,
            folderPath: targetFolder,
            content: text,
            originalLines: (doc as any).lines,
            tables: structuredClone((doc as any).tables),
            dirty: false,
            contentUndoStack: [],
            contentRedoStack: [],
          };
          setTabs((prev) => [...prev, newTab]);
          setActiveTabId(newTab.id);
          setContent(text);
          setOriginalLines((doc as any).lines);
          setDirty(false);
          setActiveFile(filePath);
          undoStackRef.current = [];
          redoStackRef.current = [];
          setContentUndoAvailable(false);
          setContentRedoAvailable(false);
          reset((doc as any).tables);
          folderLastActiveTabRef.current[targetFolder] = newTab.id;
        }

        addRecentFile(filePath);
      } catch (e) {
        console.error("ファイル読み込みエラー:", e);
        showToast("ファイル読み込みに失敗しました", true);
      }
    },
    [reset, switchToTab, addRecentFile, saveCurrentToTab, activeFolderPath, showToast]
  );

  // --- Self-write guard for file watcher feedback loop prevention ---
  const lastWriteRef = useRef<number>(0);

  // --- Auto-save interval ---
  useEffect(() => {
    if (!autoSave) return;
    const iv = setInterval(async () => {
      if (!dirtyRef.current || !activeFile) return;
      if (getOfficeExt(activeFile)) return;
      if (getImageExt(activeFile)) return;
      if (activeFile.toLowerCase().endsWith(".xmind")) return;
      try {
        if (getMindmapExt(activeFile)) {
          const json = mindmapEditorRef.current?.getJson();
          if (!json) return;
          lastWriteRef.current = Date.now();
          const jsonStr = JSON.stringify(json, null, 2);
          await writeTextFile(activeFile, jsonStr);
          setMindmapFileData(new TextEncoder().encode(jsonStr));
          setDirty(false);
          const currentId = activeTabIdRef.current;
          setTabs((prev) =>
            prev.map((t) => (t.id === currentId ? { ...t, dirty: false } : t))
          );
        } else {
          lastWriteRef.current = Date.now();
          await writeTextFile(activeFile, contentRef.current);
          setDirty(false);
          const currentId = activeTabIdRef.current;
          setTabs((prev) =>
            prev.map((t) => (t.id === currentId ? { ...t, dirty: false } : t))
          );
        }
        showToast("自動保存しました");
      } catch { /* silent */ }
    }, 30_000);
    return () => clearInterval(iv);
  }, [autoSave, activeFile, showToast]);

  useFileWatcher(activeFile, useCallback(async (changedPath: string) => {
    if (Date.now() - lastWriteRef.current < 2000) return;

    const currentFile = activeFile;
    if (!currentFile) return;

    const normalize = (p: string) => p.replace(/\\/g, "/").toLowerCase();
    if (normalize(changedPath) !== normalize(currentFile)) return;

    if (dirtyRef.current) {
      showToast("外部でファイルが変更されました（未保存の変更があるため再読み込みしません）");
      return;
    }

    if (getMindmapExt(currentFile) || getOfficeExt(currentFile) || getImageExt(currentFile)) return;

    try {
      const text = await readTextFile(currentFile);
      const doc = parseMarkdown(text);
      setContent(text);
      setOriginalLines(doc.lines);
      reset(doc.tables);
      setDirty(false);

      const currentId = activeTabIdRef.current;
      setTabs((prev) =>
        prev.map((t) =>
          t.id === currentId
            ? {
                ...t,
                content: text,
                originalLines: doc.lines,
                tables: structuredClone(doc.tables),
                dirty: false,
              }
            : t
        )
      );
      showToast("外部変更を検知し再読み込みしました");
    } catch (e) {
      console.error("External file reload failed:", e);
    }
  }, [activeFile, reset, showToast]));

  // --- フォルダを開いてタブを作成/切り替えする共通処理 ---
  const openFolderAndActivateTab = useCallback((folderPathArg: string, entries: FileEntry[]) => {
    setFileTree(entries);
    setFolderPath(folderPathArg);
    getCurrentWindow().setTitle(`Markdown Studio : ${folderPathArg}`);
    addRecentFolder(folderPathArg);

    const existingTab = tabsRef.current.find((t) => t.folderPath === folderPathArg);
    if (existingTab) {
      switchToTab(existingTab.id);
      return;
    }

    const allEmpty = tabsRef.current.every((t) => t.folderPath === "");
    const allClean = tabsRef.current.every((t) => !t.dirty && !t.filePath && t.content === "");
    if (allEmpty && allClean) {
      const replacedTab = tabsRef.current[0];
      const updatedTab: Tab = { ...replacedTab, folderPath: folderPathArg };
      setTabs(tabsRef.current.map((t) => (t.id === replacedTab.id ? updatedTab : t)));
      setActiveTabId(updatedTab.id);
      setActiveFolderPath(folderPathArg);
      folderLastActiveTabRef.current[folderPathArg] = updatedTab.id;
      return;
    }

    saveCurrentToTab();
    const newTab = makeInitialTab(folderPathArg);
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setActiveFolderPath(folderPathArg);
    folderLastActiveTabRef.current[folderPathArg] = newTab.id;
    setContent("");
    setOriginalLines([]);
    setActiveFile(null);
    setDirty(false);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setContentUndoAvailable(false);
    setContentRedoAvailable(false);
    reset([]);
    setOfficeFileData(null);
    setOfficeFileType(null);
    setMindmapFileData(null);
    setMindmapFileType(null);
  }, [addRecentFolder, switchToTab, saveCurrentToTab, reset]);

  // --- Folder open ---
  const handleOpenFolder = useCallback(async () => {
    let selected: string | null = null;
    try {
      selected = await open({ directory: true });
    } catch (e) {
      console.error("ダイアログエラー:", e);
      showToast("フォルダ選択ダイアログを開けませんでした", true);
      return;
    }
    if (!selected) return;
    try {
      const entries: FileEntry[] = await invoke("get_file_tree", {
        dirPath: selected,
        includeDocx: filterDocx,
        includeXls: filterXls,
        includeKm: filterKm,
        includeImages: filterImages,
      });
      openFolderAndActivateTab(selected, entries);
    } catch (e) {
      console.error("フォルダ読み込みエラー:", e);
    }
  }, [filterDocx, filterXls, filterKm, filterImages, openFolderAndActivateTab, showToast]);

  // --- Open recent folder ---
  const handleOpenRecentFolder = useCallback(async (path: string) => {
    try {
      const entries: FileEntry[] = await invoke("get_file_tree", {
        dirPath: path,
        includeDocx: filterDocx,
        includeXls: filterXls,
        includeKm: filterKm,
        includeImages: filterImages,
      });
      openFolderAndActivateTab(path, entries);
    } catch (e) {
      console.error("フォルダ読み込みエラー:", e);
      showToast("フォルダを開けませんでした", true);
    }
  }, [filterDocx, filterXls, filterKm, filterImages, openFolderAndActivateTab, showToast]);

  // --- File open ---
  const handleOpenFile = useCallback(async () => {
    let selected: string | null = null;
    try {
      const officeExts: string[] = [];
      if (filterDocx) officeExts.push("docx");
      if (filterXls) officeExts.push("xlsx", "xlsm");
      if (filterKm) officeExts.push("km", "xmind");
      const imageExts: string[] = [];
      if (filterImages) imageExts.push("png", "jpg", "jpeg", "gif", "bmp", "svg", "webp");
      selected = await open({
        filters: [
          { name: "Markdown", extensions: ["md", "markdown", "txt"] },
          ...(officeExts.length > 0 ? [{ name: "Office", extensions: officeExts }] : []),
          ...(imageExts.length > 0 ? [{ name: "Images", extensions: imageExts }] : []),
          { name: "All", extensions: ["*"] },
        ],
      });
    } catch (e) {
      console.error("ダイアログエラー:", e);
      showToast("ファイル選択ダイアログを開けませんでした", true);
      return;
    }
    if (!selected) return;
    await loadFile(selected);
  }, [loadFile, filterDocx, filterXls, filterKm, filterImages, showToast]);

  // --- Save ---
  const handleSave = useCallback(async () => {
    if (!activeFile) return;
    if (getMindmapExt(activeFile)) return;
    try {
      lastWriteRef.current = Date.now();
      if (activeViewTab === "table") {
        await invoke("save_markdown_file", {
          filePath: activeFile,
          originalLines,
          tables,
        });
      } else {
        await writeTextFile(activeFile, content);
      }
      setDirty(false);
      const currentId = activeTabIdRef.current;
      setTabs((prev) =>
        prev.map((t) => (t.id === currentId ? { ...t, dirty: false } : t))
      );
      showToast("保存しました");
    } catch {
      try {
        const text =
          activeViewTab === "table"
            ? rebuildDocument(originalLines, tables)
            : content;
        lastWriteRef.current = Date.now();
        await writeTextFile(activeFile, text);
        setDirty(false);
        showToast("保存しました");
      } catch (e) {
        console.error("保存エラー:", e);
        showToast("保存に失敗しました", true);
      }
    }
  }, [activeFile, activeViewTab, originalLines, tables, content, showToast]);

  // --- Save As ---
  const handleSaveAs = useCallback(async () => {
    let selected: string | null = null;
    try {
      const isMindmap = MINDMAP_EXTENSIONS.some(ext => activeFile?.toLowerCase().endsWith(ext));
      selected = await save({
        filters: isMindmap
          ? [{ name: "Mindmap", extensions: ["km"] }]
          : [{ name: "Markdown", extensions: ["md"] }],
      });
    } catch (e) {
      console.error("ダイアログエラー:", e);
      showToast("保存ダイアログを開けませんでした", true);
      return;
    }
    if (!selected) return;
    try {
      const isMindmap = MINDMAP_EXTENSIONS.some(ext => activeFile?.toLowerCase().endsWith(ext));
      let text: string;
      if (isMindmap) {
        const json = mindmapEditorRef.current?.getJson();
        if (!json) {
          showToast("マインドマップデータを取得できませんでした", true);
          return;
        }
        text = JSON.stringify(json, null, 2);
      } else {
        text = activeViewTab === "table"
          ? rebuildDocument(originalLines, tables)
          : content;
      }
      lastWriteRef.current = Date.now();
      await writeTextFile(selected, text);
      setActiveFile(selected);
      setDirty(false);
      if (isMindmap) {
        setMindmapFileType(".km");
        setMindmapFileData(new TextEncoder().encode(text));
      }
      const currentId = activeTabIdRef.current;
      setTabs((prev) =>
        prev.map((t) =>
          t.id === currentId ? { ...t, filePath: selected, dirty: false } : t
        )
      );
      addRecentFile(selected!);
      showToast("保存しました");
    } catch (e) {
      console.error("保存エラー:", e);
      showToast("保存に失敗しました", true);
    }
  }, [activeFile, activeViewTab, originalLines, tables, content, addRecentFile, showToast]);

  // --- Mindmap save ---
  const handleMindmapSave = useCallback(async (json: KityMinderJson) => {
    if (!activeFile) return;
    try {
      lastWriteRef.current = Date.now();
      const jsonStr = JSON.stringify(json, null, 2);
      const savePath = activeFile.toLowerCase().endsWith(".xmind")
        ? activeFile.replace(/\.xmind$/i, ".km")
        : activeFile;
      await writeTextFile(savePath, jsonStr);
      setDirty(false);
      setMindmapFileData(new TextEncoder().encode(jsonStr));
      setMindmapFileType(".km");
      const currentId = activeTabIdRef.current;
      setTabs((prev) =>
        prev.map((t) => (t.id === currentId ? { ...t, dirty: false, filePath: savePath } : t))
      );
      if (savePath !== activeFile) {
        setActiveFile(savePath);
        showToast(`${savePath.split(/[\\/]/).pop()} に保存しました（.km形式）`);
      } else {
        showToast("保存しました");
      }
    } catch (e) {
      console.error("マインドマップ保存エラー:", e);
      showToast("保存に失敗しました", true);
    }
  }, [activeFile, showToast]);

  // --- Apply content (undo/redo スタックを経由しない低レベル更新) ---
  const applyContent = useCallback(
    (newContent: string) => {
      setContent(newContent);
      setDirty(true);
      const doc = parseMarkdown(newContent);
      setOriginalLines(doc.lines);
      reset(doc.tables);
    },
    [reset]
  );

  // --- Editor content change (undo スタックに積む) ---
  const handleContentChange = useCallback(
    (newContent: string) => {
      undoStackRef.current.push(contentRef.current);
      if (undoStackRef.current.length > 200) undoStackRef.current.shift();
      redoStackRef.current = [];
      setContentUndoAvailable(true);
      setContentRedoAvailable(false);
      applyContent(newContent);
    },
    [applyContent]
  );

  // --- Unified undo/redo ---
  const handleUndo = useCallback(() => {
    if (activeViewTab === "table") {
      undo();
    } else if (undoStackRef.current.length > 0) {
      const prev = undoStackRef.current.pop()!;
      redoStackRef.current.push(contentRef.current);
      setContentUndoAvailable(undoStackRef.current.length > 0);
      setContentRedoAvailable(true);
      applyContent(prev);
    }
  }, [activeViewTab, undo, applyContent]);

  const handleRedo = useCallback(() => {
    if (activeViewTab === "table") {
      redo();
    } else if (redoStackRef.current.length > 0) {
      const next = redoStackRef.current.pop()!;
      undoStackRef.current.push(contentRef.current);
      setContentUndoAvailable(true);
      setContentRedoAvailable(redoStackRef.current.length > 0);
      applyContent(next);
    }
  }, [activeViewTab, redo, applyContent]);

  // --- Table cell operations ---
  const handleUpdateCell = useCallback(
    (tableIndex: number, row: number, col: number, value: string) => {
      updateCell(tableIndex, row, col, value);
      setDirty(true);
    },
    [updateCell]
  );

  const handleAddRow = useCallback(
    (tableIndex: number, afterRow: number, position: "above" | "below") => {
      addRow(tableIndex, afterRow, position);
      setDirty(true);
    },
    [addRow]
  );

  const handleDeleteRow = useCallback(
    (tableIndex: number, row: number) => {
      deleteRow(tableIndex, row);
      setDirty(true);
    },
    [deleteRow]
  );

  const handleAddColumn = useCallback(
    (tableIndex: number, afterCol: number, position: "left" | "right") => {
      addColumn(tableIndex, afterCol, position);
      setDirty(true);
    },
    [addColumn]
  );

  const handleDeleteColumn = useCallback(
    (tableIndex: number, col: number) => {
      deleteColumn(tableIndex, col);
      setDirty(true);
    },
    [deleteColumn]
  );

  // --- テーブル変更をエディタに反映 ---
  useEffect(() => {
    if (activeViewTab === "table" && dirty && originalLines.length > 0) {
      const rebuilt = rebuildDocument(originalLines, tables);
      setContent(rebuilt);
    }
  }, [tables, activeViewTab, dirty, originalLines]);

  // --- タブ切替時にデータ同期 ---
  const handleViewTabChange = useCallback(
    (tab: ViewTab) => {
      if (tab === "table" && activeViewTab === "preview") {
        const doc = parseMarkdown(content);
        setOriginalLines(doc.lines);
        reset(doc.tables);
      }
      setActiveViewTab(tab);
    },
    [activeViewTab, content, reset]
  );

  // --- Extracted hooks: Export, Formatting, AI, Dividers, Shortcuts ---

  const {
    handleExportPdf,
    handleExportHtml,
    handleExportDocx,
    handleExportCsv,
    handleImportCsv,
  } = useExport({
    activeFile,
    previewRef,
    contentRef,
    tables,
    content,
    handleContentChange,
    showToast,
  });

  const { handleInsertFormatting, handleInsertTable, handleInsertToc } = useEditorFormatting({
    editorRef,
    content,
    handleContentChange,
    showToast,
  });

  const {
    aiSettings,
    handleSaveAiSettings,
    showAiGenerate, setShowAiGenerate,
    aiGenerateDesc, setAiGenerateDesc,
    aiGenerating,
    aiGenerateError, setAiGenerateError,
    handleAiGenerateMermaid,
    aiTransformOpen, setAiTransformOpen,
    aiTransformPos, setAiTransformPos,
    aiTransforming,
    savedSelectionRef,
    aiTransformBtnRef,
    handleAiTransform,
    templatePos, setTemplatePos,
    templateBtnRef,
    handleInsertTemplate,
    handleUpdateMermaidBlock,
  } = useAiFeatures({
    editorRef,
    contentRef,
    handleContentChange,
    showToast,
  });

  const { handleMouseDown, handleTerminalMouseDown } = useDividerDrag(
    containerRef, editorRatio, setEditorRatio,
    appBodyRef, terminalRatio, setTerminalRatio,
  );

  // --- Paste from clipboard ---
  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        showToast("クリップボードにテキストがありません", true);
        return;
      }
      setFileTree([]);
      setActiveFile(null);
      undoStackRef.current = [];
      redoStackRef.current = [];
      setContentUndoAvailable(false);
      setContentRedoAvailable(false);
      const doc = parseMarkdown(text);
      setOriginalLines(doc.lines);
      reset(doc.tables);
      setContent(text);
      setDirty(false);

      const currentId = activeTabIdRef.current;
      setTabs((prev) =>
        prev.map((t) =>
          t.id === currentId
            ? { ...t, filePath: null, content: text, dirty: false }
            : t
        )
      );
      showToast("クリップボードから貼り付けました");
    } catch (error) {
      console.error("Clipboard read error:", error);
      showToast("クリップボードの読み取りに失敗しました", true);
    }
  }, [reset, showToast]);

  // --- Copy rich text ---
  const handleCopyRichText = useCallback(async () => {
    const el = previewRef.current;
    if (!el) return;
    try {
      const styledHtml = `<div style="font-family: 'Segoe UI', 'Meiryo', sans-serif; font-size: 14px; line-height: 1.8;">${el.innerHTML}</div>`;
      const htmlBlob = new Blob([styledHtml], { type: "text/html" });
      const textBlob = new Blob([el.innerText], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": htmlBlob,
          "text/plain": textBlob,
        }),
      ]);
      showToast("書式付きでコピーしました (PPT/Excelに貼り付け可能)");
    } catch (error) {
      console.error("Rich text copy error:", error);
      showToast("書式付きコピーに失敗しました", true);
    }
  }, [showToast]);

  // --- Outline heading click ---
  const handleOutlineClick = useCallback((headingId: string) => {
    const preview = previewRef.current;
    if (!preview) return;
    const el = preview.querySelector(`#${headingId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // --- File drag & drop (Tauri ネイティブ API) ---
  const loadFileRef = useRef(loadFile);
  loadFileRef.current = loadFile;
  const handleContentChangeRef = useRef(handleContentChange);
  handleContentChangeRef.current = handleContentChange;

  // --- Image drag from tree to editor (mouse-event based) ---
  const handleImageDragStart = useCallback((path: string) => {
    const ghost = document.createElement("div");
    ghost.textContent = "🖼️ " + (path.split(/[\\/]/).pop() ?? "");
    ghost.style.cssText =
      "position:fixed;pointer-events:none;z-index:9999;background:var(--bg-overlay,#333);color:var(--text,#fff);padding:4px 8px;border-radius:4px;font-size:12px;opacity:0.9;white-space:nowrap;";
    document.body.appendChild(ghost);

    const onMove = (e: MouseEvent) => {
      ghost.style.left = e.clientX + 12 + "px";
      ghost.style.top = e.clientY + 12 + "px";
    };

    const onUp = async (e: MouseEvent) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      ghost.remove();

      const textarea = editorRef.current;
      if (!textarea) return;
      const rect = textarea.getBoundingClientRect();
      if (
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom
      ) return;

      try {
        // Compute relative path from the active markdown file to the image
        const activeFilePath = activeFileRef.current;
        let imageSrc: string;
        if (activeFilePath) {
          const activeDir = activeFilePath.replace(/[\\/][^\\/]+$/, "");
          // Normalize to forward slashes for path computation
          const from = activeDir.replace(/\\/g, "/").split("/");
          const to = path.replace(/\\/g, "/").split("/");
          // Find common prefix length
          let common = 0;
          while (common < from.length && common < to.length && from[common] === to[common]) {
            common++;
          }
          const ups = from.length - common;
          const rel = [...Array(ups).fill(".."), ...to.slice(common)].join("/");
          imageSrc = rel;
        } else {
          imageSrc = path.replace(/\\/g, "/");
        }
        const altText = path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || "image";
        const insertText = `![${altText}](${imageSrc})`;

        const pos = textarea.selectionStart;
        const newContent = contentRef.current.substring(0, pos) + insertText + contentRef.current.substring(pos);
        handleContentChangeRef.current(newContent);
      } catch {
        // ignore
      }
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    (async () => {
      try {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        unlisten = await getCurrentWebview().onDragDropEvent(async (event) => {
          if (event.payload.type !== "drop") return;
          const paths = event.payload.paths;
          if (!paths || paths.length === 0) return;
          const dropPosition = (event.payload as { position?: { x: number; y: number } }).position;

          const mdExtensions = [".md", ".markdown", ".txt"];
          const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".webp"];
          const officeExtensions = [".docx", ".xlsx", ".xlsm"];

          for (const filePath of paths) {
            const ext = filePath.toLowerCase().replace(/^.*(\.[^.]+)$/, "$1");

            if (mdExtensions.includes(ext) || officeExtensions.includes(ext)) {
              await loadFileRef.current(filePath);
            } else if (imageExtensions.includes(ext)) {
              const textarea = editorRef.current;
              if (!textarea) continue;
              try {
                const { convertFileSrc } = await import("@tauri-apps/api/core");
                const assetUrl = convertFileSrc(filePath);
                const altText = filePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || "image";
                const insertText = `![${altText}](${assetUrl})`;

                // Determine insert position from drop coordinates
                let pos = textarea.selectionStart;
                if (dropPosition) {
                  const el = document.elementFromPoint(dropPosition.x, dropPosition.y);
                  if (el === textarea) {
                    // Create a temporary collapsed range at the drop point to find the text offset
                    const range = document.caretRangeFromPoint(dropPosition.x, dropPosition.y);
                    if (range) {
                      // For textarea, calculate offset by using a hidden mirror approach
                      // caretRangeFromPoint doesn't work directly on textarea content,
                      // so we use the textarea's own coordinate-based calculation
                      const rect = textarea.getBoundingClientRect();
                      const style = window.getComputedStyle(textarea);
                      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
                      const paddingTop = parseFloat(style.paddingTop);
                      const paddingLeft = parseFloat(style.paddingLeft);
                      const relX = dropPosition.x - rect.left - paddingLeft;
                      const relY = dropPosition.y - rect.top - paddingTop + textarea.scrollTop;

                      const lines = contentRef.current.split("\n");
                      const targetLineIndex = Math.min(Math.floor(relY / lineHeight), lines.length - 1);

                      // Measure character width using canvas
                      const canvas = document.createElement("canvas");
                      const ctx = canvas.getContext("2d");
                      if (ctx && targetLineIndex >= 0) {
                        ctx.font = `${style.fontSize} ${style.fontFamily}`;
                        const line = lines[targetLineIndex];
                        let charIndex = line.length;
                        for (let i = 0; i <= line.length; i++) {
                          const w = ctx.measureText(line.substring(0, i)).width;
                          if (w >= relX) {
                            charIndex = i > 0 && (w - relX) > (relX - ctx.measureText(line.substring(0, i - 1)).width) ? i - 1 : i;
                            break;
                          }
                        }
                        // Convert line + charIndex to absolute position
                        let absPos = 0;
                        for (let i = 0; i < targetLineIndex; i++) {
                          absPos += lines[i].length + 1; // +1 for \n
                        }
                        absPos += charIndex;
                        pos = Math.min(absPos, contentRef.current.length);
                      }
                    }
                  }
                }

                const newContent =
                  contentRef.current.substring(0, pos) +
                  insertText +
                  contentRef.current.substring(pos);
                handleContentChangeRef.current(newContent);
              } catch {
                // fallback
              }
            }
          }
        });
      } catch (e) {
        console.error("Failed to register drag-drop handler:", e);
      }
    })();

    return () => { unlisten?.(); };
  }, []);

  // --- Keyboard shortcuts ---
  useKeyboardShortcuts({
    handleSave,
    handleUndo,
    handleRedo,
    handleCopyRichText,
    handleInsertFormatting,
    activeViewTab,
    openNewTab,
    closeTab,
    setShowSearch,
    setEditorVisible,
    setTerminalVisible,
    tabsRef,
    activeTabIdRef,
  });

  // --- Close dropdowns on outside click ---
  useEffect(() => {
    if (!aiTransformOpen && !templatePos) return;
    const handleClick = () => {
      setAiTransformOpen(false);
      setAiTransformPos(null);
      setTemplatePos(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [aiTransformOpen, templatePos, setAiTransformOpen, setAiTransformPos, setTemplatePos]);

  // 現在のファイルがOfficeかどうか
  const isOfficeFile = !!(officeFileData && officeFileType);
  const isMindmap = !!(mindmapFileData && mindmapFileType && activeFile);
  const isImageFile = !!imageBlobUrl;

  const toolbarCanUndo = activeViewTab === "table" ? canUndo : contentUndoAvailable;
  const toolbarCanRedo = activeViewTab === "table" ? canRedo : contentRedoAvailable;

  return (
    <div className="app">
      <Toolbar
        dirty={dirty}
        canUndo={toolbarCanUndo}
        canRedo={toolbarCanRedo}
        theme={theme}
        activeViewTab={activeViewTab}
        editorVisible={editorVisible}
        recentFiles={recentFiles}
        recentFolders={recentFolders}
        onOpenFolder={handleOpenFolder}
        onOpenRecentFolder={handleOpenRecentFolder}
        onOpenFile={handleOpenFile}
        onOpenRecent={loadFile}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onToggleSearch={() => setShowSearch((s) => !s)}
        onToggleTheme={toggleTheme}
        onPasteFromClipboard={handlePasteFromClipboard}
        terminalVisible={terminalVisible}
        onToggleEditor={() => setEditorVisible((v) => !v)}
        onToggleTerminal={() => setTerminalVisible((v) => !v)}
        onOpenSettings={() => setShowSettings(true)}
      />

      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        activeFolderPath={activeFolderPath}
        onSelectTab={switchToTab}
        onCloseTab={closeTab}
        onNewTab={openNewTab}
        onSelectFolder={switchToFolder}
        onCloseFolder={closeFolderTabs}
      />

      {showSearch && (
        activeViewTab === "table" ? (
          <SearchReplace
            tables={tables}
            onReplace={handleUpdateCell}
            onClose={() => setShowSearch(false)}
          />
        ) : (
          <SearchReplace
            textContent={content}
            onTextReplace={handleContentChange}
            onClose={() => setShowSearch(false)}
          />
        )
      )}

      <div className="app-body" ref={appBodyRef}>
        <LeftPanel
          leftPanel={leftPanel}
          setLeftPanel={setLeftPanel}
          fileTree={fileTree}
          activeFile={activeFile}
          onSelectFile={loadFile}
          onRefresh={refreshFileTree}
          filterDocx={filterDocx}
          filterXls={filterXls}
          filterKm={filterKm}
          filterImages={filterImages}
          onToggleDocx={toggleFilterDocx}
          onToggleXls={toggleFilterXls}
          onToggleKm={toggleFilterKm}
          onToggleImages={toggleFilterImages}
          showDocxBtn={showDocxBtn}
          showXlsBtn={showXlsBtn}
          showKmBtn={showKmBtn}
          showImagesBtn={showImagesBtn}
          onImageDragStart={handleImageDragStart}
          content={content}
          onHeadingClick={handleOutlineClick}
        />

        {isMindmap ? (
          <div className="content-area" style={{ display: "flex", flexDirection: "row" }}>
            <MindmapEditor
              ref={mindmapEditorRef}
              fileData={mindmapFileData}
              fileType={mindmapFileType}
              filePath={activeFile}
              theme={theme}
              onSave={handleMindmapSave}
              onDirtyChange={(d) => {
                setDirty(d);
                const currentId = activeTabIdRef.current;
                setTabs((prev) =>
                  prev.map((t) => (t.id === currentId ? { ...t, dirty: d } : t))
                );
              }}
            />
          </div>
        ) : isOfficeFile ? (
          <div className="content-area" style={{ display: "flex", flexDirection: "row" }}>
            <PreviewPanel
              content=""
              filePath={activeFile}
              theme={theme}
              officeFileData={officeFileData}
              officeFileType={officeFileType}
              onOpenFile={loadFile}
              onRefreshFileTree={refreshFileTree}
            />
          </div>
        ) : isImageFile ? (
          <div className="content-area image-preview-area">
            <img
              src={imageBlobUrl!}
              alt={activeFile?.replace(/^.*[\\/]/, "") ?? ""}
              className="image-preview-img"
            />
          </div>
        ) : (
          <div
            className="content-area"
            style={{ display: "flex", flexDirection: "row" }}
            ref={containerRef}
          >
            {editorVisible && (
              <>
                <EditorPanel
                  content={content}
                  editorRef={editorRef}
                  editorRatio={editorRatio}
                  syncScroll={syncScroll}
                  onToggleSyncScroll={() => setSyncScroll((v) => !v)}
                  onContentChange={handleContentChange}
                  onInsertFormatting={handleInsertFormatting}
                  onInsertToc={handleInsertToc}
                  onImportCsv={handleImportCsv}
                  showTableGrid={showTableGrid}
                  setShowTableGrid={setShowTableGrid}
                  tableGridBtnRef={tableGridBtnRef}
                  onInsertTable={handleInsertTable}
                  aiSettings={aiSettings}
                  showSettings={showSettings}
                  setShowSettings={setShowSettings}
                  showToast={showToast}
                  aiTransformOpen={aiTransformOpen}
                  setAiTransformOpen={setAiTransformOpen}
                  aiTransformPos={aiTransformPos}
                  setAiTransformPos={setAiTransformPos}
                  aiTransforming={aiTransforming}
                  savedSelectionRef={savedSelectionRef}
                  aiTransformBtnRef={aiTransformBtnRef}
                  setShowAiGenerate={setShowAiGenerate}
                  setAiGenerateError={setAiGenerateError}
                  templatePos={templatePos}
                  setTemplatePos={setTemplatePos}
                  templateBtnRef={templateBtnRef}
                />
                <div className="divider" onMouseDown={handleMouseDown} />
              </>
            )}
            {activeViewTab === "preview" ? (
              <PreviewPanel
                content={content}
                filePath={activeFile}
                previewRef={previewRef}
                aiSettings={aiSettings}
                onUpdateMermaidBlock={handleUpdateMermaidBlock}
                theme={theme}
                officeFileData={officeFileData}
                officeFileType={officeFileType}
                onOpenFile={loadFile}
                onRefreshFileTree={refreshFileTree}
                activeViewTab={activeViewTab}
                onViewTabChange={handleViewTabChange}
                onExportPdf={handleExportPdf}
                onExportHtml={handleExportHtml}
                onExportDocx={handleExportDocx}
                onCopyRichText={handleCopyRichText}
              />
            ) : (
              <div className="preview-panel-wrapper">
                <div className="preview-panel-header">
                  <button
                    className="view-tab"
                    onClick={() => handleViewTabChange("preview")}
                  >
                    プレビュー
                  </button>
                  <button
                    className="view-tab active"
                    onClick={() => handleViewTabChange("table")}
                  >
                    テーブル編集
                  </button>
                </div>
                <TableEditor
                  tables={tables}
                  onUpdateCell={handleUpdateCell}
                  onAddRow={handleAddRow}
                  onDeleteRow={handleDeleteRow}
                  onAddColumn={handleAddColumn}
                  onDeleteColumn={handleDeleteColumn}
                  onExportCsv={handleExportCsv}
                />
              </div>
            )}
          </div>
        )}

        {terminalVisible && (
          <>
            <div className="divider" onMouseDown={handleTerminalMouseDown} />
            <div
              className="terminal-panel"
              style={{ flex: `0 0 ${terminalRatio}%` }}
            >
              <div className="terminal-panel-header">
                <span>ターミナル</span>
              </div>
              <Terminal
                cwd={activeFile ? activeFile.replace(/[\\/][^\\/]*$/, "") : folderPath ?? "C:\\"}
                visible={terminalVisible}
                theme={theme}
              />
            </div>
          </>
        )}
      </div>

      <StatusBar
        content={content}
        autoSave={autoSave}
        onToggleAutoSave={() => setAutoSave((v) => !v)}
        activeFilePath={activeFile}
      />

      {showSettings && (
        <Settings
          settings={aiSettings}
          onSave={handleSaveAiSettings}
          onClose={() => setShowSettings(false)}
          filterVisibility={{ showDocx: showDocxBtn, showXls: showXlsBtn, showKm: showKmBtn, showImages: showImagesBtn }}
          onSaveFilterVisibility={handleSaveFilterVisibility}
        />
      )}

      {/* Feature 3: Mermaid Template dropdown */}
      {templatePos && (
        <div
          className="ai-floating-dropdown"
          style={{ left: templatePos.x, top: templatePos.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {MERMAID_TEMPLATES.map((t) => (
            <button
              key={t.label}
              className="ai-dropdown-item"
              onMouseDown={(e) => {
                e.preventDefault();
                handleInsertTemplate(t.code);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Feature 2: AI Transform dropdown */}
      {aiTransformOpen && aiTransformPos && (
        <div
          className="ai-floating-dropdown"
          style={{ left: aiTransformPos.x, top: aiTransformPos.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {TRANSFORM_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              className="ai-dropdown-item"
              onMouseDown={(e) => {
                e.preventDefault();
                handleAiTransform(opt.prompt);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Feature 1: AI Mermaid Generate modal */}
      {showAiGenerate && (
        <AiGenerateModal
          aiGenerateDesc={aiGenerateDesc}
          setAiGenerateDesc={setAiGenerateDesc}
          aiGenerating={aiGenerating}
          aiGenerateError={aiGenerateError}
          onGenerate={handleAiGenerateMermaid}
          onClose={() => { setShowAiGenerate(false); setAiGenerateDesc(""); setAiGenerateError(""); }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`toast ${toast.isError ? "toast-error" : "toast-success"}`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default App;
