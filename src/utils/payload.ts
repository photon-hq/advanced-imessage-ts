/**
 * Decoders for Apple iMessage binary payloads and vCard contacts.
 */

import { inflateSync } from "node:zlib";

import type {
  VCardAddress,
  VCardContact,
  VCardEmail,
  VCardPhone,
  VCardPhoto,
} from "../types/messages.js";

// ---------------------------------------------------------------------------
// Payload decompression + balloon decoders
// ---------------------------------------------------------------------------

export function decompressPayload(data: Uint8Array): Uint8Array | null {
  try {
    return inflateSync(data);
  } catch {
    return null;
  }
}

interface RichLinkPayload {
  imageUrl?: string;
  summary?: string;
  title?: string;
  url?: string;
}

export function extractRichLink(data: Uint8Array): RichLinkPayload {
  const text = safeDecodeUtf8(data);
  return {
    url: extractFirstUrl(text),
    title:
      extractPlistString(text, "LPLinkMetadataTitleKey") ??
      extractPlistString(text, "title"),
    summary:
      extractPlistString(text, "LPLinkMetadataSummaryKey") ??
      extractPlistString(text, "summary"),
    imageUrl:
      extractPlistString(text, "LPLinkMetadataImageURLKey") ??
      extractSecondaryUrl(text),
  };
}

interface LocationSharePayload {
  address?: string;
  kind: "pin" | "live" | "mapsLink" | "unknown";
  latitude?: number;
  longitude?: number;
  mapsUrl?: string;
}

export function extractLocationShare(data: Uint8Array): LocationSharePayload {
  const text = safeDecodeUtf8(data);
  const mapsUrl = extractMapsUrl(text);
  const coords = extractCoordinates(text);

  let kind: LocationSharePayload["kind"] = "unknown";
  if (text.includes("live")) {
    kind = "live";
  } else if (coords) {
    kind = "pin";
  } else if (mapsUrl) {
    kind = "mapsLink";
  }

  return {
    kind,
    latitude: coords?.latitude,
    longitude: coords?.longitude,
    address:
      extractPlistString(text, "address") ??
      extractPlistString(text, "formattedAddress"),
    mapsUrl,
  };
}

interface CheckinPayload {
  destinationName?: string;
  estimatedEndTime?: Date;
  mode: "timer" | "travel" | "unknown";
  sessionId?: string;
  status: "started" | "stopped" | "expired" | "checkedIn" | "unknown";
}

export function extractCheckin(data: Uint8Array): CheckinPayload {
  const text = safeDecodeUtf8(data);

  let mode: CheckinPayload["mode"] = "unknown";
  if (text.includes("timer") || text.includes("Timer")) {
    mode = "timer";
  } else if (
    text.includes("travel") ||
    text.includes("Travel") ||
    text.includes("destination")
  ) {
    mode = "travel";
  }

  let status: CheckinPayload["status"] = "unknown";
  if (text.includes("started") || text.includes("Started")) {
    status = "started";
  } else if (text.includes("stopped") || text.includes("Stopped")) {
    status = "stopped";
  } else if (text.includes("expired") || text.includes("Expired")) {
    status = "expired";
  } else if (
    text.includes("checkedIn") ||
    text.includes("CheckedIn") ||
    text.includes("checked in")
  ) {
    status = "checkedIn";
  }

  return {
    mode,
    status,
    sessionId:
      extractPlistString(text, "sessionID") ??
      extractPlistString(text, "sessionId"),
    estimatedEndTime: extractTimestamp(text, "estimatedEndTime"),
    destinationName:
      extractPlistString(text, "destinationName") ??
      extractPlistString(text, "destination"),
  };
}

interface CollaborationPayload {
  appName?: string;
  url?: string;
}

export function extractCollaboration(data: Uint8Array): CollaborationPayload {
  const text = safeDecodeUtf8(data);
  return {
    appName:
      extractPlistString(text, "appName") ??
      extractPlistString(text, "applicationName") ??
      extractPlistString(text, "senderDisplayName"),
    url: extractFirstUrl(text),
  };
}

