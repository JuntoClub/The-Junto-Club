import type { Context } from "@netlify/functions";
import { createHash } from "node:crypto";

// eBay Marketplace Account Deletion / Closure notification endpoint.
//
// eBay requires every app that persists eBay data to expose this endpoint so a user's data can
// be deleted when they close their account (GDPR/CCPA). The Production keyset stays DISABLED until
// this endpoint is live and eBay's challenge handshake passes.
//
// THE COMPLIANCE POSTURE (do not break): this pipeline stores NO eBay user identifiers — no
// usernames, no user IDs, no buyer/seller IDs. Only sale price, sale date, and condition/grade.
// So a deletion notice has nothing personal to purge — the deletion step is a NO-OP BY DESIGN.
// If the data model ever changes to store an eBay identifier, the purge logic goes in the marked
// hook below AND this no-op posture is no longer true — flag it before adding.
//
// eBay uses TWO message types on this one URL:
//   GET  ?challenge_code=…  → verification handshake (respond with a SHA-256 hash)
//   POST { …notification… } → the actual "user closed account" message (ack 200, then purge)
//
// Secrets come from Netlify env vars, never from source and never committed:
//   EBAY_VERIFICATION_TOKEN  a value WE choose (32–80 chars, [A-Za-z0-9_-]); eBay echoes it in the hash
//   EBAY_ENDPOINT_URL        this endpoint's exact public URL; part of the hash, must match eBay's config

declare const Netlify: { env: { get(name: string): string | undefined } };

export default async (req: Request, _context: Context) => {
  // ── GET: eBay challenge/verification handshake ──────────────────────────────────────────
  // hash = SHA-256( challengeCode + verificationToken + endpointURL ), returned as lowercase hex.
  // Order is exact: challengeCode, then token, then endpoint URL. Any drift fails the handshake.
  if (req.method === "GET") {
    const token = Netlify.env.get("EBAY_VERIFICATION_TOKEN");
    const endpointUrl = Netlify.env.get("EBAY_ENDPOINT_URL");
    if (!token || !endpointUrl) {
      // Not a client error — the endpoint just isn't configured yet. Never echo which var is missing.
      return json({ error: "Endpoint is not configured." }, 500);
    }
    const challengeCode = new URL(req.url).searchParams.get("challenge_code");
    if (!challengeCode) {
      return json({ error: "Missing challenge_code." }, 400);
    }
    const challengeResponse = createHash("sha256")
      .update(challengeCode + token + endpointUrl)
      .digest("hex");
    return json({ challengeResponse }, 200);
  }

  // ── POST: account-deletion notification ─────────────────────────────────────────────────
  if (req.method === "POST") {
    // Extract only a NON-personal identifier for the receipt log. Never read/log the personal
    // fields (username, userId, eiasToken) — collecting them would defeat the whole posture.
    let notificationId = "unknown";
    try {
      const body = (await req.json()) as {
        notification?: { notificationId?: string };
        notificationId?: string;
      };
      notificationId = body?.notification?.notificationId ?? body?.notificationId ?? "unknown";
    } catch {
      // A body we cannot parse is not a valid notification. eBay always sends JSON.
      return json({ error: "Invalid notification body." }, 400);
    }

    // Receipt log: timestamp + notification id ONLY. No payload, no personal data. Proves the
    // endpoint is working without collecting the data we are meant not to hold.
    console.log(
      `[ebay-deletion] notification received id=${notificationId} at=${new Date().toISOString()}`,
    );

    // ── DELETION HOOK ─────────────────────────────────────────────────────────────────────
    // NO-OP BY DESIGN. We store no eBay user identifiers, so there is nothing to purge. If the
    // data model ever begins storing an eBay username / user ID / buyer-seller ID, the purge
    // for this notification goes HERE — and doing so breaks the no-op compliance posture, so it
    // must be a deliberate, reviewed change, never a silent one.
    // ──────────────────────────────────────────────────────────────────────────────────────

    // Acknowledge. eBay needs a prompt 2xx or it will retry and may mark the endpoint unhealthy.
    return json({ ok: true }, 200);
  }

  return json({ error: "Method not allowed." }, 405);
};

// No `config.path` override: the function is served at the default, stable path derived from the
// filename — https://juntoclubco.com/.netlify/functions/ebay-deletion. THIS EXACT STRING must be
// stored in EBAY_ENDPOINT_URL and registered in eBay's developer console (it is part of the hash).

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
