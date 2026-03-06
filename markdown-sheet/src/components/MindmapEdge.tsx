import { memo } from "react";
import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

function getSharpElbowPath(
  sourceX: number, sourceY: number,
  targetX: number, targetY: number,
): string {
  // Straight lines if same Y
  if (Math.abs(targetY - sourceY) < 1) {
    return `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
  }

  // Elbow: horizontal line → small rounded corner → vertical line → small rounded corner → horizontal line
  const midX = sourceX + (targetX - sourceX) * 0.5;
  const dy = targetY - sourceY;
  const r = Math.min(8, Math.abs(dy) / 2, Math.abs(targetX - sourceX) * 0.25);
  const sign = dy > 0 ? 1 : -1;

  return [
    `M ${sourceX},${sourceY}`,
    `L ${midX - r},${sourceY}`,
    `Q ${midX},${sourceY} ${midX},${sourceY + sign * r}`,
    `L ${midX},${targetY - sign * r}`,
    `Q ${midX},${targetY} ${midX + r},${targetY}`,
    `L ${targetX},${targetY}`,
  ].join(" ");
}

function MindmapEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style: edgeStyle } = props;
  const color = (data as Record<string, unknown>)?.color as string || "#999";
  const depth = (data as Record<string, unknown>)?.depth as number || 1;

  // Use smooth step for filetree-like connections (source-bottom → target-left)
  const isStep = sourcePosition?.toString() === "bottom" && targetPosition?.toString() === "left";

  const [path] = isStep
    ? getSmoothStepPath({
        sourceX, sourceY, targetX, targetY,
        sourcePosition, targetPosition,
        borderRadius: 8,
      })
    : [getSharpElbowPath(sourceX, sourceY, targetX, targetY)];

  const strokeWidth = depth <= 1 ? 2.5 : 1.8;

  return (
    <BaseEdge
      path={path}
      style={{ ...edgeStyle, stroke: color, strokeWidth, fill: "none" }}
    />
  );
}

export default memo(MindmapEdge);
