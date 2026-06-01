"use client";

import { useState, useCallback } from "react";
import {
  addPersonAction,
  addRelativeAction,
  addChildToCoupleAction,
  addChildWithParentsAction,
  editPersonAction,
} from "@/app/actions";
import type { PersonRow } from "@/lib/flow";
import type { AddRelation } from "./PersonNode";

// T5-B — the "Pregunta guiada" contribution flow, used inside the focused detail
// card (and in self mode for the empty tree). Single-marriage is the default:
// the "¿de qué pareja?" step ONLY appears when the person has 2+ unions.

export interface Union {
  coupleId: string;
  partnerName: string;
}

type Relation = "partner" | "child" | "parent";

const REL_LABEL: Record<Relation, string> = {
  partner: "pareja",
  child: "hijo/a",
  parent: "madre/padre",
};
const FORM_HEADING: Record<Relation, string> = {
  partner: "Agregá a su pareja",
  child: "Agregá un hijo o hija",
  parent: "Agregá su madre o padre",
};

function toNum(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function AddRelative({
  token,
  personId,
  personName,
  unions,
  onDone,
}: {
  token: string;
  /** null => self mode: add a standalone person (the owner's first add). */
  personId: string | null;
  personName?: string;
  unions: Union[];
  onDone: () => void;
}) {
  const selfMode = personId === null;
  const [open, setOpen] = useState(selfMode);
  const [relation, setRelation] = useState<Relation | null>(null);
  const [unionStep, setUnionStep] = useState(false);

  const [name, setName] = useState("");
  const [birthplace, setBirthplace] = useState("");
  const [by, setBy] = useState("");
  const [bm, setBm] = useState("");
  const [bd, setBd] = useState("");
  const [living, setLiving] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setRelation(null);
    setUnionStep(false);
    setName(""); setBirthplace(""); setBy(""); setBm(""); setBd(""); setLiving(true);
    setError(null);
    setOpen(selfMode);
  }, [selfMode]);

  const persist = useCallback(
    async (childCoupleId: string | null) => {
      const trimmed = name.trim();
      if (!trimmed) {
        setError("El nombre es lo único que hace falta.");
        return;
      }
      const person = {
        name: trimmed,
        birthplace: birthplace.trim() || null,
        birthYear: toNum(by),
        birthMonth: toNum(bm),
        birthDay: toNum(bd),
        living,
      };
      setBusy(true);
      setError(null);

      let res;
      if (selfMode) {
        res = await addPersonAction(token, person);
      } else if (relation === "partner" || relation === "parent") {
        res = await addRelativeAction(token, { person, relationTo: personId, relation });
      } else {
        // child: a resolved couple => both parents; null => single (unknown other parent)
        res = childCoupleId
          ? await addChildToCoupleAction(token, { coupleId: childCoupleId, child: person })
          : await addRelativeAction(token, { person, relationTo: personId, relation: "child" });
      }

      if (!res?.ok) {
        setError(res?.error ?? "No se pudo guardar — reintentá.");
        setBusy(false);
        return;
      }
      setBusy(false);
      reset();
      onDone();
    },
    [name, birthplace, by, bm, bd, living, selfMode, relation, personId, token, reset, onDone],
  );

  // Primary "agregar" — resolves the union question per the single-marriage rule.
  const onPrimary = useCallback(() => {
    if (!name.trim()) { setError("El nombre es lo único que hace falta."); return; }
    if (!selfMode && relation === "child") {
      if (unions.length === 0) return persist(null);           // single / unknown parent
      if (unions.length === 1) return persist(unions[0].coupleId); // auto — no question
      setUnionStep(true);                                       // 2+ unions -> ask
      return;
    }
    return persist(null);
  }, [name, selfMode, relation, unions, persist]);

  // ── self mode: render the form directly (no menu) ─────────────────────────
  if (selfMode) {
    return (
      <div>
        <PersonFields
          nameId="self-name" big
          {...{ name, setName, birthplace, setBirthplace, by, setBy, bm, setBm, bd, setBd, living, setLiving }}
        />
        {error ? <p className="pl-error" role="alert">{error}</p> : null}
        <button className="pl-btn pl-btn--block" onClick={onPrimary} disabled={busy} style={{ marginTop: 14 }}>
          {busy ? "Guardando…" : "Agregarme al árbol"}
        </button>
      </div>
    );
  }

  // ── person mode: trigger -> relation menu -> form (+ union step) ───────────
  if (!open) {
    return (
      <button className="pl-act" onClick={() => setOpen(true)}>+ agregar familiar</button>
    );
  }

  if (!relation) {
    return (
      <div className="pl-fade">
        <p className="pl-meta" style={{ marginBottom: 8 }}>¿qué querés sumar?</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["partner", "child", "parent"] as Relation[]).map((r) => (
            <button key={r} className="pl-chip" onClick={() => setRelation(r)}>{REL_LABEL[r]}</button>
          ))}
        </div>
        <button className="pl-act" style={{ marginTop: 12, color: "var(--muted)" }} onClick={reset}>cancelar</button>
      </div>
    );
  }

  // union step (only reachable for child + 2 unions)
  if (unionStep) {
    return (
      <div className="pl-fade">
        <div className="pl-stepper" style={{ marginBottom: 8 }}>
          <span className="dot done" /><span className="dot on" />
          <span className="pl-meta" style={{ marginLeft: 6 }}>paso 2 de 2</span>
        </div>
        <p style={{ fontSize: 15 }}>¿hijo/a de qué pareja?</p>
        <p className="pl-meta" style={{ marginTop: 2, marginBottom: 10 }}>
          {personName} tuvo más de una pareja — elegí de cuál es {name.trim() || "esta persona"}.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {unions.map((u) => (
            <button key={u.coupleId} className="pl-chip" style={{ justifyContent: "flex-start" }} onClick={() => persist(u.coupleId)} disabled={busy}>
              con {u.partnerName}
            </button>
          ))}
          <button className="pl-chip" style={{ justifyContent: "flex-start", fontStyle: "italic", color: "var(--muted)" }} onClick={() => persist(null)} disabled={busy}>
            otra pareja / no la sé
          </button>
        </div>
        {error ? <p className="pl-error" role="alert">{error}</p> : null}
        <button className="pl-act" style={{ marginTop: 12, color: "var(--muted)" }} onClick={() => setUnionStep(false)}>atrás</button>
      </div>
    );
  }

  return (
    <div className="pl-fade">
      <p style={{ fontSize: 15, marginBottom: 4 }}>{FORM_HEADING[relation]}</p>
      <PersonFields
        nameId="rel-name" big
        {...{ name, setName, birthplace, setBirthplace, by, setBy, bm, setBm, bd, setBd, living, setLiving }}
      />
      {error ? <p className="pl-error" role="alert">{error}</p> : null}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
        <button className="pl-btn" onClick={onPrimary} disabled={busy}>
          {busy ? "Guardando…" : "Agregar"}
        </button>
        <button className="pl-act" style={{ color: "var(--muted)" }} onClick={reset}>cancelar</button>
      </div>
    </div>
  );
}

