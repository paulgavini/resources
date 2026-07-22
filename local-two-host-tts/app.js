import { makeWavBlob, rawAudioToAudioData } from "./audioUtils.js";
import {
  DEFAULT_SPEAKER_A_VOICE,
  DEFAULT_SPEAKER_B_VOICE,
  FALLBACK_ENGLISH_VOICES,
  generateSpeech,
  getAvailableVoices,
  isVoiceAvailable,
  resolveDefaultVoices,
} from "./kokoroClient.js";
import { parseTranscript } from "./parseTranscript.js";

const SAMPLE_TRANSCRIPT = `Host 1: Today we are looking at chemical reactions.
Host 2: So, what actually makes a reaction happen?
Host 1: Particles need to collide with enough energy.
Host 2: So just touching is not always enough?
Host 1: Correct. The particles need the right orientation and enough energy to break existing bonds.`;

const SPEAKER_A_SAMPLE = "Hello, I am Host 1. I will usually explain the main science ideas.";
const SPEAKER_B_SAMPLE = "Hello, I am Host 2. I will ask questions and add examples.";
const OUTPUT_FILE_NAME = "two-host-tts-output.wav";

const elements = {
  transcriptInput: document.querySelector("#transcriptInput"),
  fileInput: document.querySelector("#fileInput"),
  loadSampleButton: document.querySelector("#loadSampleButton"),
  clearButton: document.querySelector("#clearButton"),
  parseButton: document.querySelector("#parseButton"),
  previewBody: document.querySelector("#previewBody"),
  previewSummary: document.querySelector("#previewSummary"),
  speakerAVoice: document.querySelector("#speakerAVoice"),
  speakerBVoice: document.querySelector("#speakerBVoice"),
  selectedVoices: document.querySelector("#selectedVoices"),
  voiceWarnings: document.querySelector("#voiceWarnings"),
  testSpeakerAButton: document.querySelector("#testSpeakerAButton"),
  testSpeakerBButton: document.querySelector("#testSpeakerBButton"),
  speechSpeedInput: document.querySelector("#speechSpeedInput"),
  silenceGapInput: document.querySelector("#silenceGapInput"),
  pauseGapInput: document.querySelector("#pauseGapInput"),
  generateButton: document.querySelector("#generateButton"),
  stopButton: document.querySelector("#stopButton"),
  status: document.querySelector("#status"),
  errorMessage: document.querySelector("#errorMessage"),
  finalAudio: document.querySelector("#finalAudio"),
  downloadLink: document.querySelector("#downloadLink"),
};

let availableVoices = [...FALLBACK_ENGLISH_VOICES];
let currentAudioUrl = "";
let cancelGenerationRequested = false;

initialiseApp();

async function initialiseApp() {
  populateVoiceSelects(availableVoices);
  setVoiceSelections(DEFAULT_SPEAKER_A_VOICE, DEFAULT_SPEAKER_B_VOICE);
  updateSelectedVoices();
  bindEvents();
  renderPreview();

  setStatus("Loading voice list");
  availableVoices = await getAvailableVoices();
  populateVoiceSelects(availableVoices);
  const defaults = resolveDefaultVoices(availableVoices);
  setVoiceSelections(defaults.speakerA, defaults.speakerB);
  renderVoiceWarnings(defaults.warnings);
  updateSelectedVoices();
  setStatus("Ready");
}

function bindEvents() {
  elements.loadSampleButton.addEventListener("click", () => {
    elements.transcriptInput.value = SAMPLE_TRANSCRIPT;
    clearOutput();
    renderPreview();
  });

  elements.clearButton.addEventListener("click", () => {
    elements.transcriptInput.value = "";
    elements.fileInput.value = "";
    clearOutput();
    renderPreview();
    setStatus("Ready to load a transcript.");
  });

  elements.fileInput.addEventListener("change", handleFileUpload);
  elements.transcriptInput.addEventListener("input", renderPreview);
  elements.parseButton.addEventListener("click", renderPreview);
  elements.speakerAVoice.addEventListener("change", handleVoiceChange);
  elements.speakerBVoice.addEventListener("change", handleVoiceChange);
  elements.testSpeakerAButton.addEventListener("click", () => testVoice("Speaker A", SPEAKER_A_SAMPLE, elements.speakerAVoice.value));
  elements.testSpeakerBButton.addEventListener("click", () => testVoice("Speaker B", SPEAKER_B_SAMPLE, elements.speakerBVoice.value));
  elements.generateButton.addEventListener("click", generateConversationAudio);
  elements.stopButton.addEventListener("click", requestStopGeneration);
}

function populateVoiceSelects(voices) {
  populateSelect(elements.speakerAVoice, voices);
  populateSelect(elements.speakerBVoice, voices);
}

