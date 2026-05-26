# Parked idea: True federation (DNS-style genealogy)

Status: **PARKED — investigate later.** Not for v1. Captured during office-hours
on 2026-05-24 so it isn't lost.

## The idea in one line

No central tree. Each person or family **hosts their own branch**, and the full
tree is *assembled on demand* by following signed links between branches —
exactly like DNS delegation plus certificate chains.

## Why it's appealing

- It's the maximally faithful expression of the original inspiration: "I got the
  decentralization idea from DNS and certificate signing."
- No single owner, no single point of failure, no company holding your family's
  data. Your branch is *yours*, forever, even if plurali-the-service disappears.
- Authority maps cleanly onto the real world: each family is authoritative for
  its own members, the same way each domain is authoritative for its own records.
- It survives generations by design — when the owner dies, nothing breaks,
  because there was never a central owner to lose.

## How it might work (sketch)

- Each branch = a small signed document (think a zone file) listing its people
  and **pointers** ("delegations") to other branches: "for my mother's side,
  follow this link, here's their public key."
- Joining two branches = the shared ancestor appears in both branches' documents,
  each signed by its own family. A resolver walks the links and stitches the
  graph, verifying signatures along the way (the cert chain).
- Trust = signatures. You believe a branch's data because someone you already
  trust signed a delegation to it.

## The hard parts (why it's parked, not built)

1. **Hosting.** "Each family hosts their branch" means every family needs a place
   to put a file that's always online. Most people can't/won't run a server.
   (DNS works because registrars exist. Who's the registrar here?)
2. **The shared-node merge.** Two families both describe the same grandmother.
   Whose version renders? Federation makes this *harder*, not easier, than a
   central tree — there's no referee.
3. **Key management.** Real people lose keys. A lost key = a branch that can never
   be updated again. Genealogy is multi-generational; key custody over 50 years
   is brutal.
4. **The reading experience.** Assembling a tree by walking signed links on demand
   is slow and fragile compared to one database query. The "whoa, it grew
   overnight" moment is hard to deliver when resolution can partially fail.
5. **Discovery.** How do you even find the cousin branch to link to?

## What to research when you pick this back up

- **DNS delegation + DNSSEC** — the literal model: zones, NS delegation, signed
  records, chain of trust to a root.
- **Certificate transparency / cert chains** — trust via signature chains.
- **DIDs (Decentralized Identifiers) + Verifiable Credentials (W3C)** — modern,
  genealogy-relevant: a person as a DID, a "child-of" claim as a signed credential.
- **AT Protocol (Bluesky)** — PDS-per-user federation that actually shipped to
  millions; the "personal data server" model is close to "host your own branch,"
  and they solved discovery + portable identity. Best living example to study.
- **Solid (Tim Berners-Lee)** — personal data "pods"; the canonical "you host your
  own data" project, and a cautionary tale about adoption friction.
- **Nostr** — relays + signed events; simplest federation primitive, look at how
  it punts hosting to relays.
- **CRDTs** — for the merge problem if you want offline-first branches that
  reconcile (Automerge, Yjs).
- **GEDCOM / GEDCOM X** — the genealogy interchange standard. Even federated, you
  want a standard serialization per branch so tools interoperate.

## The pragmatic bridge (how v1 can stay federation-friendly)

Even if v1 is a normal centralized app, you can leave the door open:
- Model each person with a **stable, portable ID** (not just an auto-increment DB
  row) — a UUID or DID-shaped string — so a node can later be addressed across hosts.
- Keep an **explicit "owned-by branch" field** on every node so the data already
  knows which family is authoritative. Federation later = letting branches live on
  different hosts; the ownership graph is already there.
- Support **export per branch** (one family's subtree as a signed/standalone file).
  That export *is* the federation primitive in embryo.

Do these three and the centralized v1 is a strict subset of the federated dream,
not a dead end.
