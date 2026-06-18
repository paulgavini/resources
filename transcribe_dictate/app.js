const CORE_BASE_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
const FFMPEG_MODULE_URL = "./vendor/ffmpeg/index.js";
const FFMPEG_UTIL_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js";
const TRANSFORMERS_MODULE_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1";
const MAX_DISPLAY_BYTES = 1024 * 1024 * 1024;
const AUDIO_EXTENSIONS = new Set(["aac", "flac", "m4a", "mp3", "mp4", "ogg", "wav", "webm", "wma"]);
const MODEL_OPTIONS = [
  {
    group: "Whisper English",
    label: "Whisper tiny English",
    id: "Xenova/whisper-tiny.en",
    note: "Fastest English option with lower accuracy.",
    family: "whisper",
    language: "english",
  },
  {
    group: "Whisper English",
    label: "Whisper base English",
    id: "Xenova/whisper-base.en",
    note: "Balanced English transcription model.",
    family: "whisper",
    language: "english",
  },
  {
    group: "Whisper English",
    label: "Whisper small English",
    id: "Xenova/whisper-small.en",
    note: "Better English accuracy, slower and larger.",
    family: "whisper",
    language: "english",
  },
  {
    group: "Whisper English",
    label: "Whisper medium English",
    id: "Xenova/whisper-medium.en",
    note: "High English accuracy, large download and slower browser runtime.",
    family: "whisper",
    language: "english",
  },
  {
    group: "Moonshine English",
    label: "Moonshine tiny",
    id: "onnx-community/moonshine-tiny-ONNX",
    note: "Fast browser-oriented English ASR model; smaller than Whisper.",
    family: "moonshine",
    language: "english",
  },
  {
    group: "Moonshine English",
    label: "Moonshine base",
    id: "onnx-community/moonshine-base-ONNX",
    note: "Larger Moonshine option with better accuracy than tiny.",
    family: "moonshine",
    language: "english",
  },
];
const DEFAULT_MODEL_ID = "Xenova/whisper-base.en";

const fileInput = document.querySelector("#file-input");
const dropZone = document.querySelector("#drop-zone");
const modelSelect = document.querySelector("#model-select");
const modelName = document.querySelector("#model-name");
const modelId = document.querySelector("#model-id");
const modelNote = document.querySelector("#model-note");
const transcribeButton = document.querySelector("#transcribe-button");
const clearButton = document.querySelector("#clear-button");
const cancelButton = document.querySelector("#cancel-button");
const copyButton = document.querySelector("#copy-button");
const downloadTextButton = document.querySelector("#download-text-button");
const queueList = document.querySelector("#queue-list");
const queueSummary = document.querySelector("#queue-summary");
const statusLine = document.querySelector("#status-line");
const transcriptOutput = document.querySelector("#transcript-output");
const transcriptSummary = document.querySelector("#transcript-summary");
const ffmpegIndicator = document.querySelector("#ffmpeg-indicator");
const ffmpegIndicatorText = document.querySelector("#ffmpeg-indicator-text");
const modelIndicator = document.querySelector("#model-indicator");
const modelIndicatorText = document.querySelector("#model-indicator-text");

let ffmpeg = null;
let FFmpegClass = null;
let fetchFileFromSource = null;
let toBlobUrl = null;
let pipelineFactory = null;
let transcriber = null;
let transcriberModelId = "";
let audioContext = null;
let isTranscribing = false;
let cancelRequested = false;
let activeItemId = null;
let items = [];

function createItem(file) {
  return {
    id: createId(),
    file,
    status: "ready",
    progress: 0,
    transcript: "",
    error: "",
  };
}

function createId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isAudioFile(file) {
  const extension = file.name.toLowerCase().split(".").pop();
  return AUDIO_EXTENSIONS.has(extension) || file.type.startsWith("audio/");
}