// Inline edit of the focused person's own facts (DESIGN.md: the focused card is
// editable). Preserves death dates (not shown in V0 edit) so editing birth info
// never erases them.
export function EditPerson({
  token,
  person,
  onDone,
  onCancel,
}: {
  token: string;
  person: PersonRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(person.name);
  const [birthplace, setBirthplace] = useState(person.birthplace ?? "");
  const [by, setBy] = useState(person.birthYear != null ? String(person.birthYear) : "");
  const [bm, setBm] = useState(person.birthMonth != null ? String(person.birthMonth) : "");
  const [bd, setBd] = useState(person.birthDay != null ? String(person.birthDay) : "");
  const [living, setLiving] = useState(person.living);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("El nombre es lo único que hace falta."); return; }
    setBusy(true);
    setError(null);
    const res = await editPersonAction(token, person.id, {
      name: trimmed,
      birthplace: birthplace.trim() || null,
      birthYear: toNum(by),
      birthMonth: toNum(bm),
      birthDay: toNum(bd),
      // preserve death facts not exposed in the V0 edit form
      deathYear: person.deathYear ?? null,
      deathMonth: person.deathMonth ?? null,
      deathDay: person.deathDay ?? null,
      living,
    });
    if (!res.ok) { setError(res.error); setBusy(false); return; }
    setBusy(false);
    onDone();
  }, [name, birthplace, by, bm, bd, living, token, person, onDone]);

  return (
    <div className="pl-fade">
      <PersonFields
        nameId="edit-name" big
        {...{ name, setName, birthplace, setBirthplace, by, setBy, bm, setBm, bd, setBd, living, setLiving }}
      />
      {error ? <p className="pl-error" role="alert">{error}</p> : null}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
        <button className="pl-btn" onClick={save} disabled={busy}>
          {busy ? "Guardando…" : "Guardar"}
        </button>
        <button className="pl-act" style={{ color: "var(--muted)" }} onClick={onCancel}>cancelar</button>
      </div>
    </div>
  );
}

