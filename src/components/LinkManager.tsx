"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listLinksAction, mintLinkAction, revokeLinkAction } from "@/app/actions";
import type { PersonRow } from "@/lib/flow";

// Owner-only "compartir / enlaces" manager. Surfaced from ONE quiet control in
// TreeExplorer (no permanent canvas chrome, no terracotta — vine + .pl-act only,
// per DESIGN.md). It lists the tree's links, mints an anchored link for a chosen
// person (shown in a .pl-slip with copy + WhatsApp, mirroring CreateTree's reveal),
// and revokes a link with a confirm — "the leak defense" DESIGN.md asks to surface.

type LinkRow = {
  id: string;
  kind: "owner" | "open" | "anchored";
  seedPersonId: string | null;
  label: string | null;
  revokedAt: Date | string | null;
  createdAt: Date | string;
};

function treeUrl(treeId: string, token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/t/${treeId}?k=${token}`;
}

// "el enlace abierto" / "anclado en {nombre}" / "tu llave de dueña" — fieldbook voice.
function kindLabel(row: LinkRow, nameOf: (id: string) => string | undefined): string {
  if (row.kind === "owner") return "tu llave de dueño/a";
  if (row.kind === "open") return "enlace abierto — para toda la familia";
  const name = row.seedPersonId ? nameOf(row.seedPersonId) : undefined;
  return name ? `anclado en ${name}` : "enlace anclado";
}

function fmtDate(d: Date | string): string {
  const date = new Date(d);
  return date.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
}

export function LinkManager({
  token,
  treeId,
  persons,
  defaultPersonId,
  onClose,
}: {
  token: string;
  treeId: string;
  persons: PersonRow[];
  /** Pre-select the focused person as the anchor target, if any. */
  defaultPersonId?: string | null;
  onClose: () => void;
}) {
  const [links, setLinks] = useState<LinkRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const validDefault =
    defaultPersonId && persons.some((p) => p.id === defaultPersonId) ? defaultPersonId : "";
  const [anchorId, setAnchorId] = useState<string>(validDefault);
  const [label, setLabel] = useState("");
  // The freshly minted anchored link to show in the slip (token is shown ONCE).
  const [minted, setMinted] = useState<{ url: string; personName: string } | null>(null);

  const nameById = useMemo(() => new Map(persons.map((p) => [p.id, p.name])), [persons]);
  const nameOf = useCallback((id: string) => nameById.get(id), [nameById]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  }, []);

  // Fetch the link list. `silent` keeps the existing list on a background refresh
  // (after mint/revoke) so the panel doesn't flash back to "cargando…".
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLinks(null);
      setLoadError(null);
      const res = await listLinksAction(token);
      if (!res.ok) {
        setLoadError("no pudimos cargar los enlaces — reintentá");
        return;
      }
      setLinks(res.data as LinkRow[]);
    },
    [token],
  );

  // Load once on mount. Inline async + cancel guard keeps setState out of the
  // synchronous effect body (react-hooks/set-state-in-effect) and avoids a late
  // write after unmount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await listLinksAction(token);
      if (cancelled) return;
      if (!res.ok) setLoadError("no pudimos cargar los enlaces — reintentá");
      else setLinks(res.data as LinkRow[]);
    })();
    return () => { cancelled = true; };
  }, [token]);

  const mintAnchored = useCallback(async () => {
    if (!anchorId) {
      setError("Elegí a quién va dirigido el enlace.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await mintLinkAction(token, {
      kind: "anchored",
      seedPersonId: anchorId,
      label: label.trim() || null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMinted({ url: treeUrl(treeId, res.data.token), personName: nameOf(anchorId) ?? "esa persona" });
    setLabel("");
    void load(true);
  }, [anchorId, label, token, treeId, nameOf, load]);

  const revoke = useCallback(
    async (row: LinkRow) => {
      const who = kindLabel(row, nameOf);
      if (!window.confirm(`¿Anular este enlace (${who})? Quien lo tenga dejará de poder entrar.`)) return;
      setBusy(true);
      setError(null);
      const res = await revokeLinkAction(token, row.id);
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      flash("Enlace anulado");
      void load(true);
    },
    [token, nameOf, flash, load],
  );

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        flash("Enlace copiado");
      } catch {
        flash("No se pudo copiar — copialo a mano.");
      }
    },
    [flash],
  );

  const waText = minted
    ? encodeURIComponent(`Te sumo al árbol de nuestra familia, en tu rama. Entrá acá: ${minted.url}`)
    : "";

  return (
    <div
      role="dialog"
      aria-label="Compartir y enlaces"
      style={{
        position: "fixed", inset: 0, zIndex: 30,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "64px 20px 20px", overflowY: "auto",
        background: "rgba(34,32,27,.28)",
      }}
      onClick={onClose}
    >
      <section
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative", width: "100%", maxWidth: 560,
          background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 14,
          padding: "26px 28px 24px", boxShadow: "0 40px 90px -36px rgba(34,32,27,.55)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="cerrar"
          style={{
            position: "absolute", top: 12, right: 12, width: 32, height: 32,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", background: "none", color: "var(--muted)", cursor: "pointer", fontSize: 22, lineHeight: 1,
          }}
        >
          ×
        </button>

        <h2 className="pl-zone-title">Compartir el árbol</h2>
        <p className="pl-meta" style={{ marginTop: 2 }}>
          Creá un enlace dirigido a una persona — quien lo reciba aterriza en su rama.
        </p>

        {/* ── Mint an anchored link ─────────────────────────────────────────── */}
        <div className="pl-field" style={{ marginTop: 18 }}>
          <label htmlFor="lm-anchor">¿a quién va dirigido?</label>
          <select
            id="lm-anchor"
            className="pl-input"
            value={anchorId}
            onChange={(e) => setAnchorId(e.target.value)}
          >
            <option value="">— elegí una persona —</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="pl-field">
          <label htmlFor="lm-label">una nota (opcional)</label>
          <input
            id="lm-label"
            className="pl-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="para los primos Méndez"
            maxLength={120}
          />
        </div>
        {error ? <p className="pl-error" role="alert">{error}</p> : null}
        <button className="pl-btn" onClick={mintAnchored} disabled={busy} style={{ marginTop: 4 }}>
          {busy ? "Creando…" : "Crear el enlace"}
        </button>

        {minted ? (
          <div style={{ marginTop: 16 }}>
            <p className="pl-meta">el enlace para {minted.personName} — compartilo solo con quien corresponde:</p>
            <div className="pl-slip" style={{ marginTop: 8 }}>
              <code>{minted.url}</code>
              <button className="pl-act" onClick={() => copy(minted.url)}>Copiar</button>
            </div>
            <div className="pl-actions">
              <a
                className="pl-btn"
                href={`https://wa.me/?text=${waText}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Enviar por WhatsApp
              </a>
              <button className="pl-btn pl-btn--ghost" onClick={() => copy(minted.url)}>Copiar enlace</button>
            </div>
          </div>
        ) : null}

        <hr className="pl-hairline" />

        {/* ── Existing links ────────────────────────────────────────────────── */}
        <h2 className="pl-zone-title" style={{ fontSize: 17 }}>Enlaces del árbol</h2>
        {loadError ? (
          <p className="pl-error" style={{ marginTop: 8 }}>
            {loadError}{" "}
            <button className="pl-act" onClick={() => void load()}>Reintentar</button>
          </p>
        ) : links === null ? (
          <p className="pl-meta" style={{ marginTop: 8 }}>cargando los enlaces…</p>
        ) : links.length === 0 ? (
          <p className="pl-meta" style={{ marginTop: 8 }}>todavía no hay enlaces.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: "12px 0 0", display: "flex", flexDirection: "column", gap: 12 }}>
            {links.map((row) => {
              const revoked = !!row.revokedAt;
              return (
                <li
                  key={row.id}
                  style={{
                    display: "flex", alignItems: "baseline", justifyContent: "space-between",
                    gap: 12, opacity: revoked ? 0.55 : 1,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14.5 }}>
                      {kindLabel(row, nameOf)}
                      {row.label ? <span style={{ color: "var(--muted)", fontStyle: "italic" }}> · {row.label}</span> : null}
                    </div>
                    <div className="pl-meta" style={{ fontSize: 12.5, marginTop: 1 }}>
                      {revoked ? "anulado" : `creado el ${fmtDate(row.createdAt)}`}
                    </div>
                  </div>
                  {revoked ? (
                    <span className="pl-meta" style={{ fontStyle: "italic", whiteSpace: "nowrap" }}>anulado</span>
                  ) : row.kind === "owner" ? (
                    <span className="pl-meta" style={{ fontStyle: "italic", whiteSpace: "nowrap" }}>tu llave</span>
                  ) : (
                    <button
                      className="pl-act"
                      onClick={() => revoke(row)}
                      disabled={busy}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      Anular
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {toast ? <div className="pl-toast">{toast}</div> : null}
    </div>
  );
}