function populateSelect(select, voices) {
  const previousValue = select.value;
  select.innerHTML = "";

  for (const voice of voices) {
    const option = document.createElement("option");
    option.value = voice;
    option.textContent = voice;
    select.append(option);
  }

  if (voices.includes(previousValue)) {
    select.value = previousValue;
  }
}

function setVoiceSelections(speakerA, speakerB) {
  if (speakerA) {
    elements.speakerAVoice.value = speakerA;
  }

  if (speakerB) {
    elements.speakerBVoice.value = speakerB;
  }
}

function handleVoiceChange() {
  updateSelectedVoices();
  renderVoiceWarnings(getSelectedVoiceWarnings());
}

function updateSelectedVoices() {
  elements.selectedVoices.textContent = `Selected voices: ${elements.speakerAVoice.value || "none"} and ${elements.speakerBVoice.value || "none"}`;
}

function getSelectedVoiceWarnings() {
  const warnings = [];
  const speakerA = elements.speakerAVoice.value;
  const speakerB = elements.speakerBVoice.value;

  if (speakerA && !isVoiceAvailable(speakerA, availableVoices)) {
    warnings.push(`${speakerA} is not currently available.`);
  }

  if (speakerB && !isVoiceAvailable(speakerB, availableVoices)) {
    warnings.push(`${speakerB} is not currently available.`);
  }

  if (speakerA && speakerB && speakerA === speakerB) {
    warnings.push("Speaker A and Speaker B must use different voices.");
  }

  return warnings;
}

function renderVoiceWarnings(warnings) {
  elements.voiceWarnings.innerHTML = "";
  for (const warning of warnings) {
    const div = document.createElement("div");
    div.textContent = warning;
    elements.voiceWarnings.append(div);
  }
}

async function handleFileUpload(event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  const validExtension = /\.(txt|md)$/i.test(file.name);
  const validMime = ["text/plain", "text/markdown", ""].includes(file.type);

  if (!validExtension || !validMime) {
    showError("Please choose a .txt or .md file.");
    event.target.value = "";
    return;
  }

  try {
    elements.transcriptInput.value = await file.text();
    clearOutput();
    clearError();
    renderPreview();
    setStatus(`Loaded ${file.name}`);
  } catch (error) {
    showError(`The file could not be read. ${error.message}`);
  }
}

