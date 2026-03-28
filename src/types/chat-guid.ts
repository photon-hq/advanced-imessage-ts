/**
 * ChatGuid helpers -- construct, parse, and inspect chat GUIDs.
 *
 * The wire format for a chat GUID is `"<service>;<style>;<identifier>"` where
 * style is `-` for direct (1:1) chats and `+` for group chats. We always use
 * `"any"` as the service component so the server resolves iMessage vs SMS
 * automatically.
 */

import type { ChatGuid } from "./branded.js";
import { chatGuid } from "./branded.js";

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

/**
 * Create a `ChatGuid` for a direct (1:1) chat.
 *
 * @example
 * ```ts
 * directChat("+1234567890") // "any;-;+1234567890"
 * ```
 */
export function directChat(address: string): ChatGuid {
  return chatGuid(`any;-;${address}`);
}

/**
 * Create a `ChatGuid` for a group chat.
 *
 * @example
 * ```ts
 * groupChat("chat123456") // "any;+;chat123456"
 * ```
 */
export function groupChat(identifier: string): ChatGuid {
  return chatGuid(`any;+;${identifier}`);
}

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

export type ParsedChatGuid =
  | {
      readonly type: "direct";
      readonly address: string;
      readonly raw: ChatGuid;
    }
  | {
      readonly type: "group";
      readonly identifier: string;
      readonly raw: ChatGuid;
    };

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse a `ChatGuid` into a discriminated union describing whether it is a
 * direct or group chat.
 *
 * @throws {Error} If the GUID does not match the expected `<service>;<style>;<id>` format.
 */
export function parseChatGuid(guid: ChatGuid): ParsedChatGuid {
  const parts = (guid as string).split(";");

  if (parts.length < 3) {
    throw new Error(`Invalid chat GUID format: "${guid}"`);
  }

  const style = parts[1];
  const id = parts.slice(2).join(";");

  if (style === "-") {
    return { type: "direct", address: id, raw: guid };
  }

  if (style === "+") {
    return { type: "group", identifier: id, raw: guid };
  }

  throw new Error(`Unknown chat GUID style "${style}" in: "${guid}"`);
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/** Returns `true` if the GUID represents a direct (1:1) chat. */
export function isDirectChat(guid: ChatGuid): boolean {
  return (guid as string).split(";")[1] === "-";
}

/** Returns `true` if the GUID represents a group chat. */
export function isGroupChat(guid: ChatGuid): boolean {
  return (guid as string).split(";")[1] === "+";
}