function addFiles(fileList) {
  const selectedFiles = [...fileList];
  const accepted = selectedFiles.filter(isAudioFile).map(createItem);
  const rejectedCount = selectedFiles.length - accepted.length;

  if (accepted.length > 0) {
    items = sortItemsNewestFirst([...items, ...accepted]);
  }

  if (rejectedCount > 0) {
    setStatus(`${rejectedCount} file${rejectedCount === 1 ? "" : "s"} skipped because only audio files are supported.`);
  } else if (accepted.length > 0) {
    setStatus(`${accepted.length} audio file${accepted.length === 1 ? "" : "s"} added.`);
  }

  fileInput.value = "";
  render();
}

function sortItemsNewestFirst(queueItems) {
  return [...queueItems].sort((first, second) => second.file.lastModified - first.file.lastModified);
}

function setStatus(message) {
  statusLine.textContent = message;
}

function setFFmpegStatus(state, message) {
  ffmpegIndicator.dataset.state = state;
  ffmpegIndicatorText.textContent = message;
}

function setModelStatus(state, message) {
  modelIndicator.dataset.state = state;
  modelIndicatorText.textContent = message;
}

function selectedModel() {
  return MODEL_OPTIONS.find((model) => model.id === modelSelect.value) || MODEL_OPTIONS[0];
}

function populateModelSelect() {
  const groups = new Map();

  MODEL_OPTIONS.forEach((model) => {
    if (!groups.has(model.group)) {
      const group = document.createElement("optgroup");
      group.label = model.group;
      groups.set(model.group, group);
      modelSelect.append(group);
    }

    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.label;
    groups.get(model.group).append(option);
  });

  modelSelect.value = DEFAULT_MODEL_ID;
  updateModelDetails();
}

function updateModelDetails() {
  const model = selectedModel();
  modelName.textContent = model.label;
  modelId.textContent = model.id;
  modelNote.textContent = model.note;

  if (transcriberModelId && transcriberModelId !== model.id) {
    transcriber = null;
    transcriberModelId = "";
    setModelStatus("idle", "Model: Not loaded");
  }
}

function clearQueue() {
  items = [];
  activeItemId = null;
  cancelRequested = false;
  transcriptOutput.value = "";
  setStatus("Add one or more audio files to begin.");
  updateTranscriptControls();
  render();
}

function removeItem(itemId) {
  if (isTranscribing) {
    return;
  }

  const item = items.find((candidate) => candidate.id === itemId);
  items = items.filter((candidate) => candidate.id !== itemId);

  if (item?.transcript) {
    rebuildTranscriptFromItems();
  }

  if (items.length === 0) {
    setStatus("Add one or more audio files to begin.");
  } else if (item) {
    setStatus(`${item.file.name} removed from the queue.`);
  }

  updateTranscriptControls();
  render();
}

function rebuildTranscriptFromItems() {
  const transcriptBlocks = items
    .filter((item) => item.transcript)
    .map((item) => `${transcriptHeading(item)}${item.transcript}`);

  transcriptOutput.value = transcriptBlocks.join("\n\n");
}

async function loadFFmpeg() {
  if (ffmpeg) {
    setFFmpegStatus("ready", "FFmpeg: Ready");
    return ffmpeg;
  }

  setStatus("Loading FFmpeg in the browser. This can take a moment the first time.");
  setFFmpegStatus("loading", "FFmpeg: Loading");

  try {
    await loadFFmpegModules();

    const instance = new FFmpegClass();
    instance.on("progress", ({ progress }) => {
      if (!activeItemId || Number.isNaN(progress)) {
        return;
      }

      const item = items.find((candidate) => candidate.id === activeItemId);
      if (!item || item.status !== "preparing") {
        return;
      }

      item.progress = Math.max(4, Math.min(35, Math.round(progress * 35)));
      render();
    });

    await instance.load({
      coreURL: await toBlobUrl(`${CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobUrl(`${CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
    });

    if (cancelRequested) {
      instance.terminate();
      setFFmpegStatus("idle", "FFmpeg: Not loaded");
      throw new Error("Transcription cancelled.");
    }

    ffmpeg = instance;
    setFFmpegStatus("ready", "FFmpeg: Ready");
    return ffmpeg;
  } catch (error) {
    setFFmpegStatus("error", "FFmpeg: Failed to load");
    throw error;
  }
}

async function loadFFmpegModules() {
  if (FFmpegClass && fetchFileFromSource && toBlobUrl) {
    return;
  }

  const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
    import(FFMPEG_MODULE_URL),
    import(FFMPEG_UTIL_URL),
  ]);

  FFmpegClass = FFmpeg;
  fetchFileFromSource = fetchFile;
  toBlobUrl = toBlobURL;
}

