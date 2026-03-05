import { type FC, useCallback, useEffect, useRef, useState } from "react";
import type { KityMinderJson, MinderInstance, MinderNodeInstance } from "../lib/mindmapTypes";
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

  // Inline text editing state
  const editingRef = useRef(false);
  const editInputRef = useRef<HTMLTextAreaElement | null>(null);
  const editNodeRef = useRef<MinderNodeInstance | null>(null);
  const startEditNodeRef = useRef<(node: MinderNodeInstance) => void>(() => {});

  const markDirty = useCallback(() => {
    setDirty(true);
    onDirtyChange(true);
  }, [onDirtyChange]);

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

  /** Start inline editing for the given node */
  const startEditNode = useCallback((node: MinderNodeInstance) => {
    const minder = minderRef.current;
    const container = containerRef.current;
    if (!minder || !container || editingRef.current) return;

    // Get the node's bounding box via the underlying SVG DOM element
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeAny = node as any;
    const nodeRC = nodeAny.getRenderContainer?.() || nodeAny.rc;
    if (!nodeRC) return;

    const svgEl: SVGElement | undefined = nodeRC.node;
    if (!svgEl) return;

    const paperBox = svgEl.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const x = paperBox.x - containerRect.left;
    const y = paperBox.y - containerRect.top;
    const w = Math.max(paperBox.width, 60);
    const h = Math.max(paperBox.height, 24);

    editingRef.current = true;
    editNodeRef.current = node;

    const textarea = document.createElement("textarea");
    textarea.className = "km-edit-textarea";
    textarea.value = node.getText() || "";
    textarea.style.position = "absolute";
    textarea.style.left = `${x - 4}px`;
    textarea.style.top = `${y - 2}px`;
    textarea.style.minWidth = `${w + 8}px`;
    textarea.style.minHeight = `${h + 4}px`;
    textarea.style.zIndex = "200";

    const cleanup = () => {
      editingRef.current = false;
      editNodeRef.current = null;
      textarea.remove();
      editInputRef.current = null;
      document.removeEventListener("mousedown", handleClickOutside, true);
      // Re-focus the minder's key receiver so keyboard navigation resumes
      minder.focus();
    };

    const commitEdit = () => {
      if (!editingRef.current) return;
      const newText = textarea.value.trim();
      const oldText = node.getText() || "";
      cleanup();

      if (newText && newText !== oldText) {
        pushSnapshot();
        // Re-select the node before executing the text command
        minder.select([node], true);
        minder.execCommand("text", newText);
        markDirty();
      }
    };

    const cancelEdit = () => {
      cleanup();
    };

    // Click outside the textarea to commit
    const handleClickOutside = (e: MouseEvent) => {
      if (editingRef.current && !textarea.contains(e.target as Node)) {
        commitEdit();
      }
    };

    textarea.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commitEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    });

    // Prevent minder from stealing focus via mouse events on the textarea
    textarea.addEventListener("mousedown", (e) => e.stopPropagation());
    textarea.addEventListener("pointerdown", (e) => e.stopPropagation());

    // Use click-outside instead of blur to commit (avoids focus-stealing race)
    document.addEventListener("mousedown", handleClickOutside, true);

    editInputRef.current = textarea;
    container.appendChild(textarea);

    // Focus after a frame to avoid kityminder's event processing stealing focus
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.select();
    });
  }, [pushSnapshot, markDirty]);

  // Keep the ref in sync so event handlers always use the latest function
  startEditNodeRef.current = startEditNode;

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

    // Register dblclick handler on the minder instance (not DOM) so it fires
    // reliably even when kityminder processes the event internally
    const handleDblClick = () => {
      if (editingRef.current) return;
      const selected = minder.getSelectedNode();
      if (selected) {
        startEditNodeRef.current(selected);
      }
    };
    minder.on("dblclick", handleDblClick);

    // Also listen for DOM dblclick on the container as a fallback
    const containerEl = containerRef.current;
    const handleDomDblClick = () => {
      if (editingRef.current) return;
      const selected = minder.getSelectedNode();
      if (selected) {
        startEditNodeRef.current(selected);
      }
    };
    containerEl.addEventListener("dblclick", handleDomDblClick);

    return () => {
      minder.off("dblclick", handleDblClick);
      containerEl.removeEventListener("dblclick", handleDomDblClick);
      // Cleanup: remove SVG from DOM
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      minderRef.current = null;
      initializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileData, fileType, filePath]);

  // Listen for content changes and set default text on newly added empty nodes
  useEffect(() => {
    const minder = minderRef.current;
    if (!minder) return;

    const handleChange = () => {
      if (!initializedRef.current) return;
      // Check if the selected node has empty text (just added by Enter/Tab)
      const selected = minder.getSelectedNode();
      if (selected && !selected.isRoot() && !selected.getText()) {
        const parent = selected.getParent();
        if (parent) {
          const siblingCount = parent.getChildren().length;
          selected.setText(`サブトピック ${siblingCount}`);
          // Re-render the node to reflect the text change
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (selected as any).render?.();
          minder.layout(0);
        }
      }
      pushSnapshot();
      if (!dirty) {
        markDirty();
      }
    };

    minder.on("contentchange", handleChange);
    return () => {
      minder.off("contentchange", handleChange);
    };
  }, [dirty, pushSnapshot, markDirty]);

  // Dark mode background
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.background = theme === "dark" ? "#1e1e2e" : "#ffffff";
    }
  }, [theme]);

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
      markDirty();
    }
  }, [pushSnapshot, dirty, markDirty]);

  const handleChangeLayout = useCallback((layoutId: string) => {
    const minder = minderRef.current;
    if (!minder) return;
    pushSnapshot();
    minder.execCommand("Template", layoutId);
    setCurrentLayout(layoutId);
    if (!dirty) {
      markDirty();
    }
  }, [pushSnapshot, dirty, markDirty]);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if currently editing a node
      if (editingRef.current) return;

      const minder = minderRef.current;
      if (!minder) return;

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

      // F2 to edit selected node text
      if (e.key === "F2") {
        e.preventDefault();
        const selected = minder.getSelectedNode();
        if (selected) {
          startEditNodeRef.current(selected);
        }
      }

    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleUndo, handleRedo, startEditNode, handleSave]);

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
