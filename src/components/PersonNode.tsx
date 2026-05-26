"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

export type PersonNodeData = {
  label: string;
  line: string;
  fresh: boolean;
  freshLabel: string;
  dim?: boolean;
  onSelect?: (id: string) => void;
};
export type PersonFlowNode = Node<PersonNodeData, "person">;

export function PersonNode({ id, data, selected }: NodeProps<PersonFlowNode>) {
  const cls = ["pnode", data.fresh ? "fresh" : "", selected ? "sel" : "", data.dim ? "dim" : ""]
    .filter(Boolean)
    .join(" ");
  // Click handled on the card itself (plain DOM onClick) — robust against React
  // Flow's pointer/drag handling. nodesDraggable is off, so this is a clean click.
  return (
    <div className={cls} onClick={() => data.onSelect?.(id)}>
      <Handle type="target" position={Position.Top} />
      <div className="pn-name">{data.label}</div>
      {data.line ? <div className="pn-line">{data.line}</div> : null}
      {data.fresh && data.freshLabel ? <div className="pn-fresh">{data.freshLabel}</div> : null}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