async function loadTranscriber() {
  const model = selectedModel();

  if (transcriber && transcriberModelId === model.id) {
    setModelStatus("ready", "Model: Ready");
    return transcriber;
  }

  transcriber = null;
  transcriberModelId = "";
  setStatus(`Loading ${model.label}. The first download can take a few minutes.`);
  setModelStatus("loading", "Model: Loading");

  try {
    if (!pipelineFactory) {
      const transformers = await import(TRANSFORMERS_MODULE_URL);
      transformers.env.allowLocalModels = false;
      transformers.env.useBrowserCache = true;
      pipelineFactory = transformers.pipeline;
    }

    transcriber = await pipelineFactory("automatic-speech-recognition", model.id, {
      progress_callback: updateModelLoadProgress,
    });

    if (cancelRequested) {
      throw new Error("Transcription cancelled.");
    }

    transcriberModelId = model.id;
    setModelStatus("ready", "Model: Ready");
    return transcriber;
  } catch (error) {
    transcriber = null;
    transcriberModelId = "";
    setModelStatus("error", "Model: Failed to load");
    throw error;
  }
}

function updateModelLoadProgress(event) {
  if (!event) {
    return;
  }

  if (event.status === "progress" && Number.isFinite(event.progress)) {
    setModelStatus("loading", `Model: Downloading ${Math.round(event.progress)}%`);
    return;
  }

  if (event.status === "ready") {
    setModelStatus("ready", "Model: Ready");
    return;
  }

  if (event.file) {
    setModelStatus("loading", `Model: ${event.status} ${event.file}`);
  }
}

function inputFileName(item) {
  const extension = item.file.name.toLowerCase().split(".").pop() || "audio";
  return `${item.id}.${extension}`;
}

function normalizedFileName(item) {
  return `${item.id}.wav`;
}

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("This browser does not support audio decoding.");
    }

    audioContext = new AudioContextClass({ sampleRate: 16000 });
  }

  return audioContext;
}

function normalizeArgs(inputName, outputName) {
  return [
    "-i",
    inputName,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-acodec",
    "pcm_s16le",
    outputName,
  ];
}

function transcriptionOptions(model) {
  if (model.family === "moonshine") {
    return {};
  }

  const options = {
    chunk_length_s: 30,
    stride_length_s: 5,
    generate_kwargs: {
      task: "transcribe",
    },
  };

  if (model.language) {
    options.generate_kwargs.language = model.language;
  }

  return options;
}

async function deleteVirtualFile(name) {
  if (!ffmpeg || !name) {
    return;
  }

  try {
    await ffmpeg.deleteFile(name);
  } catch {
    // Missing virtual files are harmless after failed transcription or cancellation.
  }
}

async function normalizeAudio(item) {
  const inputName = inputFileName(item);
  const outputName = normalizedFileName(item);

  try {
    const instance = await loadFFmpeg();
    await instance.writeFile(inputName, await fetchFileFromSource(item.file));
    await instance.exec(normalizeArgs(inputName, outputName));
    const data = await instance.readFile(outputName);
    return new Blob([data.buffer], { type: "audio/wav" });
  } finally {
    await deleteVirtualFile(inputName);
    await deleteVirtualFile(outputName);
  }
}

async function decodeAudioSamples(audioBlob) {
  const context = getAudioContext();

  if (context.state === "suspended") {
    await context.resume();
  }

  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await context.decodeAudioData(arrayBuffer);
  return audioBuffer.getChannelData(0);
}

