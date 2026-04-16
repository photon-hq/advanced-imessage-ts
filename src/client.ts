import type { AddressesResource } from "./resources/addresses.js";
import { AddressesResource as AddressesImpl } from "./resources/addresses.js";
import type { AttachmentsResource } from "./resources/attachments.js";
import { AttachmentsResource as AttachmentsImpl } from "./resources/attachments.js";
import type { ChatsResource } from "./resources/chats.js";
import { ChatsResource as ChatsImpl } from "./resources/chats.js";
import type { GroupsResource } from "./resources/groups.js";
import { GroupsResource as GroupsImpl } from "./resources/groups.js";
import type { LocationsResource } from "./resources/locations.js";
import { LocationsResource as LocationsImpl } from "./resources/locations.js";
import type { MessagesResource } from "./resources/messages.js";
import { MessagesResource as MessagesImpl } from "./resources/messages.js";
import type { PollsResource } from "./resources/polls.js";
import { PollsResource as PollsImpl } from "./resources/polls.js";
import { createGrpcClients } from "./transport/grpc-client.js";
import type { RetryOptions } from "./types/common.js";

/** Options for configuring the Advanced iMessage client. */
export interface ClientOptions {
  /** The server address to connect to (e.g., `"localhost:50051"`). */
  readonly address: string;
  /** When `true`, automatically generates a unique key for each request to prevent duplicate operations. */
  readonly autoIdempotency?: boolean;
  /** When `true`, enables automatic retries. Accepts a {@link RetryOptions} object for fine-grained control. */
  readonly retry?: boolean | RetryOptions;
  /** Request timeout in milliseconds. */
  readonly timeout?: number;
  /** When `true`, uses a TLS-encrypted connection to the server. */
  readonly tls?: boolean;
  /** Authentication token. Pass a function that returns `Promise<string>` to provide the token dynamically. */
  readonly token: string | (() => Promise<string>);
}

export interface AdvancedIMessage extends AsyncDisposable {
  readonly addresses: AddressesResource;
  readonly attachments: AttachmentsResource;
  readonly chats: ChatsResource;
  close(): Promise<void>;
  readonly groups: GroupsResource;
  readonly locations: LocationsResource;
  readonly messages: MessagesResource;
  readonly polls: PollsResource;
}

/**
 * Creates an Advanced iMessage client with access to messages, chats, groups, attachments, polls, and more.
 *
 * Call {@link AdvancedIMessage.close} to release the underlying connection when done.
 *
 * @example
 * ```ts
 * const im = createClient({
 *   address: "localhost:50051",
 *   token: "my-api-token",
 * });
 *
 * // ... use im.messages, im.groups, etc.
 *
 * await im.close();
 * ```
 */
export function createClient(options: ClientOptions): AdvancedIMessage {
  const clients = createGrpcClients({
    address: options.address,
    autoIdempotency: options.autoIdempotency,
    retry: options.retry,
    timeout: options.timeout,
    tls: options.tls,
    token: options.token,
  });

  const messages = new MessagesImpl(clients.messages);
  const chats = new ChatsImpl(clients.chats);
  const groups = new GroupsImpl(clients.groups);
  const attachments = new AttachmentsImpl(clients.attachments);
  const addresses = new AddressesImpl(clients.addresses);
  const polls = new PollsImpl(clients.polls);
  const locations = new LocationsImpl(clients.locations);

  function close(): Promise<void> {
    clients.channel.close();
    return Promise.resolve();
  }

  return {
    messages,
    chats,
    groups,
    attachments,
    addresses,
    polls,
    locations,
    close,
    async [Symbol.asyncDispose](): Promise<void> {
      await close();
    },
  };
}
