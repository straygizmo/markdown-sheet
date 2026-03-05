/** KityMinder JSON format types */

export interface KityMinderNodeData {
  text: string;
  priority?: number;
  progress?: number;
  note?: string;
  image?: string;
  imageSize?: { width: number; height: number };
  expandState?: "expand" | "collapse";
}

export interface KityMinderNode {
  data: KityMinderNodeData;
  children: KityMinderNode[];
}

export interface KityMinderJson {
  root: KityMinderNode;
  template?: string;
  theme?: string;
}

/** kityminder-core Minder instance (global window.kityminder) */
export interface MinderInstance {
  renderTo(container: HTMLElement): void;
  importJson(data: KityMinderJson): void;
  exportJson(): KityMinderJson;
  execCommand(command: string, ...args: unknown[]): void;
  queryCommandState(command: string): number;
  queryCommandValue(command: string): unknown;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  fire(event: string, ...args: unknown[]): void;
  getRoot(): MinderNodeInstance;
  getSelectedNode(): MinderNodeInstance | null;
  getSelectedNodes(): MinderNodeInstance[];
  select(node: MinderNodeInstance | MinderNodeInstance[], isSilent?: boolean): void;
  useTheme(theme: string): void;
  useTemplate(template: string): void;
  getThemeList(): Record<string, unknown>;
  disable(): void;
  enable(): void;
  focus(): void;
  blur(): void;
  isFocused(): boolean;
  refresh(): void;
  layout(duration?: number): void;
  getRenderContainer(): { getBoundaryBox(): { width: number; height: number } };
}

export interface MinderNodeInstance {
  getData(key: string): unknown;
  setData(key: string, value: unknown): void;
  getText(): string;
  setText(text: string): void;
  getChildren(): MinderNodeInstance[];
  getParent(): MinderNodeInstance | null;
  isRoot(): boolean;
}

declare global {
  interface Window {
    kityminder: {
      Minder: new (options?: Record<string, unknown>) => MinderInstance;
    };
    kity: unknown;
  }
}