async function transcribeItem(item) {
  activeItemId = item.id;
  item.status = "preparing";
  item.progress = 4;
  item.error = "";
  item.transcript = "";
  render();

  try {
    setStatus(`Preparing ${item.file.name} for transcription.`);
    const audioBlob = await normalizeAudio(item);

    if (cancelRequested) {
      throw new Error("Transcription cancelled.");
    }

    item.status = "transcribing";
    item.progress = 42;
    render();

    const modelConfig = selectedModel();
    const model = await loadTranscriber();
    const audioSamples = await decodeAudioSamples(audioBlob);

    setStatus(`Transcribing ${item.file.name}.`);
    const result = await model(audioSamples, transcriptionOptions(modelConfig));

    if (cancelRequested) {
      throw new Error("Transcription cancelled.");
    }

    item.transcript = normalizeTranscript(result);
    if (!item.transcript) {
      throw new Error("The selected model returned no text for this file.");
    }

    item.status = "done";
    item.progress = 100;
    setStatus(`${item.file.name} transcribed.`);
    appendTranscript(item);
  } catch (error) {
    item.status = "error";
    item.progress = 0;
    item.error = formatError(error);
    setStatus(`Could not transcribe ${item.file.name}.`);
  } finally {
    if (activeItemId === item.id) {
      activeItemId = null;
    }

    render();
  }
}

function normalizeTranscript(result) {
  if (typeof result === "string") {
    return result.trim();
  }

  if (Array.isArray(result)) {
    return result.map(normalizeTranscript).filter(Boolean).join("\n\n").trim();
  }

  if (result && typeof result.text === "string") {
    return result.text.trim();
  }

  if (result && Array.isArray(result.chunks)) {
    return result.chunks
      .map((chunk) => chunk && typeof chunk.text === "string" ? chunk.text.trim() : "")
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  return "";
}

function appendTranscript(item) {
  if (!item.transcript) {
    return;
  }

  const heading = transcriptHeading(item);
  const spacer = transcriptOutput.value.trim() ? "\n\n" : "";
  transcriptOutput.value = `${transcriptOutput.value}${spacer}${heading}${item.transcript}`;
  updateTranscriptControls();
}

function transcriptHeading(item) {
  const title = `${item.file.name} - ${formatFileDate(item.file.lastModified)}`;
  return `${title}\n${"=".repeat(title.length)}\n`;
}

function formatFileDate(timestamp) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "File date unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatError(error) {
  if (cancelRequested) {
    return "Transcription cancelled.";
  }

  const message = error instanceof Error ? error.message : String(error);
  if (!message || message === "ErrnoError") {
    return "The browser could not decode this audio file.";
  }

  return message;
}

async function transcribeBatch() {
  if (isTranscribing || items.length === 0) {
    return;
  }

  isTranscribing = true;
  cancelRequested = false;
  transcriptOutput.value = "";
  updateTranscriptControls();

  items.forEach((item) => {
    item.status = "ready";
    item.progress = 0;
    item.transcript = "";
    item.error = "";
  });
  items = sortItemsNewestFirst(items);

  setStatus(`Preparing ${items.length} file${items.length === 1 ? "" : "s"} for transcription.`);
  render();

  for (const item of items) {
    if (cancelRequested) {
      break;
    }

    await transcribeItem(item);
  }

  if (cancelRequested) {
    setStatus("Batch transcription cancelled.");
  } else {
    const completedCount = items.filter((item) => item.status === "done").length;
    setStatus(`${completedCount} of ${items.length} file${items.length === 1 ? "" : "s"} transcribed.`);
  }

  isTranscribing = false;
  activeItemId = null;
  cancelRequested = false;
  updateTranscriptControls();
  render();
}

function cancelTranscription() {
  if (!isTranscribing) {
    return;
  }

  cancelRequested = true;
  if (ffmpeg) {
    ffmpeg.terminate();
    ffmpeg = null;
  }
  setFFmpegStatus("idle", "FFmpeg: Not loaded");

  const activeItem = items.find((item) => item.id === activeItemId);
  if (activeItem) {
    activeItem.status = "error";
    activeItem.progress = 0;
    activeItem.error = "Transcription cancelled.";
  }

  activeItemId = null;
  setStatus("Stopping transcription.");
  render();
}

async function copyTranscript() {
  const text = transcriptOutput.value.trim();
  if (!text) {
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    setStatus("Transcript copied to clipboard.");
  } catch {
    transcriptOutput.focus();
    transcriptOutput.select();
    setStatus("Select the transcript text and copy it manually.");
  }
}

