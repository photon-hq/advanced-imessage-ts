import type { RetryOptions } from "./types/common.js";
import type { MessagesResource } from "./resources/messages.js";
import type { ChatsResource } from "./resources/chats.js";
import type { GroupsResource } from "./resources/groups.js";
import type { AttachmentsResource } from "./resources/attachments.js";
import type { AddressesResource } from "./resources/addresses.js";
import type { PollsResource } from "./resources/polls.js";
import type { ScheduledMessagesResource } from "./resources/scheduled-messages.js";
import type { LocationsResource } from "./resources/locations.js";
import { createGrpcClients } from "./transport/grpc-client.js";
import {
  MessagesResource as MessagesImpl,
} from "./resources/messages.js";
import { ChatsResource as ChatsImpl } from "./resources/chats.js";
import { GroupsResource as GroupsImpl } from "./resources/groups.js";
import {
  AttachmentsResource as AttachmentsImpl,
} from "./resources/attachments.js";
import { AddressesResource as AddressesImpl } from "./resources/addresses.js";
import { PollsResource as PollsImpl } from "./resources/polls.js";
import {
  ScheduledMessagesResource as ScheduledMessagesImpl,
} from "./resources/scheduled-messages.js";
import { LocationsResource as LocationsImpl } from "./resources/locations.js";

export interface ClientOptions {
  readonly address: string;
  readonly token: string | (() => Promise<string>);
  readonly tls?: boolean;
  readonly timeout?: number;
  readonly retry?: boolean | RetryOptions;
  readonly autoIdempotency?: boolean;
}

export interface AdvancedIMessage extends AsyncDisposable {
  readonly messages: MessagesResource;
  readonly chats: ChatsResource;
  readonly groups: GroupsResource;
  readonly attachments: AttachmentsResource;
  readonly addresses: AddressesResource;
  readonly polls: PollsResource;
  readonly scheduledMessages: ScheduledMessagesResource;
  readonly locations: LocationsResource;
  close(): Promise<void>;
}

export function createClient(options: ClientOptions): AdvancedIMessage {
  const clients = createGrpcClients({
    address: options.address,
    tls: options.tls,
    token: options.token,
  });

  const messages = new MessagesImpl(clients.messages);
  const chats = new ChatsImpl(clients.chats);
  const groups = new GroupsImpl(clients.groups);
  const attachments = new AttachmentsImpl(clients.attachments);
  const addresses = new AddressesImpl(clients.addresses);
  const polls = new PollsImpl(clients.polls);
  const scheduledMessages = new ScheduledMessagesImpl(clients.scheduledMessages);
  const locations = new LocationsImpl(clients.locations);

  async function close(): Promise<void> {
    clients.channel.close();
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
