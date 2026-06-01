"use client";

import { useRef, useState, useEffect } from "react";
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
  // Hover-intent: keep the directional affordances up for a grace period after the
  // pointer leaves, so the gap between the card and a floating pill doesn't make them
  // vanish before you can click. Reaching a pill cancels the hide timer.
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const reveal = () => {
    if (timer.current) clearTimeout(timer.current);
    setShow(true);
  };
  const scheduleHide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 280);
  };

  const cls = [
    "pnode",
    data.fresh ? "fresh" : "",
    selected ? "sel" : "",
    data.dim ? "dim" : "",
    data.addMode ? "addable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const add = (e: React.MouseEvent, relation: AddRelation) => {
    e.stopPropagation();
    data.onAdd?.(id, relation);
  };

  const revealed = data.addMode && show ? " revealed" : "";

  return (
    <div
      className={cls}
      onClick={() => !data.addMode && data.onSelect?.(id)}
      onMouseEnter={data.addMode ? reveal : undefined}
      onMouseLeave={data.addMode ? scheduleHide : undefined}
    >
      <Handle type="target" position={Position.Top} />

      {data.addMode ? (
        <>
          <button className={`pn-add pn-add--up${revealed}`} onClick={(e) => add(e, "parent")} title="agregar madre/padre">
            ↑ madre/padre
          </button>
          <button className={`pn-add pn-add--side${revealed}`} onClick={(e) => add(e, "partner")} title="agregar pareja">
            pareja →
          </button>
          <button className={`pn-add pn-add--down${revealed}`} onClick={(e) => add(e, "child")} title="agregar hijo/a">
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
