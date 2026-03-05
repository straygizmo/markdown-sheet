import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
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

const URL_REGEX = /^(https?|ftp):\/\/.+/i;

/** Show hyperlink dialog (pure DOM modal) */
function showHyperlinkDialog(
  minder: MinderInstance,
  pushSnapshot: () => void,
  markDirty: () => void,
): void {
  const existing = minder.queryCommandValue("HyperLink") as { url?: string; title?: string } | null;

  const overlay = document.createElement("div");
  overlay.className = "km-modal-overlay";

  const dialog = document.createElement("div");
  dialog.className = "km-modal-dialog";

  const header = document.createElement("div");
  header.className = "km-modal-header";
  header.innerHTML = `<span>リンク</span><button class="km-modal-close">&times;</button>`;

  const body = document.createElement("div");
  body.className = "km-modal-body";
  body.innerHTML = `
    <label>URL</label>
    <input type="text" id="km-link-url" placeholder="https://example.com" />
    <div class="km-error-text" id="km-link-error" style="display:none">有効なURL (http/https/ftp) を入力してください</div>
    <label>タイトル (任意)</label>
    <input type="text" id="km-link-title" placeholder="リンクのタイトル" />
  `;

  const footer = document.createElement("div");
  footer.className = "km-modal-footer";
  footer.innerHTML = `
    <button class="km-btn-cancel">キャンセル</button>
    <button class="km-btn-primary" id="km-link-ok">OK</button>
  `;

  dialog.appendChild(header);
  dialog.appendChild(body);
  dialog.appendChild(footer);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const urlInput = body.querySelector("#km-link-url") as HTMLInputElement;
  const titleInput = body.querySelector("#km-link-title") as HTMLInputElement;
  const errorDiv = body.querySelector("#km-link-error") as HTMLDivElement;

  if (existing?.url) {
    urlInput.value = existing.url;
    titleInput.value = existing.title || "";
  }

  const close = () => overlay.remove();

  const ok = () => {
    const url = urlInput.value.trim();
    if (!URL_REGEX.test(url)) {
      errorDiv.style.display = "";
      urlInput.focus();
      return;
    }
    close();
    pushSnapshot();
    minder.execCommand("HyperLink", url, titleInput.value.trim());
    markDirty();
  };

  header.querySelector(".km-modal-close")!.addEventListener("click", close);
  footer.querySelector(".km-btn-cancel")!.addEventListener("click", close);
  footer.querySelector("#km-link-ok")!.addEventListener("click", ok);
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close();
  });

  urlInput.addEventListener("input", () => {
    errorDiv.style.display = "none";
  });
  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") ok();
    if (e.key === "Escape") close();
  });
  titleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") ok();
    if (e.key === "Escape") close();
  });

  requestAnimationFrame(() => {
    urlInput.focus();
    urlInput.select();
  });
}

