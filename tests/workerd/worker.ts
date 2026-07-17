/**
 * Workers-compatibility gate: bundles the SDK for workerd and boots it.
 * If the package (or any dependency) reaches for node:* APIs, gRPC, or
 * other Workers-hostile surface, this bundle or boot fails in CI.
 */
import { createHttpClient } from "../../packages/http/src/index.ts";

export default {
  fetch(): Response {
    const im = createHttpClient({
      address: "https://middleware.invalid",
      token: () => Promise.resolve("test-token"),
      retry: true,
      autoIdempotency: true,
    });
    // Constructing the client exercises the transport factory, the hey-api
    // client, and the ts-proto codec imports — the whole Workers-sensitive
    // dependency graph — without needing a live middleware.
    const namespaces = [
      im.messages,
      im.chats,
      im.groups,
      im.attachments,
      im.addresses,
      im.polls,
      im.locations,
    ].filter(Boolean).length;
    return Response.json({ ok: namespaces === 7 });
  },
};
