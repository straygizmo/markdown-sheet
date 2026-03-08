import { type FC, useCallback, useEffect, useRef, useState } from "react";
import Tesseract from "tesseract.js";
import { useImageCanvas } from "../hooks/useImageCanvas";
import "./ImageCanvas.css";
import ImagePreviewToolbar from "./ImagePreviewToolbar";

interface Props {
  imageBlobUrl: string;
}

const ImageCanvas: FC<Props> = ({ imageBlobUrl }) => {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const containerElRef = useRef<HTMLDivElement | null>(null);
  const {
    activeTool,
    setActiveTool,
    canUndo,
    canRedo,
    undo,
    redo,
    zoomLevel,
    zoomIn,
    zoomOut,
    resetZoom,
    saveImage,
    getCanvasDataUrl,
    initCanvas,
    loadBackgroundImage,
    dispose,
    setOcrRegionCallback,
    clearOcrRect,
    deleteSelected,
    strokeColor,
    setStrokeColor,
    fillColor,
    setFillColor,
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    strokeWidth,
    setStrokeWidth,
  } = useImageCanvas();

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<string | null>(null);
  const prevUrlRef = useRef<string | null>(null);

  // Init canvas on mount
  useEffect(() => {
    const canvasEl = canvasElRef.current;
    const container = containerElRef.current;
    if (!canvasEl || !container) return;
    initCanvas(canvasEl, container);
    return () => { dispose(); };
  }, []);

  // Load background image when URL changes
  useEffect(() => {
    if (imageBlobUrl && imageBlobUrl !== prevUrlRef.current) {
      prevUrlRef.current = imageBlobUrl;
      loadBackgroundImage(imageBlobUrl);
    }
  }, [imageBlobUrl, loadBackgroundImage]);

  // Resize observer
  useEffect(() => {
    const container = containerElRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      if (imageBlobUrl) {
        loadBackgroundImage(imageBlobUrl);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [imageBlobUrl, loadBackgroundImage]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey && e.key === "y") || (e.ctrlKey && e.shiftKey && e.key === "z")) {
        e.preventDefault();
        redo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        // Don't delete when editing text
        const el = document.activeElement;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
        deleteSelected();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [undo, redo, deleteSelected]);

  const runOcr = useCallback(async (dataUrl: string) => {
    setOcrLoading(true);
    try {
      const result = await Tesseract.recognize(dataUrl, "eng+jpn");
      const text = result.data.text.trim();
      setOcrResult(text || "(テキストが検出されませんでした)");
    } catch (err) {
      console.error("OCR error:", err);
      setOcrResult("OCR処理中にエラーが発生しました。");
    } finally {
      setOcrLoading(false);
    }
  }, []);

  // Register OCR region callback
  useEffect(() => {
    setOcrRegionCallback((region) => {
      const dataUrl = getCanvasDataUrl(region);
      if (dataUrl) runOcr(dataUrl);
    });
    return () => setOcrRegionCallback(null);
  }, [setOcrRegionCallback, getCanvasDataUrl, runOcr]);

  // Full image OCR (toolbar button fallback)
  const handleOcr = useCallback(() => {
    setActiveTool("ocr");
  }, [setActiveTool]);

  const handleCopyOcr = useCallback(async () => {
    if (ocrResult) {
      await navigator.clipboard.writeText(ocrResult);
    }
  }, [ocrResult]);

  const handleCloseOcr = useCallback(() => {
    setOcrResult(null);
    clearOcrRect();
  }, [clearOcrRect]);

  return (
    <>
      <ImagePreviewToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        zoomLevel={zoomLevel}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetZoom}
        onSave={saveImage}
        onOcr={handleOcr}
        ocrLoading={ocrLoading}
        strokeColor={strokeColor}
        onStrokeColorChange={setStrokeColor}
        fillColor={fillColor}
        onFillColorChange={setFillColor}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        fontFamily={fontFamily}
        onFontFamilyChange={setFontFamily}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
      />
      <div className="image-canvas-container" ref={containerElRef}>
        <div className="image-canvas-wrapper">
          <canvas ref={canvasElRef} />
        </div>
      </div>
      {ocrResult !== null && (
        <div className="ocr-result-panel">
          <div className="ocr-result-header">
            <span className="ocr-result-title">OCR結果</span>
            <div className="ocr-result-actions">
              <button className="im-tb-btn" onClick={handleCopyOcr} title="コピー">コピー</button>
              <button className="im-tb-btn" onClick={handleCloseOcr} title="閉じる">閉じる</button>
            </div>
          </div>
          <textarea
            className="ocr-result-text"
            value={ocrResult}
            onChange={(e) => setOcrResult(e.target.value)}
            readOnly={false}
          />
        </div>
      )}
      {ocrLoading && (
        <div className="ocr-loading-overlay">
          <span>OCR処理中...</span>
        </div>
      )}
    </>
  );
};

export default ImageCanvas;
