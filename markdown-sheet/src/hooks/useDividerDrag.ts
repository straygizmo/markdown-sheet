import { useCallback } from "react";

export function useDividerDrag(
  containerRef: React.RefObject<HTMLDivElement | null>,
  editorRatio: number,
  setEditorRatio: React.Dispatch<React.SetStateAction<number>>,
  appBodyRef: React.RefObject<HTMLDivElement | null>,
  terminalRatio: number,
  setTerminalRatio: React.Dispatch<React.SetStateAction<number>>,
) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const startX = e.clientX;
      const containerRect = container.getBoundingClientRect();
      const startRatio = editorRatio;

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startX;
        const newRatio = startRatio + (deltaX / containerRect.width) * 100;
        setEditorRatio(Math.max(15, Math.min(75, newRatio)));
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [editorRatio, containerRef, setEditorRatio]
  );

  const handleTerminalMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const body = appBodyRef.current;
      if (!body) return;
      const startX = e.clientX;
      const bodyRect = body.getBoundingClientRect();
      const startRatio = terminalRatio;

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = startX - e.clientX;
        const newRatio = startRatio + (deltaX / bodyRect.width) * 100;
        setTerminalRatio(Math.max(10, Math.min(60, newRatio)));
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [terminalRatio, appBodyRef, setTerminalRatio]
  );

  return { handleMouseDown, handleTerminalMouseDown } as const;
}
