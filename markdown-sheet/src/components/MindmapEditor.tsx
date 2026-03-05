import { type FC, useCallback, useEffect, useRef, useState } from "react";
import type { KityMinderJson, MinderInstance } from "../lib/mindmapTypes";
import { parseXmindFile } from "../lib/xmindParser";
import MindmapToolbar from "./MindmapToolbar";
import "./MindmapEditor.css";

interface Props {
  fileData: Uint8Array;
  fileType: string; // ".km" or ".xmind"
  filePath: string;
  theme: "light" | "dark";
  onSave: (json: KityMinderJson) => void;
  onDirtyChange: (dirty: boolean) => void;
}

const MAX_UNDO = 100;

const MindmapEditor: FC<Props> = ({ fileData, fileType, filePath, theme, onSave, onDirtyChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const minderRef = useRef<MinderInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState("fresh-blue");
  const [currentLayout, setCurrentLayout] = useState("right");
  const [dirty, setDirty] = useState(false);

  // Undo/Redo via JSON snapshots
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const isUndoingRef = useRef(false);
  const initializedRef = useRef(false);

  const pushSnapshot = useCallback(() => {
    if (isUndoingRef.current || !minderRef.current) return;
    const json = JSON.stringify(minderRef.current.exportJson());
    const stack = undoStackRef.current;
    if (stack.length > 0 && stack[stack.length - 1] === json) return;
    stack.push(json);
    if (stack.length > MAX_UNDO) stack.shift();
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const handleUndo = useCallback(() => {
    const minder = minderRef.current;
    if (!minder || undoStackRef.current.length === 0) return;
    isUndoingRef.current = true;
    // Save current state to redo
    redoStackRef.current.push(JSON.stringify(minder.exportJson()));
    const prev = undoStackRef.current.pop()!;
    minder.importJson(JSON.parse(prev));
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
    isUndoingRef.current = false;
  }, []);

  const handleRedo = useCallback(() => {
    const minder = minderRef.current;
    if (!minder || redoStackRef.current.length === 0) return;
    isUndoingRef.current = true;
    undoStackRef.current.push(JSON.stringify(minder.exportJson()));
    const next = redoStackRef.current.pop()!;
    minder.importJson(JSON.parse(next));
    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
    isUndoingRef.current = false;
  }, []);

  // Initialize minder
  useEffect(() => {
    if (!containerRef.current || !window.kityminder) {
      setError("kityminder-core が読み込まれていません");
      return;
    }

    const minder = new window.kityminder.Minder({
      enableKeyReceiver: true,
      enableAnimation: true,
    });
    minderRef.current = minder;
    minder.renderTo(containerRef.current);

    // Load data
    const loadData = async () => {
      try {
        let jsonData: KityMinderJson;

        if (fileType === ".xmind") {
          jsonData = await parseXmindFile(fileData);
        } else {
          // .km format is JSON
          const text = new TextDecoder().decode(fileData);
          jsonData = JSON.parse(text) as KityMinderJson;
        }

        minder.importJson(jsonData);

        // Apply theme and layout from file
        if (jsonData.theme) {
          setCurrentTheme(jsonData.theme);
        }
        if (jsonData.template) {
          setCurrentLayout(jsonData.template === "default" ? "right" : jsonData.template);
        }

        // Take initial snapshot
        undoStackRef.current = [];
        redoStackRef.current = [];
        setCanUndo(false);
        setCanRedo(false);
        setDirty(false);
        onDirtyChange(false);
        initializedRef.current = true;
      } catch (e) {
        console.error("マインドマップの読み込みエラー:", e);
        setError(`ファイルの読み込みに失敗しました: ${e instanceof Error ? e.message : String(e)}`);
      }
    };

    loadData();

    return () => {
      // Cleanup: remove SVG from DOM
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      minderRef.current = null;
      initializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileData, fileType, filePath]);

  // Listen for content changes
  useEffect(() => {
    const minder = minderRef.current;
    if (!minder) return;

    const handleChange = () => {
      if (!initializedRef.current) return;
      pushSnapshot();
      if (!dirty) {
        setDirty(true);
        onDirtyChange(true);
      }
    };

    minder.on("contentchange", handleChange);
    return () => {
      minder.off("contentchange", handleChange);
    };
  }, [dirty, pushSnapshot, onDirtyChange]);

  // Dark mode background
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.background = theme === "dark" ? "#1e1e2e" : "#ffffff";
    }
  }, [theme]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const minder = minderRef.current;
      if (!minder) return;

      // Check if focus is within our container
      const container = containerRef.current;
      if (!container) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "s") {
          e.preventDefault();
          handleSave();
        } else if (e.key === "z") {
          e.preventDefault();
          handleUndo();
        } else if (e.key === "y") {
          e.preventDefault();
          handleRedo();
        }
      }

      // Let kityminder handle Tab, Enter, Delete, F2 natively
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleUndo, handleRedo]);

  const handleSave = useCallback(() => {
    const minder = minderRef.current;
    if (!minder) return;
    const json = minder.exportJson();
    // Preserve theme and layout
    json.theme = currentTheme;
    json.template = currentLayout;
    onSave(json);
    setDirty(false);
    onDirtyChange(false);
  }, [currentTheme, currentLayout, onSave, onDirtyChange]);

  const handleChangeTheme = useCallback((themeId: string) => {
    const minder = minderRef.current;
    if (!minder) return;
    pushSnapshot();
    minder.execCommand("Theme", themeId);
    setCurrentTheme(themeId);
    if (!dirty) {
      setDirty(true);
      onDirtyChange(true);
    }
  }, [pushSnapshot, dirty, onDirtyChange]);

  const handleChangeLayout = useCallback((layoutId: string) => {
    const minder = minderRef.current;
    if (!minder) return;
    pushSnapshot();
    minder.execCommand("Template", layoutId);
    setCurrentLayout(layoutId);
    if (!dirty) {
      setDirty(true);
      onDirtyChange(true);
    }
  }, [pushSnapshot, dirty, onDirtyChange]);

  const handleAddChild = useCallback(() => {
    const minder = minderRef.current;
    if (!minder) return;
    pushSnapshot();
    minder.execCommand("AppendChildNode");
  }, [pushSnapshot]);

  const handleAddSibling = useCallback(() => {
    const minder = minderRef.current;
    if (!minder) return;
    pushSnapshot();
    minder.execCommand("AppendSiblingNode");
  }, [pushSnapshot]);

  const handleDeleteNode = useCallback(() => {
    const minder = minderRef.current;
    if (!minder) return;
    pushSnapshot();
    minder.execCommand("RemoveNode");
  }, [pushSnapshot]);

  const handleSetPriority = useCallback((p: number) => {
    const minder = minderRef.current;
    if (!minder) return;
    pushSnapshot();
    minder.execCommand("Priority", p);
  }, [pushSnapshot]);

  const handleSetProgress = useCallback((p: number) => {
    const minder = minderRef.current;
    if (!minder) return;
    pushSnapshot();
    minder.execCommand("Progress", p);
  }, [pushSnapshot]);

  if (error) {
    return (
      <div className="mindmap-error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="mindmap-editor">
      <MindmapToolbar
        currentTheme={currentTheme}
        currentLayout={currentLayout}
        dirty={dirty}
        canUndo={canUndo}
        canRedo={canRedo}
        onChangeTheme={handleChangeTheme}
        onChangeLayout={handleChangeLayout}
        onAddChild={handleAddChild}
        onAddSibling={handleAddSibling}
        onDeleteNode={handleDeleteNode}
        onSetPriority={handleSetPriority}
        onSetProgress={handleSetProgress}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSave={handleSave}
      />
      <div className="mindmap-container" ref={containerRef} />
    </div>
  );
};

export default MindmapEditor;