/** Show image dialog (pure DOM modal with URL / file tabs) */
function showImageDialog(
  minder: MinderInstance,
  pushSnapshot: () => void,
  markDirty: () => void,
): void {
  const existing = minder.queryCommandValue("Image") as { url?: string; title?: string } | null;

  const overlay = document.createElement("div");
  overlay.className = "km-modal-overlay";

  const dialog = document.createElement("div");
  dialog.className = "km-modal-dialog";

  const header = document.createElement("div");
  header.className = "km-modal-header";
  header.innerHTML = `<span>画像</span><button class="km-modal-close">&times;</button>`;

  const body = document.createElement("div");
  body.className = "km-modal-body";
  body.innerHTML = `
    <div class="km-tab-bar">
      <button class="km-tab-active" data-tab="url">URL指定</button>
      <button data-tab="file">ファイル選択</button>
    </div>
    <div id="km-img-tab-url">
      <label>画像URL</label>
      <input type="text" id="km-img-url" placeholder="https://example.com/image.png" />
      <label>タイトル (任意)</label>
      <input type="text" id="km-img-title" placeholder="画像のタイトル" />
    </div>
    <div id="km-img-tab-file" style="display:none">
      <div class="km-file-input-wrapper">
        <input type="file" id="km-img-file" accept="image/*" />
      </div>
    </div>
    <img class="km-image-preview" id="km-img-preview" style="display:none" />
  `;

  const footer = document.createElement("div");
  footer.className = "km-modal-footer";
  footer.innerHTML = `
    <button class="km-btn-cancel">キャンセル</button>
    <button class="km-btn-primary" id="km-img-ok">OK</button>
  `;

  dialog.appendChild(header);
  dialog.appendChild(body);
  dialog.appendChild(footer);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const urlInput = body.querySelector("#km-img-url") as HTMLInputElement;
  const titleInput = body.querySelector("#km-img-title") as HTMLInputElement;
  const fileInput = body.querySelector("#km-img-file") as HTMLInputElement;
  const preview = body.querySelector("#km-img-preview") as HTMLImageElement;
  const tabUrl = body.querySelector("#km-img-tab-url") as HTMLDivElement;
  const tabFile = body.querySelector("#km-img-tab-file") as HTMLDivElement;
  const tabButtons = body.querySelectorAll(".km-tab-bar button");

  let currentUrl = existing?.url || "";
  let currentTitle = existing?.title || "";

  if (currentUrl) {
    urlInput.value = currentUrl;
    titleInput.value = currentTitle;
    preview.src = currentUrl;
    preview.style.display = "";
  }

  // Tab switching
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("km-tab-active"));
      btn.classList.add("km-tab-active");
      const tab = btn.getAttribute("data-tab");
      tabUrl.style.display = tab === "url" ? "" : "none";
      tabFile.style.display = tab === "file" ? "" : "none";
    });
  });

  // URL input preview
  urlInput.addEventListener("blur", () => {
    const url = urlInput.value.trim();
    if (url) {
      currentUrl = url;
      preview.src = url;
      preview.style.display = "";
    }
  });

  // File input
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      currentUrl = reader.result as string;
      currentTitle = titleInput.value.trim() || file.name;
      preview.src = currentUrl;
      preview.style.display = "";
    };
    reader.readAsDataURL(file);
  });

  const close = () => overlay.remove();

  const ok = () => {
    const url = currentUrl || urlInput.value.trim();
    if (!url) return;
    close();
    pushSnapshot();
    minder.execCommand("Image", url, titleInput.value.trim() || currentTitle);
    markDirty();
  };

  header.querySelector(".km-modal-close")!.addEventListener("click", close);
  footer.querySelector(".km-btn-cancel")!.addEventListener("click", close);
  footer.querySelector("#km-img-ok")!.addEventListener("click", ok);
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  requestAnimationFrame(() => urlInput.focus());
}

/** Show note editor panel (appended to mindmap container, pure DOM) */
function showNoteEditor(
  container: HTMLElement,
  minder: MinderInstance,
  pushSnapshot: () => void,
  markDirty: () => void,
): void {
  // If already open, just focus it
  const existing = container.querySelector(".km-note-panel");
  if (existing) {
    (existing.querySelector("textarea") as HTMLTextAreaElement)?.focus();
    return;
  }

  const panel = document.createElement("div");
  panel.className = "km-note-panel";

  const headerDiv = document.createElement("div");
  headerDiv.className = "km-note-panel-header";
  headerDiv.innerHTML = `<span>ノート (Markdown)</span><button title="閉じる">&times;</button>`;

  const textarea = document.createElement("textarea");
  textarea.placeholder = "マークダウンテキストを入力...";

  const noteContent = minder.queryCommandValue("Note") as string || "";
  textarea.value = noteContent;

  panel.appendChild(headerDiv);
  panel.appendChild(textarea);
  container.appendChild(panel);

  const close = () => panel.remove();

  headerDiv.querySelector("button")!.addEventListener("click", close);

  textarea.addEventListener("input", () => {
    pushSnapshot();
    minder.execCommand("Note", textarea.value);
    markDirty();
  });

  // Track which node we opened the editor for
  const openedForNode = minder.getSelectedNode();

  // When selection changes: close panel if a different node is selected
  const handleSelectionChange = () => {
    const current = minder.getSelectedNode();
    if (current !== openedForNode) {
      close();
      return;
    }
    const val = minder.queryCommandValue("Note") as string || "";
    textarea.value = val;
  };
  minder.on("selectionchange", handleSelectionChange);

  // Prevent keyboard events from reaching minder
  textarea.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") close();
  });
  textarea.addEventListener("mousedown", (e) => e.stopPropagation());

  // Cleanup minder listener when panel is removed
  const observer = new MutationObserver(() => {
    if (!container.contains(panel)) {
      minder.off("selectionchange", handleSelectionChange);
      observer.disconnect();
    }
  });
  observer.observe(container, { childList: true });

  requestAnimationFrame(() => textarea.focus());
}

