import { describe, expect, it } from "bun:test";
import { MessagesResource } from "../../src/resources/messages.ts";
import type {
  AttachmentGuid,
  ChatGuid,
  MessageGuid,
} from "../../src/types/branded.ts";

const chatGuidValue = "iMessage;-;alice@icloud.com" as ChatGuid;
const attachmentGuidValue = "attachment-1" as AttachmentGuid;
const messageGuidValue = "message-1" as MessageGuid;

describe("MessagesResource sticker placement", () => {
  it("includes sticker width when sending a sticker", async () => {
    let capturedRequest: Record<string, unknown> | undefined;
    const resource = new MessagesResource({
      async send(request: Record<string, unknown>) {
        capturedRequest = request;
        return {
          receipt: {
            guid: "sent-1",
          },
        };
      },
    } as any);

    await resource.send(chatGuidValue, "", {
      sticker: {
        attachment: attachmentGuidValue,
        target: messageGuidValue,
        placement: {
          x: 10,
          y: 20,
          width: 80,
        },
      },
    });

    expect(capturedRequest?.stickerPlacement).toEqual({
      x: 10,
      y: 20,
      scale: undefined,
      rotation: undefined,
      width: 80,
    });
  });

  it("forwards attachmentGuid on each multipart part", async () => {
    let capturedRequest: Record<string, unknown> | undefined;
    const resource = new MessagesResource({
      async send(request: Record<string, unknown>) {
        capturedRequest = request;
        return { receipt: { guid: "sent-multi" } };
      },
    } as any);

    await resource.sendMultipart(chatGuidValue, [
      { text: "look at these" },
      { attachmentGuid: "att-a", attachmentName: "a.jpg" },
      { attachmentGuid: "att-b", attachmentName: "b.jpg" },
    ]);

    const parts = (capturedRequest?.parts as Array<Record<string, unknown>>);
    expect(parts).toHaveLength(3);
    expect(parts[0]?.attachmentGuid).toBeUndefined();
    expect(parts[1]?.attachmentGuid).toBe("att-a");
    expect(parts[2]?.attachmentGuid).toBe("att-b");
  });

  it("does not forward a removed send service override", async () => {
    let capturedRequest: Record<string, unknown> | undefined;
    const resource = new MessagesResource({
      async send(request: Record<string, unknown>) {
        capturedRequest = request;
        return {
          receipt: {
            guid: "sent-2",
          },
        };
      },
    } as any);

    await resource.send(chatGuidValue, "hello", {
      // Runtime callers can still pass extra properties even after the public
      // type is removed; verify we do not send the stale wire field.
      ...({ service: "SMS" } as any),
    });

    expect("service" in (capturedRequest ?? {})).toBe(false);
  });
});
