"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

export type AddRelation = "parent" | "partner" | "child";

export type PersonNodeData = {
  label: string;
  line: string;
  fresh: boolean;
  freshLabel: string;
  dim?: boolean;
  addMode?: boolean;
  onSelect?: (id: string) => void;
  onAdd?: (id: string, relation: AddRelation) => void;
};
export type PersonFlowNode = Node<PersonNodeData, "person">;

export function PersonNode({ id, data, selected }: NodeProps<PersonFlowNode>) {
  const cls = [
    "pnode",
    data.fresh ? "fresh" : "",
    selected ? "sel" : "",
    data.dim ? "dim" : "",
    data.addMode ? "addable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Directional add affordances (desktop add-mode): revealed on hover, positioned to
  // match the genealogy mental model — up = parents, side = partner, down = children.
  // Tappable buttons (not hover-zones); clicks are stopped so they don't select.
  const add = (e: React.MouseEvent, relation: AddRelation) => {
    e.stopPropagation();
    data.onAdd?.(id, relation);
  };

  return (
    <div className={cls} onClick={() => !data.addMode && data.onSelect?.(id)}>
      <Handle type="target" position={Position.Top} />

      {data.addMode ? (
        <>
          <button className="pn-add pn-add--up" onClick={(e) => add(e, "parent")} title="agregar madre/padre">
            ↑ madre/padre
          </button>
          <button className="pn-add pn-add--side" onClick={(e) => add(e, "partner")} title="agregar pareja">
            pareja →
          </button>
          <button className="pn-add pn-add--down" onClick={(e) => add(e, "child")} title="agregar hijo/a">
            ↓ hijo/a
          </button>
        </>
      ) : null}

      <div className="pn-name">{data.label}</div>
      {data.line ? <div className="pn-line">{data.line}</div> : null}
      {data.fresh && data.freshLabel ? <div className="pn-fresh">{data.freshLabel}</div> : null}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
