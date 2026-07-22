import { KokoroTTS } from "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js";

export const DEFAULT_SPEAKER_A_VOICE = "af_heart";
export const DEFAULT_SPEAKER_B_VOICE = "am_puck";

export const FALLBACK_ENGLISH_VOICES = [
  "af_heart",
  "af_bella",
  "af_nicole",
  "af_sarah",
  "af_sky",
  "af_alloy",
  "af_aoede",
  "af_jessica",
  "af_kore",
  "af_nova",
  "af_river",
  "am_michael",
  "am_fenrir",
  "am_puck",
  "am_adam",
  "am_echo",
  "am_eric",
  "am_liam",
  "am_onyx",
  "am_santa",
  "bf_emma",
  "bf_isabella",
  "bf_alice",
  "bf_lily",
  "bm_george",
  "bm_fable",
  "bm_lewis",
  "bm_daniel",
];

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
let modelPromise = null;
let loadedModel = null;

export async function loadKokoro(progressCallback) {
  if (loadedModel) {
    return loadedModel;
  }

  if (!modelPromise) {
    modelPromise = KokoroTTS.from_pretrained(MODEL_ID, {
      dtype: "q8",
      device: "wasm",
      progress_callback: progressCallback,
    });
  }

  loadedModel = await modelPromise;
  return loadedModel;
}

export async function getAvailableVoices() {
  try {
    const voiceGetter = Object.getOwnPropertyDescriptor(KokoroTTS.prototype, "voices")?.get;
    const dynamicVoices = voiceGetter ? Object.keys(voiceGetter.call({})) : [];
    return dynamicVoices.length > 0 ? dynamicVoices : FALLBACK_ENGLISH_VOICES;
  } catch (error) {
    console.warn("Could not read Kokoro voices dynamically. Using fallback list.", error);
    return FALLBACK_ENGLISH_VOICES;
  }
}

export function resolveDefaultVoices(availableVoices) {
  const warnings = [];
  let speakerA = DEFAULT_SPEAKER_A_VOICE;
  let speakerB = DEFAULT_SPEAKER_B_VOICE;

  if (!availableVoices.includes(DEFAULT_SPEAKER_A_VOICE)) {
    warnings.push(`${DEFAULT_SPEAKER_A_VOICE} is not available. Speaker A has been set to the first available English voice.`);
    speakerA = availableVoices[0] || "";
  }

  if (!availableVoices.includes(DEFAULT_SPEAKER_B_VOICE)) {
    warnings.push(`${DEFAULT_SPEAKER_B_VOICE} is not available. Speaker B has been set to the next available English voice.`);
    speakerB = availableVoices.find((voice) => voice !== speakerA) || "";
  }

  if (speakerA === speakerB) {
    speakerB = availableVoices.find((voice) => voice !== speakerA) || "";
    warnings.push("The same default voice was selected for both speakers, so Speaker B has been changed.");
  }

  return { speakerA, speakerB, warnings };
}

export function isVoiceAvailable(voice, availableVoices) {
  return availableVoices.includes(voice);
}

export async function generateSpeech(text, voice, speed, progressCallback) {
  const tts = await loadKokoro(progressCallback);
  return tts.generate(text, { voice, speed });
}
