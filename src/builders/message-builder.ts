/**
 * Fluent builder for composing rich multi-part messages.
 *
 * Three tiers of message sending:
 * - Tier 1: `im.messages.send(chat, "Hello!")` -- plain string
 * - Tier 2: `im.messages.send(chat, "Hello!", { effect: ... })` -- options
 * - Tier 3: `im.messages.sendComposed(chat, MessageBuilder.multipart()...build())`
 *
 * This builder powers Tier 3.
 */

import type { MessageGuid } from "../types/branded.js";
import type { MessageEffect, TextEffect } from "../types/effects.js";
import type {
  ComposedMessage,
  MessagePart,
  TextFormatInput,
} from "../types/messages.js";

export class MessageBuilder {
  private readonly _parts: MessagePart[] = [];
  private _effect?: MessageEffect;
  private _subject?: string;
  private _replyTo?: MessageGuid | { guid: MessageGuid; partIndex?: number };

  // ---------------------------------------------------------------------------
  // Static factories
  // ---------------------------------------------------------------------------

  /**
   * Create a builder pre-populated with a single text part.
   *
   * ```ts
   * MessageBuilder.text("Hello!").withEffect(MessageEffect.slam).build();
   * ```
   */
  static text(content: string): MessageBuilder {
    const builder = new MessageBuilder();
    builder._parts.push({ text: content, partIndex: 0 });
    return builder;
  }

  /**
   * Create an empty builder for assembling multiple parts.
   *
   * ```ts
   * MessageBuilder.multipart()
   *   .addText("Hey ")
   *   .addMention("@John", "john@icloud.com")
   *   .addText(", check this out")
   *   .build();
   * ```
   */
  static multipart(): MessageBuilder {
    return new MessageBuilder();
  }

  // ---------------------------------------------------------------------------
  // Content parts
  // ---------------------------------------------------------------------------

  /** Append a text part. */
  addText(text: string): this {
    this._parts.push({ text, partIndex: this._parts.length });
    return this;
  }

  /**
   * Append a mention part.
   *
   * @param displayText - Visible text shown in the bubble (e.g. "\@John").
   * @param address - The address to mention (e.g. "john\@icloud.com" or "+1234567890").
   */
  addMention(displayText: string, address: string): this {
    this._parts.push({
      text: displayText,
      mention: address,
      partIndex: this._parts.length,
    });
    return this;
  }

  /**
   * Append an attachment part by GUID returned from `attachments.upload()`.
   *
   * @param guid - GUID returned by a prior `attachments.upload()` call.
   * @param options - Optional display name for the file.
   */
  addUploadedAttachment(guid: string, options?: { name?: string }): this {
    this._parts.push({
      attachmentGuid: guid,
      attachmentName: options?.name,
      partIndex: this._parts.length,
    });
    return this;
  }

  // ---------------------------------------------------------------------------
  // Text formatting
  // ---------------------------------------------------------------------------

  /**
   * Find the last text part in the parts list.
   * Formatting methods operate on this part.
   */
  private lastTextPart(): MessagePart & { text: string } {
    for (let i = this._parts.length - 1; i >= 0; i--) {
      const part = this._parts[i];
      if (part === undefined) {
        continue;
      }
      if (part.text != null) {
        return part as MessagePart & { text: string };
      }
    }
    throw new Error(
      "MessageBuilder: cannot apply formatting -- no text part exists. " +
        "Add a text part with addText() or use MessageBuilder.text() first."
    );
  }

  /**
   * Push a formatting entry onto the last text part.
   *
   * Because `MessagePart.formatting` is `readonly`, we reconstruct the part
   * with the new entry appended.
   */
  private pushFormat(entry: TextFormatInput): void {
    const part = this.lastTextPart();
    const idx = this._parts.indexOf(part);
    const existing: readonly TextFormatInput[] = part.formatting ?? [];
    this._parts[idx] = { ...part, formatting: [...existing, entry] };
  }

  /** Apply **bold** formatting to a range within the last text part. */
  bold(start: number, length: number): this {
    this.pushFormat({ type: "bold", start, length });
    return this;
  }

  /** Apply *italic* formatting to a range within the last text part. */
  italic(start: number, length: number): this {
    this.pushFormat({ type: "italic", start, length });
    return this;
  }

  /** Apply underline formatting to a range within the last text part. */
  underline(start: number, length: number): this {
    this.pushFormat({ type: "underline", start, length });
    return this;
  }

  /** Apply ~~strikethrough~~ formatting to a range within the last text part. */
  strikethrough(start: number, length: number): this {
    this.pushFormat({ type: "strikethrough", start, length });
    return this;
  }

  /** Apply a text animation effect to a range within the last text part. */
  effect(start: number, length: number, effect: TextEffect): this {
    this.pushFormat({ type: "effect", start, length, effect });
    return this;
  }

  // ---------------------------------------------------------------------------
  // Message-level options
  // ---------------------------------------------------------------------------

  /** Set a full-screen or bubble effect for the message. */
  withEffect(effect: MessageEffect): this {
    this._effect = effect;
    return this;
  }

  /** Set a subject line for the message. */
  withSubject(subject: string): this {
    this._subject = subject;
    return this;
  }

  /**
   * Mark this message as a reply to an existing message.
   *
   * @param guid - The GUID of the message to reply to.
   * @param partIndex - Optionally target a specific part of the parent message.
   */
  asReplyTo(guid: MessageGuid, partIndex?: number): this {
    this._replyTo = partIndex == null ? guid : { guid, partIndex };
    return this;
  }

  // ---------------------------------------------------------------------------
  // Terminal
  // ---------------------------------------------------------------------------

  /**
   * Assemble and return the composed message.
   *
   * @throws If no parts have been added.
   */
  build(): ComposedMessage {
    if (this._parts.length === 0) {
      throw new Error(
        "MessageBuilder: cannot build an empty message. " +
          "Add at least one part with addText(), addMention(), or addUploadedAttachment()."
      );
    }

    const message: ComposedMessage = {
      parts: [...this._parts],
      ...(this._effect != null && { effect: this._effect }),
      ...(this._subject != null && { subject: this._subject }),
      ...(this._replyTo != null && { replyTo: this._replyTo }),
    };

    return message;
  }
}
