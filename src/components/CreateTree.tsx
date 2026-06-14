"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createTreeAction, mintLinkAction } from "@/app/actions";

// T5-B — the home create-tree page + "Dos manos" owner-link reveal.
// Flow: name the tree -> createTreeAction (owner token) -> mintLinkAction(open)
// for the shareable join link -> show both links, share-vs-keep made unmistakable.

type Phase =
  | { step: "form" }
  | { step: "reveal"; treeId: string; ownerToken: string; joinToken: string };

function treeUrl(treeId: string, token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/t/${treeId}?k=${token}`;
}

export function CreateTree() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<Phase>({ step: "form" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  }, []);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed) {
        setError("Poné el nombre de la familia para empezar.");
        return;
      }
      setBusy(true);
      setError(null);
      const created = await createTreeAction(trimmed);
      if (!created.ok) {
        setError(created.error);
        setBusy(false);
        return;
      }
      // Mint the open "join" link right away so the reveal can hand it over.
      const join = await mintLinkAction(created.data.token, { kind: "open" });
      if (!join.ok) {
        setError(join.error);
        setBusy(false);
        return;
      }
      setPhase({
        step: "reveal",
        treeId: created.data.treeId,
        ownerToken: created.data.token,
        joinToken: join.data.token,
      });
      setBusy(false);
    },
    [name],
  );

  if (phase.step === "form") {
    return (
      <main className="pl-page">
        <form className="pl-wrap" onSubmit={submit} style={{ textAlign: "center" }}>
          <div className="pl-display" style={{ fontSize: 22, marginBottom: 28 }}>
            plurali<span style={{ color: "var(--vine)" }}>.</span>
          </div>
          <h1 className="pl-display">Empezá el árbol de tu familia.</h1>
          <p className="pl-sub">
            Le ponés un nombre, y después compartís un enlace para que tus parientes
            sumen su parte. Sin cuentas, sin contraseñas.
          </p>
          <div style={{ maxWidth: 420, margin: "32px auto 0", textAlign: "left" }}>
            <div className="pl-field">
              <label htmlFor="tree-name">nombre de la familia</label>
              <input
                id="tree-name"
                className="pl-input pl-input--name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Familia Müller"
                autoFocus
                maxLength={120}
                // autoFocus draws focus-tracking attributes from some dev
                // environments/extensions before hydration — benign, suppress it.
                suppressHydrationWarning
              />
            </div>
            {error ? <p className="pl-error" role="alert">{error}</p> : null}
            <button className="pl-btn pl-btn--block" type="submit" disabled={busy} style={{ marginTop: 18 }}>
              {busy ? "Creando…" : "Crear el árbol"}
            </button>
          </div>
        </form>
        {toast ? <div className="pl-toast">{toast}</div> : null}
      </main>
    );
  }

  // ── Reveal ("Dos manos") ──────────────────────────────────────────────────
  const join = treeUrl(phase.treeId, phase.joinToken);
  const admin = treeUrl(phase.treeId, phase.ownerToken);
  const waText = encodeURIComponent(`Estamos armando el árbol de nuestra familia. Sumá tu parte acá: ${join}`);
  const mailBody = encodeURIComponent(`Estamos armando el árbol de nuestra familia.\n\nEntrá y sumá tu parte acá:\n${join}`);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(label);
    } catch {
      flash("No se pudo copiar — copialo a mano.");
    }
  };

  const downloadAdmin = () => {
    const blob = new Blob(
      [`plurali — tu llave privada para volver a editar el árbol.\nNo la compartas.\n\n${admin}\n`],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plurali-llave-privada.txt";
    a.click();
    URL.revokeObjectURL(url);
    flash("Llave descargada");
  };

  return (
    <main className="pl-page">
      <div className="pl-wrap">
        <h1 className="pl-display">Tu árbol está listo — ahora, tu familia.</h1>
        <p className="pl-sub">Quedan dos enlaces. Uno se reparte; el otro lo guardás. No los confundas.</p>

        {/* ZONE 1 — Para compartir (dominant) */}
        <section style={{ marginTop: 34 }}>
          <h2 className="pl-zone-title">Para compartir</h2>
          <p className="pl-meta" style={{ marginTop: 2 }}>el enlace abierto para todos tus parientes</p>
          <div className="pl-slip" style={{ marginTop: 14 }}>
            <code>{join}</code>
            <button className="pl-act" onClick={() => copy(join, "Enlace copiado")}>Copiar</button>
          </div>
          <div className="pl-actions">
            <a className="pl-btn" href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer">
              Enviar por WhatsApp
            </a>
            <button className="pl-btn pl-btn--ghost" onClick={() => copy(join, "Enlace copiado")}>Copiar enlace</button>
            <a className="pl-btn pl-btn--ghost" href={`mailto:?subject=${encodeURIComponent("El árbol de nuestra familia")}&body=${mailBody}`}>
              Mandar por mail
            </a>
          </div>
          <p className="pl-meta" style={{ marginTop: 12 }}>
            Cualquiera que reciba este enlace puede sumar parientes y recuerdos. No hace falta que se registre nadie.
          </p>
        </section>

        <hr className="pl-hairline" />

        {/* ZONE 2 — Para vos (quiet) */}
        <section className="pl-zone--keep">
          <span className="pl-eyebrow">Solo para vos</span>
          <h2 className="pl-zone-title" style={{ marginTop: 4 }}>Tu llave para volver</h2>
          <p className="pl-meta" style={{ marginTop: 2 }}>
            Guardala. Con esto volvés a editar el árbol desde cualquier lado. No la compartas.
          </p>
          <div className="pl-slip" style={{ marginTop: 12 }}>
            <code>{admin.replace(/(k=.{6}).+/, "$1…")}</code>
            <button className="pl-act" onClick={() => copy(admin, "Llave copiada")}>Copiar</button>
          </div>
          <div className="pl-actions">
            <button className="pl-btn pl-btn--ghost" onClick={downloadAdmin}>Descargar</button>
          </div>
        </section>

        <div style={{ marginTop: 30, textAlign: "center" }}>
          <button className="pl-btn" onClick={() => router.push(`/t/${phase.treeId}?k=${phase.ownerToken}`)}>
            Ir al árbol →
          </button>
        </div>
      </div>
      {toast ? <div className="pl-toast">{toast}</div> : null}
    </main>
  );
}