/** Build the context menu DOM tree (pure DOM, no React state) */
function buildContextMenu(
  minder: MinderInstance,
  pushSnapshot: () => void,
  closeMenu: () => void,
  markDirty: () => void,
): HTMLDivElement {
  const menu = document.createElement("div");
  menu.className = "km-context-menu";

  const makeItem = (label: string, onClick?: () => void): HTMLDivElement => {
    const item = document.createElement("div");
    item.className = "km-context-menu-item";
    item.textContent = label;
    if (onClick) {
      item.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
      });
    }
    return item;
  };

  const makeSubmenuItem = (label: string, buildSub: () => HTMLDivElement): HTMLDivElement => {
    const item = document.createElement("div");
    item.className = "km-context-menu-item km-has-submenu";
    const labelSpan = document.createElement("span");
    labelSpan.textContent = label;
    const arrow = document.createElement("span");
    arrow.className = "km-submenu-arrow";
    arrow.textContent = "▶";
    item.appendChild(labelSpan);
    item.appendChild(arrow);

    let sub: HTMLDivElement | null = null;
    item.addEventListener("mouseenter", () => {
      if (!sub) {
        sub = buildSub();
        item.appendChild(sub);
      }
      sub.style.display = "";
    });
    item.addEventListener("mouseleave", () => {
      if (sub) sub.style.display = "none";
    });
    return item;
  };

  const execAndClose = (cmd: string, ...args: unknown[]) => {
    closeMenu();
    pushSnapshot();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (minder as any).execCommand(cmd, ...args);
  };

  // 挿入 submenu
  const insertItem = makeSubmenuItem("挿入", () => {
    const sub = document.createElement("div");
    sub.className = "km-context-submenu";
    sub.appendChild(makeItem("トピック", () => execAndClose("AppendSiblingNode")));
    sub.appendChild(makeItem("サブトピック", () => execAndClose("AppendChildNode")));
    return sub;
  });

  // マーカー submenu
  const markerItem = makeSubmenuItem("マーカー", () => {
    const sub = document.createElement("div");
    sub.className = "km-context-submenu";

    // 優先度
    const prioItem = makeSubmenuItem("優先度", () => {
      const prioSub = document.createElement("div");
      prioSub.className = "km-context-submenu";
      prioSub.appendChild(makeItem("なし", () => execAndClose("Priority", 0)));
      for (let p = 1; p <= 5; p++) {
        prioSub.appendChild(makeItem(`優先度 ${p}`, () => execAndClose("Priority", p)));
      }
      return prioSub;
    });
    sub.appendChild(prioItem);

    // 進捗
    const progItem = makeSubmenuItem("進捗", () => {
      const progSub = document.createElement("div");
      progSub.className = "km-context-submenu";
      progSub.appendChild(makeItem("なし", () => execAndClose("Progress", 0)));
      for (let p = 1; p <= 9; p++) {
        progSub.appendChild(makeItem(`${Math.round(((p - 1) / 8) * 100)}%`, () => execAndClose("Progress", p)));
      }
      return progSub;
    });
    sub.appendChild(progItem);

    return sub;
  });

  menu.appendChild(insertItem);
  menu.appendChild(markerItem);

  // Separator
  const sep = document.createElement("div");
  sep.className = "km-context-menu-separator";
  menu.appendChild(sep);

  // リンク
  const selectedNode = minder.getSelectedNode();
  const hasLink = selectedNode && selectedNode.getData("hyperlink");
  const linkItem = makeSubmenuItem("リンク", () => {
    const sub = document.createElement("div");
    sub.className = "km-context-submenu";
    sub.appendChild(makeItem("リンクを編集...", () => {
      closeMenu();
      showHyperlinkDialog(minder, pushSnapshot, markDirty);
    }));
    if (hasLink) {
      sub.appendChild(makeItem("リンクを削除", () => {
        closeMenu();
        pushSnapshot();
        minder.execCommand("HyperLink", null);
        markDirty();
      }));
    }
    return sub;
  });
  menu.appendChild(linkItem);

  // 画像
  const hasImage = selectedNode && selectedNode.getData("image");
  const imageItem = makeSubmenuItem("画像", () => {
    const sub = document.createElement("div");
    sub.className = "km-context-submenu";
    sub.appendChild(makeItem("画像を編集...", () => {
      closeMenu();
      showImageDialog(minder, pushSnapshot, markDirty);
    }));
    if (hasImage) {
      sub.appendChild(makeItem("画像を削除", () => {
        closeMenu();
        pushSnapshot();
        minder.execCommand("Image", null);
        markDirty();
      }));
    }
    return sub;
  });
  menu.appendChild(imageItem);

  // ノート
  const hasNote = selectedNode && selectedNode.getData("note");
  const noteItem = makeSubmenuItem("ノート", () => {
    const sub = document.createElement("div");
    sub.className = "km-context-submenu";
    sub.appendChild(makeItem("ノートを編集...", () => {
      closeMenu();
      // Note editor needs the container - we'll find it via DOM
      const container = document.querySelector(".mindmap-container") as HTMLElement;
      if (container) {
        showNoteEditor(container, minder, pushSnapshot, markDirty);
      }
    }));
    if (hasNote) {
      sub.appendChild(makeItem("ノートを削除", () => {
        closeMenu();
        pushSnapshot();
        minder.execCommand("Note", null);
        markDirty();
      }));
    }
    return sub;
  });
  menu.appendChild(noteItem);

  // Prevent clicks inside menu from closing it via the global listener
  menu.addEventListener("mousedown", (e) => e.stopPropagation());

  return menu;
}