/** Edit history is binary; decompress and search for readable text. */
export function extractOriginalText(
  summaryInfo: Uint8Array
): string | undefined {
  const decompressed = decompressPayload(summaryInfo);
  const bytes = decompressed ?? summaryInfo;
  const text = safeDecodeUtf8(bytes);

  const readable = text.replace(NON_PRINTABLE_RE, " ").trim();
  const segments = readable.split(MULTI_SPACE_RE).filter((s) => s.length > 1);

  return segments.length > 0 ? segments[0] : undefined;
}

// ---------------------------------------------------------------------------
// Plist internal helpers
// ---------------------------------------------------------------------------

const NON_PRINTABLE_RE = /[^\x20-\x7E\n\r\t]/g;
const MULTI_SPACE_RE = /\s{2,}/;
const MAPS_URL_RE = /https?:\/\/maps\.apple\.com[^\s"'<>)\]},;]*/;
const PLIST_VALUE_RE = /^\s*(.{2,200}?)(?:\s{2,}|$)/;
const NON_PRINTABLE_CLEAN_RE = /[^\x20-\x7E]/g;
const EPOCH_RE = /(\d{10,13})/;

function safeDecodeUtf8(data: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(data);
  } catch {
    return "";
  }
}

const URL_RE = /https?:\/\/[^\s"'<>)\]},;]+/g;

function extractFirstUrl(text: string): string | undefined {
  const match = URL_RE.exec(text);
  URL_RE.lastIndex = 0;
  return match?.[0];
}

function extractSecondaryUrl(text: string): string | undefined {
  const matches = text.match(URL_RE);
  return matches && matches.length > 1 ? matches[1] : undefined;
}

function extractMapsUrl(text: string): string | undefined {
  const match = text.match(MAPS_URL_RE);
  return match?.[0] ?? extractFirstUrl(text);
}

/** NSKeyedArchiver lays out keys and values in proximity. */
function extractPlistString(text: string, key: string): string | undefined {
  const keyIdx = text.indexOf(key);
  if (keyIdx === -1) {
    return undefined;
  }

  const after = text.slice(keyIdx + key.length, keyIdx + key.length + 500);
  const cleaned = after.replace(NON_PRINTABLE_CLEAN_RE, " ").trim();

  const match = cleaned.match(PLIST_VALUE_RE);
  return match?.[1]?.trim() || undefined;
}

const COORD_RE = /[-+]?\d{1,3}\.\d{4,}/g;

function extractCoordinates(
  text: string
): { latitude: number; longitude: number } | undefined {
  const matches = text.match(COORD_RE);
  if (!matches || matches.length < 2) {
    return undefined;
  }

  const lat = Number.parseFloat(matches[0] ?? "");
  const lng = Number.parseFloat(matches[1] ?? "");
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return undefined;
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return undefined;
  }

  return { latitude: lat, longitude: lng };
}

