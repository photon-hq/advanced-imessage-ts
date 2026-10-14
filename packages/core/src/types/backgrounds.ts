import { ValidationError } from "../errors/imessage-error.ts";
import { BackgroundPreset as ProtoBackgroundPreset } from "../generated/photon/imessage/v1/chat_types.ts";

const PROTO_BACKGROUND_PRESETS = {
  skyDusk: ProtoBackgroundPreset.BACKGROUND_PRESET_SKY_DUSK,
  skyHaze: ProtoBackgroundPreset.BACKGROUND_PRESET_SKY_HAZE,
  skySunset: ProtoBackgroundPreset.BACKGROUND_PRESET_SKY_SUNSET,
  skyClear: ProtoBackgroundPreset.BACKGROUND_PRESET_SKY_CLEAR,
  skySunrise: ProtoBackgroundPreset.BACKGROUND_PRESET_SKY_SUNRISE,
  skyDawn: ProtoBackgroundPreset.BACKGROUND_PRESET_SKY_DAWN,
  waterLight: ProtoBackgroundPreset.BACKGROUND_PRESET_WATER_LIGHT,
  waterDark: ProtoBackgroundPreset.BACKGROUND_PRESET_WATER_DARK,
  auroraGreen: ProtoBackgroundPreset.BACKGROUND_PRESET_AURORA_GREEN,
  auroraPurple: ProtoBackgroundPreset.BACKGROUND_PRESET_AURORA_PURPLE,
  auroraPink: ProtoBackgroundPreset.BACKGROUND_PRESET_AURORA_PINK,
  colorMango: ProtoBackgroundPreset.BACKGROUND_PRESET_COLOR_MANGO,
  colorIce: ProtoBackgroundPreset.BACKGROUND_PRESET_COLOR_ICE,
  colorPlum: ProtoBackgroundPreset.BACKGROUND_PRESET_COLOR_PLUM,
  colorDeepSea: ProtoBackgroundPreset.BACKGROUND_PRESET_COLOR_DEEP_SEA,
  colorGreenApple: ProtoBackgroundPreset.BACKGROUND_PRESET_COLOR_GREEN_APPLE,
  colorCherry: ProtoBackgroundPreset.BACKGROUND_PRESET_COLOR_CHERRY,
  colorBubblegum: ProtoBackgroundPreset.BACKGROUND_PRESET_COLOR_BUBBLEGUM,
  colorTangerine: ProtoBackgroundPreset.BACKGROUND_PRESET_COLOR_TANGERINE,
  colorMagenta: ProtoBackgroundPreset.BACKGROUND_PRESET_COLOR_MAGENTA,
  colorLime: ProtoBackgroundPreset.BACKGROUND_PRESET_COLOR_LIME,
  colorSilver: ProtoBackgroundPreset.BACKGROUND_PRESET_COLOR_SILVER,
  colorCarbon: ProtoBackgroundPreset.BACKGROUND_PRESET_COLOR_CARBON,
  colorStone: ProtoBackgroundPreset.BACKGROUND_PRESET_COLOR_STONE,
} as const;

/**
 * Name of a built-in Messages background, for example `"skyDusk"` or
 * `"colorMango"`. Pass it to `chats.setBackground` instead of image bytes.
 */
export type BackgroundPreset = keyof typeof PROTO_BACKGROUND_PRESETS;

/**
 * Convert a preset name to its wire value.
 *
 * @throws {ValidationError} If `preset` is not a known preset name.
 */
export function toProtoBackgroundPreset(
  preset: BackgroundPreset
): ProtoBackgroundPreset {
  if (!Object.hasOwn(PROTO_BACKGROUND_PRESETS, preset)) {
    throw new ValidationError(`Unknown background preset: ${preset}`, {
      code: "invalidArgument",
      context: { field: "preset", value: preset },
      grpcCode: 3,
      retryable: false,
    });
  }
  return PROTO_BACKGROUND_PRESETS[preset];
}