function renderPreview() {
  const turns = parseTranscript(elements.transcriptInput.value);
  elements.previewBody.innerHTML = "";

  if (turns.length === 0) {
    elements.previewSummary.textContent = "No turns parsed yet.";
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="4" class="empty-cell">Paste or load a transcript to preview speaker turns.</td>`;
    elements.previewBody.append(row);
    return turns;
  }

  elements.previewSummary.textContent = `${turns.length} speaker turn${turns.length === 1 ? "" : "s"} recognised.`;

  turns.forEach((turn, index) => {
    const row = document.createElement("tr");
    row.append(makeCell(String(index + 1)));
    row.append(makeCell(turn.speaker));
    row.append(makeCell(turn.cleanedText || "[pause only]"));
    row.append(makeCell(String(turn.characterCount)));
    elements.previewBody.append(row);
  });

  return turns;
}

function makeCell(text) {
  const cell = document.createElement("td");
  cell.textContent = text;
  return cell;
}

async function testVoice(label, sampleText, voice) {
  clearError();

  try {
    validateVoiceChoice(voice, label);
    setBusy(true);
    setStatus(`Loading model for ${label} test`);
    const rawAudio = await generateSpeech(sampleText, voice, readSpeechSpeed(), handleModelProgress);
    const audioData = rawAudioToAudioData(rawAudio);
    const { blob } = makeWavBlob([{ ...audioData, hasPauseTag: false }], {
      silenceGapSeconds: 0,
      pauseGapSeconds: 0,
    });
    playBlob(blob);
    setStatus(`${label} voice test ready`);
  } catch (error) {
    showError(error.message);
    setStatus("Ready");
  } finally {
    setBusy(false);
  }
}

async function generateConversationAudio() {
  clearError();
  clearOutput();
  cancelGenerationRequested = false;

  try {
    validateTranscriptInput();
    validateVoicePair();
    setBusy(true);
    setGenerating(true);
    const speechSpeed = readSpeechSpeed();

    setStatus("Parsing transcript");
    await waitForUiUpdate();
    const turns = parseTranscript(elements.transcriptInput.value);

    if (turns.length < 2) {
      throw new Error("Please provide at least two recognised speaker turns.");
    }

    const generatedSegments = [];

    for (let index = 0; index < turns.length; index += 1) {
      if (cancelGenerationRequested) {
        setStatus("Stopped. No audio was exported.");
        return;
      }

      const turn = turns[index];
      const voice = turn.speaker === "Speaker A" ? elements.speakerAVoice.value : elements.speakerBVoice.value;

      if (!turn.cleanedText) {
        generatedSegments.push({
          samples: new Float32Array(0),
          sampleRate: 24000,
          hasPauseTag: turn.hasPauseTag,
        });
        continue;
      }

      setStatus(`Generating turn ${index + 1} of ${turns.length}`);
      await waitForUiUpdate();

      if (cancelGenerationRequested) {
        setStatus("Stopped. No audio was exported.");
        return;
      }

      const rawAudio = await generateSpeech(turn.cleanedText, voice, speechSpeed, handleModelProgress);
      const audioData = rawAudioToAudioData(rawAudio);
      generatedSegments.push({
        ...audioData,
        hasPauseTag: turn.hasPauseTag,
      });
    }

    if (cancelGenerationRequested) {
      setStatus("Stopped. No audio was exported.");
      return;
    }

    setStatus("Combining audio");
    await waitForUiUpdate();
    const { blob, durationSeconds } = makeWavBlob(generatedSegments, {
      silenceGapSeconds: readSecondsInput(elements.silenceGapInput, 0.05),
      pauseGapSeconds: readSecondsInput(elements.pauseGapInput, 0.2),
    });

    setDownload(blob);
    setStatus(`Ready. Final audio is about ${formatDuration(durationSeconds)}.`);
  } catch (error) {
    showError(error.message);
    setStatus("Ready");
  } finally {
    setBusy(false);
    setGenerating(false);
  }
}

function requestStopGeneration() {
  cancelGenerationRequested = true;
  elements.stopButton.disabled = true;
  setStatus("Stopping after the current turn...");
}

function validateTranscriptInput() {
  if (!elements.transcriptInput.value.trim()) {
    throw new Error("Please paste or load a transcript before generating audio.");
  }
}

function validateVoicePair() {
  const speakerA = elements.speakerAVoice.value;
  const speakerB = elements.speakerBVoice.value;

  validateVoiceChoice(speakerA, "Speaker A");
  validateVoiceChoice(speakerB, "Speaker B");

  if (speakerA === speakerB) {
    throw new Error("Please choose two different voices before generating audio.");
  }
}

function validateVoiceChoice(voice, label) {
  if (!voice) {
    throw new Error(`${label} needs a selected voice.`);
  }

  if (!isVoiceAvailable(voice, availableVoices)) {
    throw new Error(`${label} voice ${voice} is not available.`);
  }
}

function readSecondsInput(input, fallback) {
  const value = Number.parseFloat(input.value);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function readSpeechSpeed() {
  const percent = Number.parseFloat(elements.speechSpeedInput.value);
  const safePercent = Number.isFinite(percent) && percent > 0 ? percent : 100;
  return safePercent / 100;
}

function setDownload(blob) {
  currentAudioUrl = URL.createObjectURL(blob);
  elements.finalAudio.src = currentAudioUrl;
  elements.downloadLink.href = currentAudioUrl;
  elements.downloadLink.download = OUTPUT_FILE_NAME;
  elements.downloadLink.classList.remove("disabled");
  elements.downloadLink.setAttribute("aria-disabled", "false");
}

function playBlob(blob) {
  const testUrl = URL.createObjectURL(blob);
  const audio = new Audio(testUrl);
  audio.addEventListener("ended", () => URL.revokeObjectURL(testUrl), { once: true });
  audio.play().catch((error) => {
    URL.revokeObjectURL(testUrl);
    showError(`The browser blocked audio playback. Try pressing the test button again. ${error.message}`);
  });
}

function clearOutput() {
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = "";
  }

  elements.finalAudio.removeAttribute("src");
  elements.finalAudio.load();
  elements.downloadLink.removeAttribute("href");
  elements.downloadLink.classList.add("disabled");
  elements.downloadLink.setAttribute("aria-disabled", "true");
}

function clearError() {
  elements.errorMessage.textContent = "";
}

function showError(message) {
  elements.errorMessage.textContent = message;
}

function setStatus(message) {
  elements.status.textContent = message;
}

function waitForUiUpdate() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

function setBusy(isBusy) {
  elements.generateButton.disabled = isBusy;
  elements.testSpeakerAButton.disabled = isBusy;
  elements.testSpeakerBButton.disabled = isBusy;
  elements.parseButton.disabled = isBusy;
}

function setGenerating(isGenerating) {
  elements.stopButton.disabled = !isGenerating;
}

function handleModelProgress(progress) {
  if (cancelGenerationRequested) {
    return;
  }

  if (progress?.status === "progress" && progress.file) {
    const percent = typeof progress.progress === "number" ? ` ${Math.round(progress.progress)}%` : "";
    setStatus(`Loading model: ${progress.file}${percent}`);
    return;
  }

  if (progress?.status === "ready") {
    setStatus("Loading model");
  }
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) {
    return "unknown";
  }

  if (seconds < 60) {
    return `${Math.round(seconds)} seconds`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes} min ${remainingSeconds} sec`;
}