function extractTimestamp(text: string, key: string): Date | undefined {
  const keyIdx = text.indexOf(key);
  if (keyIdx === -1) {
    return undefined;
  }

  const after = text.slice(keyIdx + key.length, keyIdx + key.length + 100);
  const epochMatch = after.match(EPOCH_RE);
  if (!epochMatch) {
    return undefined;
  }

  const epoch = Number.parseInt(epochMatch[1] ?? "", 10);
  if (Number.isNaN(epoch)) {
    return undefined;
  }

  const ms = epoch > 1e12 ? epoch : epoch * 1000;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// ---------------------------------------------------------------------------
// vCard parser
// ---------------------------------------------------------------------------

const VCARD_FOLD_RE = /\r?\n[ \t]/g;
const VCARD_NEWLINE_RE = /\r?\n/;
const TEL_CLEAN_RE = /[^\d+\-() ]/g;
const LABEL_PREFIX_RE = /^x-/i;

interface VCardState {
  addresses: VCardAddress[];
  emails: VCardEmail[];
  firstName: string | undefined;
  fullName: string | undefined;
  lastName: string | undefined;
  note: string | undefined;
  org: string | undefined;
  phones: VCardPhone[];
  photo: VCardPhoto | undefined;
  title: string | undefined;
  urls: string[];
}

export function parseVCard(data: string | Uint8Array): VCardContact {
  const text = typeof data === "string" ? data : new TextDecoder().decode(data);
  const unfolded = text.replace(VCARD_FOLD_RE, "");
  const lines = unfolded.split(VCARD_NEWLINE_RE);

  const state: VCardState = {
    addresses: [],
    emails: [],
    firstName: undefined,
    fullName: undefined,
    lastName: undefined,
    note: undefined,
    org: undefined,
    phones: [],
    photo: undefined,
    title: undefined,
    urls: [],
  };

  for (const line of lines) {
    processVCardLine(line, state);
  }

  return {
    addresses: state.addresses,
    emails: state.emails,
    firstName: state.firstName,
    fullName: state.fullName,
    lastName: state.lastName,
    note: state.note,
    org: state.org,
    phones: state.phones,
    photo: state.photo,
    title: state.title,
    urls: state.urls,
  };
}

function processVCardLine(line: string, state: VCardState): void {
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) {
    return;
  }

  const keyPart = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1).trim();
  if (!value) {
    return;
  }

  const { name, params } = parseVCardProperty(keyPart);

  switch (name.toUpperCase()) {
    case "FN":
      state.fullName = decodeVCardValue(value, params);
      break;
    case "N": {
      const parts = value.split(";");
      state.lastName = parts[0]
        ? decodeVCardValue(parts[0], params)
        : undefined;
      state.firstName = parts[1]
        ? decodeVCardValue(parts[1], params)
        : undefined;
      break;
    }
    case "ORG":
      state.org = decodeVCardValue(value.split(";")[0] ?? "", params);
      break;
    case "TITLE":
      state.title = decodeVCardValue(value, params);
      break;
    case "TEL":
      state.phones.push({
        label: extractVCardLabel(params),
        value: value.replace(TEL_CLEAN_RE, ""),
      });
      break;
    case "EMAIL":
      state.emails.push({ label: extractVCardLabel(params), value });
      break;
    case "ADR": {
      const parts = value.split(";");
      state.addresses.push({
        city: parts[3] || undefined,
        country: parts[6] || undefined,
        label: extractVCardLabel(params),
        postalCode: parts[5] || undefined,
        state: parts[4] || undefined,
        street: parts[2] || undefined,
      });
      break;
    }
    case "PHOTO": {
      const mimeType = extractPhotoMime(params);
      if (mimeType) {
        state.photo = { data: value, mimeType };
      }
      break;
    }
    case "NOTE":
      state.note = decodeVCardValue(value, params);
      break;
    case "URL":
      state.urls.push(value);
      break;
    default:
      break;
  }
}

interface VCardPropertyParts {
  name: string;
  params: Map<string, string>;
}

function parseVCardProperty(keyPart: string): VCardPropertyParts {
  const segments = keyPart.split(";");
  const name = segments[0] ?? "";
  const params = new Map<string, string>();
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i] ?? "";
    const eqIdx = seg.indexOf("=");
    if (eqIdx === -1) {
      params.set(seg.toUpperCase(), "");
    } else {
      params.set(seg.slice(0, eqIdx).toUpperCase(), seg.slice(eqIdx + 1));
    }
  }
  return { name, params };
}

function extractVCardLabel(params: Map<string, string>): string | undefined {
  const typeVal = params.get("TYPE");
  if (!typeVal) {
    return undefined;
  }
  const label = typeVal.split(",")[0];
  return label ? label.replace(LABEL_PREFIX_RE, "").toLowerCase() : undefined;
}

function extractPhotoMime(params: Map<string, string>): string | undefined {
  const mediatype = params.get("MEDIATYPE");
  if (mediatype) {
    return mediatype;
  }
  const type = params.get("TYPE");
  if (type) {
    const lower = type.toLowerCase();
    if (lower === "jpeg" || lower === "jpg") {
      return "image/jpeg";
    }
    if (lower === "png") {
      return "image/png";
    }
    if (lower === "gif") {
      return "image/gif";
    }
    if (lower.startsWith("image/")) {
      return lower;
    }
  }
  const encoding = params.get("ENCODING");
  if (encoding?.toUpperCase() === "B" || encoding?.toUpperCase() === "BASE64") {
    return "image/jpeg";
  }
  return undefined;
}

function decodeVCardValue(value: string, params: Map<string, string>): string {
  const charset = params.get("CHARSET")?.toUpperCase();
  if (charset === "UTF-8" || !charset) {
    return value
      .replace(/\\n/g, "\n")
      .replace(/\\,/g, ",")
      .replace(/\\\\/g, "\\");
  }
  return value;
}
