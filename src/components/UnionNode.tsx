"use client";

import { Handle, Position } from "@xyflow/react";

// The thin junction where a couple's children branch off — a small olive "knot"
// in the fieldbook. Not selectable/draggable; pure layout + edge anchor.
export function UnionNode() {
  return (
    <div className="union-knot">
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
