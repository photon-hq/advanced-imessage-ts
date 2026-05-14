import { describe, expect, it } from "bun:test";
import { ValidationError } from "../../src/errors/imessage-error.ts";
import { MessageReactionKind } from "../../src/generated/photon/imessage/v1/message_types.ts";
import { MessagesResource } from "../../src/resources/messages.ts";
import type { UploadAttachmentResult } from "../../src/types/attachments.ts";
import { MessageEffect, TextEffect } from "../../src/types/effects.ts";

const chatGuidValue = "any;-;alice.com";
const attachmentGuidValue = "attachment-1";
const messageGuidValue = "message-1";
const now = new Date("2026-05-04T00:00:00.000Z");

function makeMessage(guid: string) {
  return {
    appliedReactions: [],
    chatGuids: [chatGuidValue],
    content: {
      attachments: [],
      formatting: [],
      mentions: [],
      text: "ok",
    },
    dataDetectorResultsPresent: false,
    dateCreated: now,
    didNotifyRecipient: false,
    guid,
    isArchived: false,
    isAudioMessage: false,
    isAutoReply: false,
    isCorrupt: false,
    isDelayed: false,
    isDelivered: false,
    isDeliveredQuietly: false,
    isExpirable: false,
    isForward: false,
    isFromMe: true,
    isSent: true,
    isServiceMessage: false,
    isSpam: false,
    isSystemMessage: false,
    itemType: 0,
    placedStickers: [],
    sendErrorCode: 0,
  };
}

function makeUploadResult(
  guid: string,
  fileName: string
): UploadAttachmentResult {
  return {
    attachment: {
      fileName,
      guid,
      isHidden: false,
      isOutgoing: true,
      isSticker: false,
      mimeType: "image/png",
      totalBytes: 3,
      transferState: "finished",
      uti: "public.png",
    },
  };
}

