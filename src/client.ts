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
import type { ScheduledMessagesResource } from "./resources/scheduled-messages.js";
import { ScheduledMessagesResource as ScheduledMessagesImpl } from "./resources/scheduled-messages.js";
import { createGrpcClients } from "./transport/grpc-client.js";
import type { RetryOptions } from "./types/common.js";

export interface ClientOptions {
  readonly address: string;
  readonly autoIdempotency?: boolean;
  readonly retry?: boolean | RetryOptions;
  readonly timeout?: number;
  readonly tls?: boolean;
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
  readonly scheduledMessages: ScheduledMessagesResource;
}

export function createClient(options: ClientOptions): AdvancedIMessage {
  const clients = createGrpcClients({
    address: options.address,
    autoIdempotency: options.autoIdempotency,
    tls: options.tls,
    token: options.token,
  });

  const messages = new MessagesImpl(clients.messages);
  const chats = new ChatsImpl(clients.chats);
  const groups = new GroupsImpl(clients.groups);
  const attachments = new AttachmentsImpl(clients.attachments);
  const addresses = new AddressesImpl(clients.addresses);
  const polls = new PollsImpl(clients.polls);
  const scheduledMessages = new ScheduledMessagesImpl(
    clients.scheduledMessages
  );
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
    scheduledMessages,
    locations,
    close,
    async [Symbol.asyncDispose](): Promise<void> {
      await close();
    },
  };
}