function downloadTranscript() {
  const text = transcriptOutput.value.trim();
  if (!text) {
    return;
  }

  const blob = new Blob([`${text}\n`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = transcriptFileName();
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function transcriptFileName() {
  if (items.length === 1) {
    return `${items[0].file.name.replace(/\.[^.]+$/, "") || "transcript"}.txt`;
  }

  return "transcript.txt";
}

function updateTranscriptControls() {
  const hasTranscript = transcriptOutput.value.trim().length > 0;
  copyButton.disabled = !hasTranscript;
  downloadTextButton.disabled = !hasTranscript;
  transcriptSummary.textContent = hasTranscript
    ? `${wordCount(transcriptOutput.value)} words`
    : "Transcribed text will appear here.";
}

function wordCount(text) {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

function fileSize(bytes) {
  if (bytes >= MAX_DISPLAY_BYTES) {
    return `${(bytes / MAX_DISPLAY_BYTES).toFixed(2)} GB`;
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function statusText(status) {
  if (status === "ready") {
    return "Ready";
  }

  if (status === "preparing") {
    return "Preparing";
  }

  if (status === "transcribing") {
    return "Transcribing";
  }

  if (status === "done") {
    return "Done";
  }

  return "Error";
}

function render() {
  const doneCount = items.filter((item) => item.status === "done").length;
  const errorCount = items.filter((item) => item.status === "error").length;

  transcribeButton.disabled = isTranscribing || items.length === 0;
  clearButton.disabled = isTranscribing || items.length === 0;
  modelSelect.disabled = isTranscribing;
  cancelButton.hidden = !isTranscribing;

  if (items.length === 0) {
    queueSummary.textContent = "No files selected.";
    queueList.innerHTML = '<li class="empty-state">Selected audio files will appear here.</li>';
    return;
  }

  const pieces = [`${items.length} queued`, `${doneCount} transcribed`];
  if (errorCount > 0) {
    pieces.push(`${errorCount} failed`);
  }
  queueSummary.textContent = pieces.join(" - ");

  queueList.replaceChildren(...items.map(renderItem));
}

function renderItem(item) {
  const li = document.createElement("li");
  li.className = "queue-item";

  const main = document.createElement("div");
  main.className = "file-main";

  const nameRow = document.createElement("div");
  nameRow.className = "file-name-row";

  const name = document.createElement("span");
  name.className = "file-name";
  name.textContent = item.file.name;

  const status = document.createElement("span");
  status.className = `file-status ${item.status}`;
  status.textContent = statusText(item.status);

  nameRow.append(name, status);

  const meta = document.createElement("p");
  meta.className = "file-meta";
  meta.textContent = item.transcript ? `${fileSize(item.file.size)} - ${wordCount(item.transcript)} words` : fileSize(item.file.size);

  const progress = document.createElement("div");
  progress.className = "progress-track";
  progress.setAttribute("aria-label", `${item.file.name} progress`);

  const fill = document.createElement("div");
  fill.className = "progress-fill";
  fill.style.width = `${item.progress}%`;
  progress.append(fill);

  main.append(nameRow, meta, progress);

  if (item.error) {
    const error = document.createElement("p");
    error.className = "file-error";
    error.textContent = item.error;
    main.append(error);
  }

  const actions = document.createElement("div");
  actions.className = "file-actions";

  const removeButton = document.createElement("button");
  removeButton.className = "remove-button";
  removeButton.type = "button";
  removeButton.disabled = isTranscribing;
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => removeItem(item.id));
  actions.append(removeButton);

  li.append(main, actions);
  return li;
}

fileInput.addEventListener("change", () => addFiles(fileInput.files));
modelSelect.addEventListener("change", updateModelDetails);
transcribeButton.addEventListener("click", transcribeBatch);
clearButton.addEventListener("click", clearQueue);
cancelButton.addEventListener("click", cancelTranscription);
copyButton.addEventListener("click", copyTranscript);
downloadTextButton.addEventListener("click", downloadTranscript);
transcriptOutput.addEventListener("input", updateTranscriptControls);

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("is-dragging");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
  addFiles(event.dataTransfer.files);
});

populateModelSelect();
render();
updateTranscriptControls();