describe("MessagesResource", () => {
  it("includes sticker width when placing a sticker", async () => {
    let capturedRequest: Record<string, unknown> | undefined;
    const resource = new MessagesResource({
      async placeSticker(request: Record<string, unknown>) {
        capturedRequest = request;
        return {
          message: makeMessage("sent-1"),
        };
      },
    } as any);

    await resource.placeSticker(
      chatGuidValue,
      messageGuidValue,
      attachmentGuidValue,
      {
        x: 10,
        y: 20,
        width: 80,
      }
    );

    expect(capturedRequest?.placement).toEqual({
      x: 10,
      y: 20,
      scale: undefined,
      rotation: undefined,
      width: 80,
    });
    expect(capturedRequest?.sticker).toEqual({
      attachmentGuid: attachmentGuidValue,
    });
  });

  it("forwards attachmentGuid on each multipart part", async () => {
    let capturedRequest: Record<string, unknown> | undefined;
    const resource = new MessagesResource({
      async sendMultipartMessage(request: Record<string, unknown>) {
        capturedRequest = request;
        return { message: makeMessage("sent-multi") };
      },
    } as any);

    await resource.sendMultipart(chatGuidValue, [
      { text: "look at these" },
      { attachmentGuid: "att-a", attachmentName: "a.jpg" },
      { attachmentGuid: "att-b", attachmentName: "b.jpg" },
    ]);

    const parts = capturedRequest?.parts as Record<string, unknown>[];
    expect(parts).toHaveLength(3);
    expect(parts[0]?.attachment).toBeUndefined();
    expect(parts[1]?.attachment).toEqual({
      attachmentGuid: "att-a",
      attachmentName: "a.jpg",
    });
    expect(parts[2]?.attachment).toEqual({
      attachmentGuid: "att-b",
      attachmentName: "b.jpg",
    });
  });

  it("preserves nextPageToken on listRecent", async () => {
    const resource = new MessagesResource({
      async listRecentMessages() {
        return {
          messages: [makeMessage("recent-1"), makeMessage("recent-2")],
          nextPageToken: "token-recent-2",
        };
      },
    } as any);

    const page = await resource.listRecent({ pageSize: 2 });

    expect(page.messages.map((message) => message.guid)).toEqual([
      "recent-1",
      "recent-2",
    ]);
    expect(page.nextPageToken).toBe("token-recent-2");
  });

  it("preserves nextPageToken on listInChat", async () => {
    const resource = new MessagesResource({
      async listChatMessages() {
        return {
          messages: [makeMessage("chat-1")],
          nextPageToken: "token-chat-1",
        };
      },
    } as any);

    const page = await resource.listInChat(chatGuidValue, { pageSize: 1 });

    expect(page.messages.map((message) => message.guid)).toEqual(["chat-1"]);
    expect(page.nextPageToken).toBe("token-chat-1");
  });

  it("rejects unsupported reaction kinds instead of coercing them", async () => {
    const resource = new MessagesResource({} as any);

    expect(() =>
      resource.setReaction(
        chatGuidValue,
        messageGuidValue,
        {
          kind: "sticker",
        } as any,
        true
      )
    ).toThrow("Unsupported reaction kind: sticker");
  });

  // ---- exhaustive enum coverage --------------------------------------------
  // These tests verify SDK→wire encoding for every enum value at the unit
  // layer. Real send-to-helper coverage is sampled in examples/messages/*
  // because the helper rate-limits high-volume sends.

  describe("MessageEffect → wire effectId (exhaustive)", () => {
    for (const [name, value] of Object.entries(MessageEffect)) {
      it(`forwards effect.${name}`, async () => {
        let captured: Record<string, unknown> | undefined;
        const resource = new MessagesResource({
          async sendTextMessage(request: Record<string, unknown>) {
            captured = request;
            return { message: makeMessage(`fx-${name}`) };
          },
        } as any);

        await resource.sendText(chatGuidValue, "hi", { effect: value });
        expect(captured?.effectId).toBe(value);
      });
    }
  });

  it("forwards sendText feature toggles using the server field names", async () => {
    let captured: Record<string, unknown> | undefined;
    const resource = new MessagesResource({
      async sendTextMessage(request: Record<string, unknown>) {
        captured = request;
        return { message: makeMessage("feature-toggles") };
      },
    } as any);

    await resource.sendText(chatGuidValue, "https://example.com", {
      enableDataDetection: true,
      enableLinkPreview: true,
    });

    expect(captured?.enableDataDetection).toBe(true);
    expect(captured?.enableLinkPreview).toBe(true);
  });

  it("forwards sendMultipart data detection using the server field name", async () => {
    let captured: Record<string, unknown> | undefined;
    const resource = new MessagesResource({
      async sendMultipartMessage(request: Record<string, unknown>) {
        captured = request;
        return { message: makeMessage("multipart-feature-toggles") };
      },
    } as any);

    await resource.sendMultipart(
      chatGuidValue,
      [{ text: "https://example.com" }],
      { enableDataDetection: true }
    );

    expect(captured?.enableDataDetection).toBe(true);
  });

  describe("TextFormatInput → wire formatting (exhaustive)", () => {
    for (const type of [
      "bold",
      "italic",
      "underline",
      "strikethrough",
    ] as const) {
      it(`forwards simple format type "${type}"`, async () => {
        let captured: Record<string, unknown> | undefined;
        const resource = new MessagesResource({
          async sendTextMessage(request: Record<string, unknown>) {
            captured = request;
            return { message: makeMessage(`fmt-${type}`) };
          },
        } as any);

        await resource.sendText(chatGuidValue, "hello world", {
          formatting: [{ type, start: 0, length: 5 }],
        });

        expect(captured?.formatting).toEqual([
          { type, effectName: undefined, start: 0, length: 5 },
        ]);
      });
    }

    for (const [eName, eValue] of Object.entries(TextEffect)) {
      it(`forwards effect format with TextEffect.${eName}`, async () => {
        let captured: Record<string, unknown> | undefined;
        const resource = new MessagesResource({
          async sendTextMessage(request: Record<string, unknown>) {
            captured = request;
            return { message: makeMessage(`fx-${eName}`) };
          },
        } as any);

        await resource.sendText(chatGuidValue, "hello", {
          formatting: [{ type: "effect", start: 0, length: 5, effect: eValue }],
        });

        expect(captured?.formatting).toEqual([
          { type: "effect", effectName: eValue, start: 0, length: 5 },
        ]);
      });
    }

    it("forwards multiple non-overlapping ranges in declaration order", async () => {
      let captured: Record<string, unknown> | undefined;
      const resource = new MessagesResource({
        async sendTextMessage(request: Record<string, unknown>) {
          captured = request;
          return { message: makeMessage("multi") };
        },
      } as any);

      await resource.sendText(chatGuidValue, "abcdefghij", {
        formatting: [
          { type: "bold", start: 0, length: 3 },
          { type: "italic", start: 4, length: 3 },
          { type: "effect", start: 8, length: 2, effect: TextEffect.shake },
        ],
      });

      expect(captured?.formatting).toEqual([
        { type: "bold", effectName: undefined, start: 0, length: 3 },
        { type: "italic", effectName: undefined, start: 4, length: 3 },
        {
          type: "effect",
          effectName: TextEffect.shake,
          start: 8,
          length: 2,
        },
      ]);
    });

    it("forwards an empty formatting array as []", async () => {
      let captured: Record<string, unknown> | undefined;
      const resource = new MessagesResource({
        async sendTextMessage(request: Record<string, unknown>) {
          captured = request;
          return { message: makeMessage("empty") };
        },
      } as any);

      await resource.sendText(chatGuidValue, "hi", { formatting: [] });
      expect(captured?.formatting).toEqual([]);
    });
  });

  describe("SettableMessageReaction.kind → wire MessageReactionKind (exhaustive)", () => {
    const cases = [
      ["love", MessageReactionKind.MESSAGE_REACTION_KIND_LOVE],
      ["like", MessageReactionKind.MESSAGE_REACTION_KIND_LIKE],
      ["dislike", MessageReactionKind.MESSAGE_REACTION_KIND_DISLIKE],
      ["laugh", MessageReactionKind.MESSAGE_REACTION_KIND_LAUGH],
      ["emphasize", MessageReactionKind.MESSAGE_REACTION_KIND_EMPHASIZE],
      ["question", MessageReactionKind.MESSAGE_REACTION_KIND_QUESTION],
      ["emoji", MessageReactionKind.MESSAGE_REACTION_KIND_EMOJI],
    ] as const;

    for (const [kind, wire] of cases) {
      it(`setReaction kind "${kind}" → ${MessageReactionKind[wire]}`, async () => {
        let captured: Record<string, unknown> | undefined;
        const resource = new MessagesResource({
          async setReaction(request: Record<string, unknown>) {
            captured = request;
            return { message: makeMessage(`r-${kind}`) };
          },
        } as any);

        await resource.setReaction(
          chatGuidValue,
          messageGuidValue,
          {
            kind,
            emoji: kind === "emoji" ? "👻" : undefined,
          },
          true
        );

        expect((captured?.reaction as Record<string, unknown>)?.kind).toBe(
          wire
        );
        expect(captured?.isSet).toBe(true);
      });
    }

    it("setReaction forwards isSet=false", async () => {
      let captured: Record<string, unknown> | undefined;
      const resource = new MessagesResource({
        async setReaction(request: Record<string, unknown>) {
          captured = request;
          return { message: makeMessage("r-rm") };
        },
      } as any);

      await resource.setReaction(
        chatGuidValue,
        messageGuidValue,
        {
          kind: "love",
        },
        false
      );
      expect(captured?.isSet).toBe(false);
    });
  });

  describe("replyTo → wire ReplyTarget (exhaustive)", () => {
    it("string form maps to messageGuid with no partIndex", async () => {
      let captured: Record<string, unknown> | undefined;
      const resource = new MessagesResource({
        async sendTextMessage(request: Record<string, unknown>) {
          captured = request;
          return { message: makeMessage("r-str") };
        },
      } as any);

      await resource.sendText(chatGuidValue, "hi", {
        replyTo: messageGuidValue,
      });

      expect(captured?.replyTo).toEqual({
        messageGuid: messageGuidValue,
        targetPartIndex: undefined,
      });
    });

    it("{ guid } object form", async () => {
      let captured: Record<string, unknown> | undefined;
      const resource = new MessagesResource({
        async sendTextMessage(request: Record<string, unknown>) {
          captured = request;
          return { message: makeMessage("r-obj") };
        },
      } as any);

      await resource.sendText(chatGuidValue, "hi", {
        replyTo: { guid: messageGuidValue },
      });

      expect(captured?.replyTo).toEqual({
        messageGuid: messageGuidValue,
        targetPartIndex: undefined,
      });
    });

    it("{ guid, partIndex } object form forwards partIndex", async () => {
      let captured: Record<string, unknown> | undefined;
      const resource = new MessagesResource({
        async sendTextMessage(request: Record<string, unknown>) {
          captured = request;
          return { message: makeMessage("r-part") };
        },
      } as any);

      await resource.sendText(chatGuidValue, "hi", {
        replyTo: { guid: messageGuidValue, partIndex: 2 },
      });

      expect(captured?.replyTo).toEqual({
        messageGuid: messageGuidValue,
        targetPartIndex: 2,
      });
    });

    it("undefined replyTo omits the field", async () => {
      let captured: Record<string, unknown> | undefined;
      const resource = new MessagesResource({
        async sendTextMessage(request: Record<string, unknown>) {
          captured = request;
          return { message: makeMessage("r-none") };
        },
      } as any);

      await resource.sendText(chatGuidValue, "hi");
      expect(captured?.replyTo).toBeUndefined();
    });
  });

  describe("chat-ref normalisation in send", () => {
    it("rejects a bare address before hitting transport", async () => {
      let captured: Record<string, unknown> | undefined;
      const resource = new MessagesResource({
        async sendTextMessage(request: Record<string, unknown>) {
          captured = request;
          return { message: makeMessage("c-bare") };
        },
      } as any);

      await expect(
        resource.sendText("alice@example.com", "hi")
      ).rejects.toBeInstanceOf(ValidationError);
      expect(captured).toBeUndefined();
    });

    it("raw `any;-;...` passes through unchanged", async () => {
      let captured: Record<string, unknown> | undefined;
      const resource = new MessagesResource({
        async sendTextMessage(request: Record<string, unknown>) {
          captured = request;
          return { message: makeMessage("c-raw") };
        },
      } as any);

      await resource.sendText("any;-;alice@example.com", "hi");
      expect(captured?.chatGuid).toBe("any;-;alice@example.com");
    });

    it("`any;+;<groupId>` passes through unchanged", async () => {
      let captured: Record<string, unknown> | undefined;
      const resource = new MessagesResource({
        async sendTextMessage(request: Record<string, unknown>) {
          captured = request;
          return { message: makeMessage("c-grp") };
        },
      } as any);

      await resource.sendText("any;+;G-1234", "hi");
      expect(captured?.chatGuid).toBe("any;+;G-1234");
    });
  });

  describe("MessagePart → wire (exhaustive)", () => {
    it("text-only part", async () => {
      let captured: Record<string, unknown> | undefined;
      const resource = new MessagesResource({
        async sendMultipartMessage(request: Record<string, unknown>) {
          captured = request;
          return { message: makeMessage("p-text") };
        },
      } as any);

      await resource.sendMultipart(chatGuidValue, [{ text: "hello" }]);
      expect((captured?.parts as any[])[0]).toEqual({
        attachment: undefined,
        bubbleIndex: undefined,
        formatting: [],
        mentionedAddress: undefined,
        text: "hello",
      });
    });

    it("attachment-only part forwards attachmentGuid + name", async () => {
      let captured: Record<string, unknown> | undefined;
      const resource = new MessagesResource({
        async sendMultipartMessage(request: Record<string, unknown>) {
          captured = request;
          return { message: makeMessage("p-att") };
        },
      } as any);

      await resource.sendMultipart(chatGuidValue, [
        { attachmentGuid: "att-z", attachmentName: "z.png" },
      ]);
      expect((captured?.parts as any[])[0]).toEqual({
        attachment: { attachmentGuid: "att-z", attachmentName: "z.png" },
        bubbleIndex: undefined,
        formatting: [],
        mentionedAddress: undefined,
        text: undefined,
      });
    });

    it("mention-only part forwards mentionedAddress", async () => {
      let captured: Record<string, unknown> | undefined;
      const resource = new MessagesResource({
        async sendMultipartMessage(request: Record<string, unknown>) {
          captured = request;
          return { message: makeMessage("p-mention") };
        },
      } as any);

      await resource.sendMultipart(chatGuidValue, [
        { text: "@alice", mentionedAddress: "alice@example.com" },
      ]);
      expect((captured?.parts as any[])[0]).toMatchObject({
        text: "@alice",
        mentionedAddress: "alice@example.com",
      });
    });

    it("bubbleIndex is forwarded", async () => {
      let captured: Record<string, unknown> | undefined;
      const resource = new MessagesResource({
        async sendMultipartMessage(request: Record<string, unknown>) {
          captured = request;
          return { message: makeMessage("p-bubble") };
        },
      } as any);

      await resource.sendMultipart(chatGuidValue, [
        { text: "x", bubbleIndex: 3 },
      ]);
      expect((captured?.parts as any[])[0]?.bubbleIndex).toBe(3);
    });

    it("part-level formatting is forwarded through the same mapper", async () => {
      let captured: Record<string, unknown> | undefined;
      const resource = new MessagesResource({
        async sendMultipartMessage(request: Record<string, unknown>) {
          captured = request;
          return { message: makeMessage("p-fmt") };
        },
      } as any);

      await resource.sendMultipart(chatGuidValue, [
        {
          text: "hello",
          formatting: [
            { type: "effect", start: 0, length: 5, effect: TextEffect.bloom },
          ],
        },
      ]);
      expect((captured?.parts as any[])[0]?.formatting).toEqual([
        {
          type: "effect",
          effectName: TextEffect.bloom,
          start: 0,
          length: 5,
        },
      ]);
    });
  });

  describe("byte-backed multipart attachments", () => {
    it("uploads byte-backed parts and sends the uploaded attachment guid", async () => {
      let captured: Record<string, unknown> | undefined;
      const uploadedInputs: Array<{ fileName: string; data: Uint8Array }> = [];
      const resource = new MessagesResource(
        {
          async sendMultipartMessage(request: Record<string, unknown>) {
            captured = request;
            return { message: makeMessage("p-buffer") };
          },
        } as any,
        {
          uploadAttachment: async (input) => {
            uploadedInputs.push({ fileName: input.fileName, data: input.data });
            return makeUploadResult("uploaded-att-1", input.fileName);
          },
        }
      );

      const bytes = new Uint8Array([1, 2, 3]);
      await resource.sendMultipart(chatGuidValue, [
        { text: "before" },
        {
          attachment: {
            data: bytes,
            fileName: "photo.png",
          },
        },
        { text: "after" },
      ]);

      expect(uploadedInputs).toEqual([{ fileName: "photo.png", data: bytes }]);

      const parts = captured?.parts as Record<string, unknown>[];
      expect(parts).toHaveLength(3);
      expect(parts[0]?.text).toBe("before");
      expect(parts[1]?.attachment).toEqual({
        attachmentGuid: "uploaded-att-1",
        attachmentName: "photo.png",
      });
      expect(parts[1]?.attachment).not.toHaveProperty("data");
      expect(parts[2]?.text).toBe("after");
    });

    it("preserves bubbleIndex on uploaded multipart attachment parts", async () => {
      let captured: Record<string, unknown> | undefined;
      const resource = new MessagesResource(
        {
          async sendMultipartMessage(request: Record<string, unknown>) {
            captured = request;
            return { message: makeMessage("p-buffer-bubble") };
          },
        } as any,
        {
          uploadAttachment: async (input) =>
            makeUploadResult("uploaded-att-bubble", input.fileName),
        }
      );

      await resource.sendMultipart(chatGuidValue, [
        {
          attachment: {
            data: new Uint8Array([5, 6, 7]),
            fileName: "bubble.png",
          },
          bubbleIndex: 4,
        },
      ]);

      expect((captured?.parts as Record<string, unknown>[])[0]).toMatchObject({
        bubbleIndex: 4,
        attachment: {
          attachmentGuid: "uploaded-att-bubble",
          attachmentName: "bubble.png",
        },
      });
    });

    it("does not send multipart request when byte-backed attachment upload fails", async () => {
      let sendCalls = 0;
      const resource = new MessagesResource(
        {
          async sendMultipartMessage() {
            sendCalls += 1;
            return { message: makeMessage("p-should-not-send") };
          },
        } as any,
        {
          uploadAttachment: async () => {
            throw new Error("upload failed");
          },
        }
      );

      await expect(
        resource.sendMultipart(chatGuidValue, [
          {
            attachment: {
              data: new Uint8Array([9, 9, 9]),
              fileName: "failed.png",
            },
          },
        ])
      ).rejects.toThrow("upload failed");
      expect(sendCalls).toBe(0);
    });
  });

  describe("StickerPlacement → wire (exhaustive)", () => {
    it("forwards minimal placement (x, y only)", async () => {
      let captured: Record<string, unknown> | undefined;
      const resource = new MessagesResource({
        async placeSticker(request: Record<string, unknown>) {
          captured = request;
          return { message: makeMessage("s-min") };
        },
      } as any);

      await resource.placeSticker(
        chatGuidValue,
        messageGuidValue,
        attachmentGuidValue,
        { x: 1, y: 2 }
      );

      expect(captured?.placement).toEqual({
        x: 1,
        y: 2,
        scale: undefined,
        rotation: undefined,
        width: undefined,
      });
    });

    it("forwards every optional placement field", async () => {
      let captured: Record<string, unknown> | undefined;
      const resource = new MessagesResource({
        async placeSticker(request: Record<string, unknown>) {
          captured = request;
          return { message: makeMessage("s-full") };
        },
      } as any);

      await resource.placeSticker(
        chatGuidValue,
        messageGuidValue,
        attachmentGuidValue,
        { x: 10, y: 20, scale: 1.5, rotation: 45, width: 80 }
      );

      expect(captured?.placement).toEqual({
        x: 10,
        y: 20,
        scale: 1.5,
        rotation: 45,
        width: 80,
      });
    });
  });

  describe("MessageListFilter → wire (exhaustive)", () => {
    const beforeDate = new Date("2026-01-01T00:00:00.000Z");
    const afterDate = new Date("2025-01-01T00:00:00.000Z");

    it("listRecent forwards every filter knob", async () => {
      let captured: Record<string, unknown> | undefined;
      const resource = new MessagesResource({
        async listRecentMessages(request: Record<string, unknown>) {
          captured = request;
          return { messages: [], nextPageToken: "" };
        },
      } as any);

      await resource.listRecent({
        pageSize: 25,
        pageToken: "tok-abc",
        isFromMe: true,
        isRead: false,
        before: beforeDate,
        after: afterDate,
      });

      expect(captured).toEqual({
        pageSize: 25,
        pageToken: "tok-abc",
        isFromMe: true,
        isRead: false,
        before: beforeDate,
        after: afterDate,
      });
    });

    it("listRecent omits all knobs when no filter passed", async () => {
      let captured: Record<string, unknown> | undefined;
      const resource = new MessagesResource({
        async listRecentMessages(request: Record<string, unknown>) {
          captured = request;
          return { messages: [], nextPageToken: "" };
        },
      } as any);

      await resource.listRecent();
      expect(captured).toEqual({
        pageSize: undefined,
        pageToken: undefined,
        isFromMe: undefined,
        isRead: undefined,
        before: undefined,
        after: undefined,
      });
    });

    it("listInChat forwards chatGuid + every filter knob", async () => {
      let captured: Record<string, unknown> | undefined;
      const resource = new MessagesResource({
        async listChatMessages(request: Record<string, unknown>) {
          captured = request;
          return { messages: [], nextPageToken: "" };
        },
      } as any);

      await resource.listInChat("any;-;alice@example.com", {
        pageSize: 5,
        pageToken: "tok-xyz",
        isFromMe: false,
        isRead: true,
        before: beforeDate,
        after: afterDate,
      });

      expect(captured).toEqual({
        chatGuid: "any;-;alice@example.com",
        pageSize: 5,
        pageToken: "tok-xyz",
        isFromMe: false,
        isRead: true,
        before: beforeDate,
        after: afterDate,
      });
    });
  });

  describe("targetPartIndex propagation across mutating RPCs", () => {
    const cases: [
      string,
      keyof MessagesResource,
      string,
      (resource: MessagesResource) => Promise<unknown>,
    ][] = [
      [
        "edit",
        "edit",
        "editMessage",
        (r) => r.edit(chatGuidValue, messageGuidValue, "new", { partIndex: 1 }),
      ],
      [
        "unsend",
        "unsend",
        "unsendMessage",
        (r) => r.unsend(chatGuidValue, messageGuidValue, { partIndex: 2 }),
      ],
      [
        "setReaction",
        "setReaction",
        "setReaction",
        (r) =>
          r.setReaction(
            chatGuidValue,
            messageGuidValue,
            { kind: "love" },
            true,
            { partIndex: 3 }
          ),
      ],
      [
        "placeSticker",
        "placeSticker",
        "placeSticker",
        (r) =>
          r.placeSticker(
            chatGuidValue,
            messageGuidValue,
            attachmentGuidValue,
            { x: 0, y: 0 },
            { partIndex: 4 }
          ),
      ],
    ];

    for (const [label, _, rpcMethod, invoke] of cases) {
      it(`${label} forwards options.partIndex to wire target.targetPartIndex`, async () => {
        let captured: Record<string, unknown> | undefined;
        const resource = new MessagesResource({
          [rpcMethod]: async (request: Record<string, unknown>) => {
            captured = request;
            return { message: makeMessage(`tp-${label}`) };
          },
        } as any);

        await invoke(resource);
        expect(
          (captured?.target as Record<string, unknown>)?.targetPartIndex
        ).toBeDefined();
      });
    }
  });

  it("notifySilenced uses top-level chat/message identifiers", async () => {
    let captured: Record<string, unknown> | undefined;
    const resource = new MessagesResource({
      async notifySilencedMessage(request: Record<string, unknown>) {
        captured = request;
        return {};
      },
    } as any);

    await resource.notifySilenced(chatGuidValue, messageGuidValue, {
      clientMessageId: "notify-1",
    });

    expect(captured).toEqual({
      chatGuid: chatGuidValue,
      messageGuid: messageGuidValue,
      clientMessageId: "notify-1",
    });
  });
});
