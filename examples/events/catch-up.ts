import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

let since: number | undefined;

for await (const event of im.events.catchUp(since)) {
  if (event.type === "catchup.complete") {
    since = event.headSequence;
    break;
  }

  since = event.sequence;
  console.log("replayed:", event.type, event.sequence);
}

const live = im.messages.subscribeEvents();

setTimeout(() => {
  live.close();
}, 5000);

for await (const event of live) {
  since = event.sequence;
  console.log("live:", event.type, since);
}

if (since !== undefined) {
  for await (const event of im.events.catchUp(since)) {
    if (event.type === "catchup.complete") {
      break;
    }

    since = event.sequence;
    console.log("recovered:", event.type, event.sequence);
  }
}

await im.close();