// Relation-driven add form for the desktop directional affordances. Mount it keyed by
// (relation + anchor) so it starts fresh per add. Parent/partner are simple; child
// resolves the union: 0 unions => optional inline OTHER PARENT (forms the couple via
// addChildWithParents); exactly 1 => auto-attaches to that couple (both parents); 2+ =>
// "¿de qué pareja?" picker.
const ADD_HEADING: Record<AddRelation, (n: string) => string> = {
  parent: (n) => `Madre o padre de ${n}`,
  partner: (n) => `Pareja de ${n}`,
  child: (n) => `Hijo o hija de ${n}`,
};

export function AddPanel({
  token,
  personId,
  personName,
  relation,
  unions,
  onDone,
  onCancel,
}: {
  token: string;
  personId: string;
  personName: string;
  relation: AddRelation;
  unions: Union[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [birthplace, setBirthplace] = useState("");
  const [by, setBy] = useState("");
  const [bm, setBm] = useState("");
  const [bd, setBd] = useState("");
  const [living, setLiving] = useState(true);
  const [other, setOther] = useState(""); // inline other parent (child + 0 unions)
  const [unionStep, setUnionStep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const personInputObj = () => ({
    name: name.trim(),
    birthplace: birthplace.trim() || null,
    birthYear: toNum(by),
    birthMonth: toNum(bm),
    birthDay: toNum(bd),
    living,
  });

  const run = useCallback(
    async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
      setBusy(true);
      setError(null);
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "No se pudo guardar — reintentá.");
        setBusy(false);
        return;
      }
      setBusy(false);
      onDone();
    },
    [onDone],
  );

  const submitChild = (coupleId: string | null, otherName?: string | null) => {
    const child = personInputObj();
    return coupleId
      ? run(() => addChildToCoupleAction(token, { coupleId, child }))
      : run(() => addChildWithParentsAction(token, { parentId: personId, otherParentName: otherName ?? null, child }));
  };

  const onPrimary = () => {
    if (!name.trim()) {
      setError("El nombre es lo único que hace falta.");
      return;
    }
    if (relation === "parent" || relation === "partner") {
      return run(() => addRelativeAction(token, { person: personInputObj(), relationTo: personId, relation }));
    }
    // child
    if (unions.length >= 2 && !unionStep) {
      setUnionStep(true);
      return;
    }
    if (unions.length === 1) return submitChild(unions[0].coupleId);
    return submitChild(null, other.trim() || null);
  };

  // child + 2 unions: which marriage?
  if (relation === "child" && unionStep) {
    return (
      <div className="pl-fade">
        <p style={{ fontSize: 15 }}>¿hijo/a de qué pareja?</p>
        <p className="pl-meta" style={{ marginTop: 2, marginBottom: 10 }}>
          {personName} tuvo más de una pareja — elegí de cuál es {name.trim() || "esta persona"}.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {unions.map((u) => (
            <button key={u.coupleId} className="pl-chip" style={{ justifyContent: "flex-start" }} disabled={busy} onClick={() => submitChild(u.coupleId)}>
              con {u.partnerName}
            </button>
          ))}
          <button className="pl-chip" style={{ justifyContent: "flex-start", fontStyle: "italic", color: "var(--muted)" }} disabled={busy} onClick={() => submitChild(null, null)}>
            otra pareja / no la sé
          </button>
        </div>
        {error ? <p className="pl-error" role="alert">{error}</p> : null}
        <button className="pl-act" style={{ marginTop: 12, color: "var(--muted)" }} onClick={() => setUnionStep(false)}>atrás</button>
      </div>
    );
  }

  return (
    <div className="pl-fade">
      <p style={{ fontSize: 15, marginBottom: 4 }}>{ADD_HEADING[relation](personName)}</p>
      {relation === "child" && unions.length === 1 ? (
        <p className="pl-meta" style={{ marginBottom: 4 }}>
          será hijo/a de {personName} y {unions[0].partnerName}.
        </p>
      ) : null}
      <PersonFields
        nameId="add-name" big
        {...{ name, setName, birthplace, setBirthplace, by, setBy, bm, setBm, bd, setBd, living, setLiving }}
      />
      {relation === "child" && unions.length === 0 ? (
        <div className="pl-field">
          <label htmlFor="add-other-parent">otro padre/madre (opcional)</label>
          <input
            id="add-other-parent"
            className="pl-input"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder="dejalo vacío si no lo sabés"
            maxLength={120}
          />
        </div>
      ) : null}
      {error ? <p className="pl-error" role="alert">{error}</p> : null}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
        <button className="pl-btn" onClick={onPrimary} disabled={busy}>
          {busy ? "Guardando…" : "Agregar"}
        </button>
        <button className="pl-act" style={{ color: "var(--muted)" }} onClick={onCancel}>cancelar</button>
      </div>
    </div>
  );
}

