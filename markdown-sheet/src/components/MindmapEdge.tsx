import { memo } from "react";
import { BaseEdge, getBezierPath, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

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
    : getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });

  const strokeWidth = depth <= 1 ? 2.5 : 1.8;

  return (
    <BaseEdge
      path={path}
      style={{ ...edgeStyle, stroke: color, strokeWidth, fill: "none" }}
    />
  );
}

export default memo(MindmapEdge);
