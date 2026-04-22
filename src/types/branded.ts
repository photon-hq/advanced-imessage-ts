/**
 * Branded types for compile-time safety.
 *
 * A branded type is a primitive (string or number) with an invisible tag that
 * prevents accidental mixing of identifiers at compile time. There is zero
 * runtime cost -- the brand exists only in the type system.
 *
 * The only way to create a branded value is through the constructor functions
 * exported below.
 */

declare const Brand: unique symbol;

/**
 * Utility type that attaches an invisible brand `B` to base type `T`.
 */
export type Brand<T, B extends string> = T & { readonly [Brand]: B };

// ---------------------------------------------------------------------------
// Branded identifier types
// ---------------------------------------------------------------------------

/** A chat GUID such as `"any;-;+1234567890"` or `"any;+;chat12345"`. */
export type ChatGuid = Brand<string, "ChatGuid">;

/** A message GUID as returned by the server. */
export type MessageGuid = Brand<string, "MessageGuid">;

/** An attachment GUID as returned by the server. */
export type AttachmentGuid = Brand<string, "AttachmentGuid">;

// ---------------------------------------------------------------------------
// Constructor functions
// ---------------------------------------------------------------------------

/** Brand a raw string as a `ChatGuid`. */
export function chatGuid(raw: string): ChatGuid {
  return raw as ChatGuid;
}

/** Brand a raw string as a `MessageGuid`. */
export function messageGuid(raw: string): MessageGuid {
  return raw as MessageGuid;
}

/** Brand a raw string as an `AttachmentGuid`. */
export function attachmentGuid(raw: string): AttachmentGuid {
  return raw as AttachmentGuid;
}
