import { ValidationError } from "../errors/imessage-error.ts";

/**
 * Chat-guid validation for chat GUID strings used by the iMessage server.
 *
 * The public SDK contract uses `"any"`-prefixed chat guid strings:
 * `"any;<style>;<identifier>"`, where `style` is `-` for a direct (1:1)
 * chat and `+` for a group chat.
 *
 * Public SDK methods keep `chat` as a plain `string`, but that string is
 * expected to already be a structured chat guid such as:
 * - `"any;-;alice@example.com"`
 * - `"any;+;chat123"`
 *
 * The server may accept other service-prefixed forms, but the SDK keeps its
 * public contract narrower so usage stays predictable and easy to document.
 *
 * In other words: the SDK does not guess whether a bare string is an address,
 * group id, or some other identifier. Callers pass the server-style chat guid,
 * typically `chat.guid` from an earlier SDK call.
 */

const RAW_CHAT_GUID = /^any;[-+];.+$/;
const STRUCTURED_CHAT_GUID_HELP =
  'chat must start with "any;-;" for direct chats or "any;+;" for group chats, for example "any;-;alice@example.com" or "any;+;chat123". Pass `chat.guid` from a prior SDK call.';

/**
 * Validate and normalize a user-supplied chat guid.
 *
 * The SDK intentionally does not auto-wrap bare strings into direct chats.
 * Group ids, direct-chat addresses, and arbitrary caller mistakes are all
 * plain strings at runtime, so guessing here creates ambiguous behavior.
 *
 * @throws {ValidationError} If `chat` is empty or does not start with
 *                           `any;-;` or `any;+;`.
 */
export function normalizeChatGuid(chat: string): string {
  const normalized = chat.trim();

  if (!normalized) {
    throw new ValidationError(STRUCTURED_CHAT_GUID_HELP, {
      code: "invalidArgument",
      context: { field: "chat", value: chat },
      grpcCode: 3,
      retryable: false,
    });
  }

  if (!RAW_CHAT_GUID.test(normalized)) {
    throw new ValidationError(STRUCTURED_CHAT_GUID_HELP, {
      code: "invalidArgument",
      context: { field: "chat", value: normalized },
      grpcCode: 3,
      retryable: false,
    });
  }

  return normalized;
}