/** Module-level cache to remember viewport position per file path across remounts */
const viewportCache = new Map<string, { tx: number; ty: number; zoom: number }>();

/** Read viewport state (pan translate + zoom) from the minder */
function getViewport(minder: MinderInstance): { tx: number; ty: number; zoom: number } | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = minder as any;
  try {
    const dragger = m._viewDragger || m.getViewDragger?.();
    const movement = dragger?.getMovement?.();
    const zoomValue = m._zoomValue ?? 100;
    if (movement && typeof movement.x === "number") {
      return { tx: movement.x, ty: movement.y, zoom: zoomValue };
    }
  } catch {
    // ignore
  }
  return null;
}

/** Restore viewport state (pan translate + zoom) on the minder */
function restoreViewport(minder: MinderInstance, state: { tx: number; ty: number; zoom: number }): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = minder as any;
  try {
    // Restore zoom via the minder's own zoom() method (sets paper viewport + _zoomValue)
    if (typeof m.zoom === "function") {
      m._zoomValue = state.zoom;
      m.zoom(state.zoom);
    }
    // Restore pan position via dragger.moveTo with a kity.Point
    // (moveTo calls position.round() which requires a kity.Point instance)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kity = window.kity as any;
    const dragger = m._viewDragger || m.getViewDragger?.();
    if (dragger?.moveTo && kity?.Point) {
      dragger.moveTo(new kity.Point(state.tx, state.ty));
    }
  } catch {
    // ignore
  }
}