function PersonFields(props: {
  nameId: string; big?: boolean;
  name: string; setName: (v: string) => void;
  birthplace: string; setBirthplace: (v: string) => void;
  by: string; setBy: (v: string) => void;
  bm: string; setBm: (v: string) => void;
  bd: string; setBd: (v: string) => void;
  living: boolean; setLiving: (v: boolean) => void;
}) {
  return (
    <div>
      <div className="pl-field">
        <label htmlFor={props.nameId}>nombre</label>
        <input
          id={props.nameId}
          className={`pl-input${props.big ? " pl-input--name" : ""}`}
          value={props.name}
          onChange={(e) => props.setName(e.target.value)}
          placeholder="¿cómo se llama?"
          autoFocus
          maxLength={120}
          suppressHydrationWarning
        />
      </div>
      <div className="pl-field">
        <label htmlFor={`${props.nameId}-place`}>nació en (opcional)</label>
        <input
          id={`${props.nameId}-place`}
          className="pl-input"
          value={props.birthplace}
          onChange={(e) => props.setBirthplace(e.target.value)}
          placeholder="lugar"
          maxLength={160}
        />
      </div>
      <div className="pl-row">
        <div className="pl-field">
          <label htmlFor={`${props.nameId}-y`}>año</label>
          <input id={`${props.nameId}-y`} className="pl-input" inputMode="numeric" value={props.by} onChange={(e) => props.setBy(e.target.value)} placeholder="—" />
        </div>
        <div className="pl-field">
          <label htmlFor={`${props.nameId}-m`}>mes</label>
          <input id={`${props.nameId}-m`} className="pl-input" inputMode="numeric" value={props.bm} onChange={(e) => props.setBm(e.target.value)} placeholder="—" />
        </div>
        <div className="pl-field">
          <label htmlFor={`${props.nameId}-d`}>día</label>
          <input id={`${props.nameId}-d`} className="pl-input" inputMode="numeric" value={props.bd} onChange={(e) => props.setBd(e.target.value)} placeholder="—" />
        </div>
        <label className="pl-toggle" style={{ paddingBottom: 8 }}>
          <input type="checkbox" checked={props.living} onChange={(e) => props.setLiving(e.target.checked)} />
          <span className="track" />
          vive
        </label>
      </div>
    </div>
  );
}