export interface MindmapEditorHandle {
  getJson: () => KityMinderJson | null;
}

const MindmapEditor = forwardRef<MindmapEditorHandle, Props>(({ fileData, fileType, filePath, theme, onSave, onDirtyChange }, ref) => {
  const readOnly = fileType === ".xmind";
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

  // Context menu ref (DOM-based, not React state)
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(ref, () => ({
    getJson: () => minderRef.current?.exportJson() ?? null,
  }));

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

  // Force main-topic text to black always.
  // The dark-mode CSS `[fill="black"]` override changes sub-topic text to light gray,
  // but main topics should stay black (they have their own light background).
  // Setting data color to "#000" (not the literal "black") bypasses the CSS selector.
  const applyMainTopicTextFix = useCallback(() => {
    const minder = minderRef.current;
    if (!minder || !initializedRef.current) return;
    const root = minder.getRoot();
    if (!root) return;
    let changed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (root as any).traverse?.((node: MinderNodeInstance) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const type = (node as any).getType?.();
      if (type === "main" && node.getData("color") !== "#000") {
        node.setData("color", "#000");
        changed = true;
      }
    });
    if (changed) {
      minder.refresh();
    }
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
    // Clear inline background set by kityminder; CSS var(--bg-base) handles it
    containerRef.current.style.background = "";

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

        // Clear inline background set by kityminder's setTheme; CSS var(--bg-base) handles it
        if (containerRef.current) {
          containerRef.current.style.background = "";
        }

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
        // Apply dark mode text fix after initial render
        applyMainTopicTextFix();

        // Restore saved viewport position (pan/zoom) if available.
        // kityminder fires 'paperrender' → camera command centers the view
        // with animation (viewAnimationDuration). Wait for that to finish,
        // then override with saved state.
        const savedVp = viewportCache.get(filePath);
        if (savedVp) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const animDuration = (minder as any).getOption?.("viewAnimationDuration") || 300;
          setTimeout(() => {
            restoreViewport(minder, savedVp);
          }, animDuration + 100);
        }
      } catch (e) {
        console.error("マインドマップの読み込みエラー:", e);
        setError(`ファイルの読み込みに失敗しました: ${e instanceof Error ? e.message : String(e)}`);
      }
    };

    loadData();

    // Register dblclick handler on the minder instance (not DOM) so it fires
    // reliably even when kityminder processes the event internally
    const handleDblClick = () => {
      if (readOnly || editingRef.current) return;
      const selected = minder.getSelectedNode();
      if (selected) {
        startEditNodeRef.current(selected);
      }
    };
    minder.on("dblclick", handleDblClick);

    // ── Note icon hover → show balloon tooltip ──
    let noteTooltip: HTMLDivElement | null = null;
    let noteShowTimer: ReturnType<typeof setTimeout> | null = null;
    let noteHideTimer: ReturnType<typeof setTimeout> | null = null;

    const hideNoteTooltip = () => {
      if (noteTooltip) {
        noteTooltip.remove();
        noteTooltip = null;
      }
    };

    const handleShowNote = (...args: unknown[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = args[0] as any;
      const node = e?.node as MinderNodeInstance | undefined;
      if (!node) return;

      if (noteHideTimer) { clearTimeout(noteHideTimer); noteHideTimer = null; }

      noteShowTimer = setTimeout(() => {
        const note = node.getData("note") as string;
        if (!note) return;

        hideNoteTooltip();

        const tip = document.createElement("div");
        tip.className = "km-note-tooltip";
        // Simple text with newlines preserved (plain text, not rendered Markdown)
        tip.textContent = note;

        // Position near the note icon
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const icon = (node as any).getRenderer?.("NoteIconRenderer")?.getRenderShape?.();
        const containerEl2 = containerRef.current;
        if (icon && containerEl2) {
          const b = icon.getRenderBox("screen");
          const cr = containerEl2.getBoundingClientRect();
          tip.style.left = `${Math.round(b.cx - cr.left)}px`;
          tip.style.top = `${Math.round(b.bottom - cr.top + 8)}px`;
        }

        // Keep tooltip visible while hovering over it
        tip.addEventListener("mouseenter", () => {
          if (noteHideTimer) { clearTimeout(noteHideTimer); noteHideTimer = null; }
        });
        tip.addEventListener("mouseleave", () => {
          hideNoteTooltip();
        });

        containerRef.current?.appendChild(tip);
        noteTooltip = tip;
      }, 300);
    };

    const handleHideNote = () => {
      if (noteShowTimer) { clearTimeout(noteShowTimer); noteShowTimer = null; }
      noteHideTimer = setTimeout(() => {
        hideNoteTooltip();
      }, 300);
    };

    // Single-click note icon → open note editor
    const handleEditNote = () => {
      hideNoteTooltip();
      if (readOnly) return;
      const container2 = containerRef.current;
      if (container2) {
        showNoteEditor(container2, minder, pushSnapshot, markDirty);
      }
    };

    minder.on("shownoterequest", handleShowNote);
    minder.on("hidenoterequest", handleHideNote);
    minder.on("editnoterequest", handleEditNote);

    // Handle hyperlink icon clicks → open URL in browser
    const handleHyperlinkClick = (...args: unknown[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = args[0] as any;
      const node = (e?.node as MinderNodeInstance) || minder.getSelectedNode();
      if (!node) return;
      const url = node.getData("hyperlink") as string;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    };
    minder.on("hyperlinkclick", handleHyperlinkClick);

    // Also listen for DOM dblclick on the container as a fallback
    const containerEl = containerRef.current;
    const handleDomDblClick = () => {
      if (readOnly || editingRef.current) return;
      const selected = minder.getSelectedNode();
      if (selected) {
        startEditNodeRef.current(selected);
      }
    };
    containerEl.addEventListener("dblclick", handleDomDblClick);

    // Block KityMinder's built-in editing hotkeys (Tab, Enter, Delete, Backspace) for read-only files
    const handleReadOnlyBlock = (e: KeyboardEvent) => {
      if (!readOnly) return;
      const blockedKeys = ["Tab", "Enter", "Delete", "Backspace", "F2"];
      if (blockedKeys.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };
    if (readOnly) {
      containerEl.addEventListener("keydown", handleReadOnlyBlock, true);
      // Also block at window level to catch kityminder's key receiver
      window.addEventListener("keydown", handleReadOnlyBlock, true);
    }

    // Context menu (pure DOM, no React state to avoid re-render interference)
    const closeMenu = () => {
      if (contextMenuRef.current) {
        contextMenuRef.current.remove();
        contextMenuRef.current = null;
      }
    };

    const handleGlobalMouseDown = (e: MouseEvent) => {
      const menu = contextMenuRef.current;
      if (menu && !menu.contains(e.target as Node)) {
        closeMenu();
      }
    };

    const handleContextMenuNative = (e: MouseEvent) => {
      e.preventDefault();
      if (readOnly) return;
      const selected = minder.getSelectedNode();
      if (!selected) return;

      // Remove previous menu if any
      closeMenu();

      const menu = buildContextMenu(minder, pushSnapshot, closeMenu, markDirty);
      menu.style.left = `${e.clientX}px`;
      menu.style.top = `${e.clientY}px`;
      document.body.appendChild(menu);
      contextMenuRef.current = menu;
    };

    containerEl.addEventListener("contextmenu", handleContextMenuNative, true);
    document.addEventListener("mousedown", handleGlobalMouseDown, true);

    // Save viewport state on every view change (pan/zoom) so the cache is always up-to-date.
    // This is more reliable than saving on unmount, since React may detach DOM before cleanup.
    let viewportSaveEnabled = false; // skip the initial camera positioning
    const handleViewChange = () => {
      if (!viewportSaveEnabled) return;
      const vp = getViewport(minder);
      if (vp) {
        viewportCache.set(filePath, vp);
      }
    };
    minder.on("viewchange", handleViewChange);
    minder.on("viewchanged", handleViewChange);
    // Enable saving after initial camera + viewport restore animations complete.
    // Initial camera takes ~viewAnimationDuration, restore adds another ~100ms after that.
    setTimeout(() => { viewportSaveEnabled = true; }, 1000);

    return () => {
      minder.off("viewchange", handleViewChange);
      minder.off("viewchanged", handleViewChange);
      minder.off("dblclick", handleDblClick);
      minder.off("hyperlinkclick", handleHyperlinkClick);
      minder.off("shownoterequest", handleShowNote);
      minder.off("hidenoterequest", handleHideNote);
      minder.off("editnoterequest", handleEditNote);
      hideNoteTooltip();
      containerEl.removeEventListener("dblclick", handleDomDblClick);
      containerEl.removeEventListener("contextmenu", handleContextMenuNative, true);
      document.removeEventListener("mousedown", handleGlobalMouseDown, true);
      if (readOnly) {
        containerEl.removeEventListener("keydown", handleReadOnlyBlock, true);
        window.removeEventListener("keydown", handleReadOnlyBlock, true);
      }
      closeMenu();
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
      if (!initializedRef.current || readOnly) return;
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
      // Re-apply main-topic color fix for newly added nodes
      applyMainTopicTextFix();
    };

    minder.on("contentchange", handleChange);
    return () => {
      minder.off("contentchange", handleChange);
    };
  }, [dirty, pushSnapshot, markDirty, applyMainTopicTextFix]);

  // Clear any inline background set by kityminder's setTheme so CSS var(--bg-base) applies
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.background = "";
    }
    applyMainTopicTextFix();
  }, [theme, applyMainTopicTextFix]);

  const handleSave = useCallback(() => {
    const minder = minderRef.current;
    if (!minder) return;
    // Strip main-topic color overrides before export so the file stays theme-neutral
    const root = minder.getRoot();
    if (root) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (root as any).traverse?.((node: MinderNodeInstance) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const type = (node as any).getType?.();
        if (type === "main" && node.getData("color") === "#000") {
          node.setData("color", null);
        }
      });
    }
    const json = minder.exportJson();
    // Preserve theme and layout
    json.theme = currentTheme;
    json.template = currentLayout;
    onSave(json);
    setDirty(false);
    onDirtyChange(false);
    // Re-apply the fix after export
    applyMainTopicTextFix();
  }, [currentTheme, currentLayout, onSave, onDirtyChange, applyMainTopicTextFix]);

  const handleChangeTheme = useCallback((themeId: string) => {
    const minder = minderRef.current;
    if (!minder) return;
    pushSnapshot();
    minder.execCommand("Theme", themeId);
    // Clear inline background set by kityminder's setTheme; CSS var(--bg-base) handles it
    if (containerRef.current) {
      containerRef.current.style.background = "";
    }
    setCurrentTheme(themeId);
    if (!dirty) {
      markDirty();
    }
    // Re-apply main-topic color fix after theme change (theme resets node colors)
    applyMainTopicTextFix();
  }, [pushSnapshot, dirty, markDirty, applyMainTopicTextFix]);

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

      // F2 to edit selected node text (not in read-only mode)
      if (e.key === "F2" && !readOnly) {
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
        canUndo={canUndo}
        canRedo={canRedo}
        readOnly={readOnly}
        onChangeTheme={handleChangeTheme}
        onChangeLayout={handleChangeLayout}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />
      <div className="mindmap-container" ref={containerRef} data-theme={theme} />
    </div>
  );
});

export default MindmapEditor;
