const CORE_BASE_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
const FFMPEG_MODULE_URL = "./vendor/ffmpeg/index.js";
const FFMPEG_WORKER_URL = new URL("./vendor/ffmpeg/worker.js", import.meta.url).href;
const FFMPEG_UTIL_URL = "./vendor/ffmpeg-util/index.js";
const MAX_DISPLAY_BYTES = 1024 * 1024 * 1024;

const fileInput = document.querySelector("#file-input");
const dropZone = document.querySelector("#drop-zone");
const convertButton = document.querySelector("#convert-button");
const clearButton = document.querySelector("#clear-button");
const cancelButton = document.querySelector("#cancel-button");
const downloadAllButton = document.querySelector("#download-all-button");
const queueList = document.querySelector("#queue-list");
const queueSummary = document.querySelector("#queue-summary");
const statusLine = document.querySelector("#status-line");
const ffmpegIndicator = document.querySelector("#ffmpeg-indicator");
const ffmpegIndicatorText = document.querySelector("#ffmpeg-indicator-text");

let ffmpeg = null;
let FFmpegClass = null;
let fetchFileFromSource = null;
let toBlobUrl = null;
let isConverting = false;
let cancelRequested = false;
let activeItemId = null;
let items = [];

const formatLabel = {
  mp3: "MP3",
  wav: "WAV",
};

const mimeTypes = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

function selectedFormat() {
  return document.querySelector("input[name='output-format']:checked").value;
}

function createItem(file) {
  return {
    id: createId(),
    file,
    status: "ready",
    progress: 0,
    outputName: "",
    outputUrl: "",
    error: "",
  };
}

function createId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isWmaFile(file) {
  return file.name.toLowerCase().endsWith(".wma");
}

function addFiles(fileList) {
  const selectedFiles = [...fileList];
  const accepted = selectedFiles.filter(isWmaFile).map(createItem);
  const rejectedCount = selectedFiles.length - accepted.length;

  if (accepted.length > 0) {
    items = [...items, ...accepted];
  }

  if (rejectedCount > 0) {
    setStatus(`${rejectedCount} file${rejectedCount === 1 ? "" : "s"} skipped because only .wma files are supported.`);
  } else if (accepted.length > 0) {
    setStatus(`${accepted.length} WMA file${accepted.length === 1 ? "" : "s"} added.`);
  }

  fileInput.value = "";
  render();
}

function setStatus(message) {
  statusLine.textContent = message;
}

function setFFmpegStatus(state, message) {
  ffmpegIndicator.dataset.state = state;
  ffmpegIndicatorText.textContent = message;
}

function revokeItemUrl(item) {
  if (item.outputUrl) {
    URL.revokeObjectURL(item.outputUrl);
    item.outputUrl = "";
  }
}

function clearQueue() {
  items.forEach(revokeItemUrl);
  items = [];
  activeItemId = null;
  cancelRequested = false;
  setStatus("Add one or more WMA files to begin.");
  render();
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
      if (!item || item.status !== "converting") {
        return;
      }

      item.progress = Math.max(4, Math.min(99, Math.round(progress * 100)));
      render();
    });

    await instance.load({
      classWorkerURL: FFMPEG_WORKER_URL,
      coreURL: await toBlobUrl(`${CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobUrl(`${CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
    });

    if (cancelRequested) {
      instance.terminate();
      setFFmpegStatus("idle", "FFmpeg: Not loaded");
      throw new Error("Conversion cancelled.");
    }

    ffmpeg = instance;
    setFFmpegStatus("ready", "FFmpeg: Ready");
    setStatus("FFmpeg has finished loading. Starting conversion.");
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

function outputFileName(inputName, format) {
  return inputName.replace(/\.wma$/i, `.${format}`);
}

function conversionArgs(inputName, outputName, format) {
  if (format === "mp3") {
    return [
      "-i",
      inputName,
      "-vn",
      "-b:a",
      "192k",
      outputName,
    ];
  }

  return [
    "-i",
    inputName,
    "-vn",
    "-acodec",
    "pcm_s16le",
    "-ar",
    "44100",
    outputName,
  ];
}

async function deleteVirtualFile(name) {
  if (!ffmpeg || !name) {
    return;
  }

  try {
    await ffmpeg.deleteFile(name);
  } catch {
    // Missing virtual files are harmless after failed conversions or cancellation.
  }
}

async function convertItem(item, format) {
  const inputName = `${item.id}.wma`;
  const outputName = `${item.id}.${format}`;

  activeItemId = item.id;
  revokeItemUrl(item);
  item.status = "converting";
  item.progress = 4;
  item.error = "";
  item.outputName = outputFileName(item.file.name, format);
  render();

  try {
    const instance = await loadFFmpeg();
    await instance.writeFile(inputName, await fetchFileFromSource(item.file));
    await instance.exec(conversionArgs(inputName, outputName, format));

    const data = await instance.readFile(outputName);
    const blob = new Blob([data.buffer], { type: mimeTypes[format] });

    item.outputUrl = URL.createObjectURL(blob);
    item.status = "done";
    item.progress = 100;
    setStatus(`${item.file.name} converted to ${formatLabel[format]}.`);
  } catch (error) {
    item.status = "error";
    item.progress = 0;
    item.error = formatError(error);
    setStatus(`Could not convert ${item.file.name}.`);
  } finally {
    await deleteVirtualFile(inputName);
    await deleteVirtualFile(outputName);

    if (activeItemId === item.id) {
      activeItemId = null;
    }

    render();
  }
}

function formatError(error) {
  if (cancelRequested) {
    return "Conversion cancelled.";
  }

  const message = error instanceof Error ? error.message : String(error);
  if (!message || message === "ErrnoError") {
    return "FFmpeg could not decode this WMA file.";
  }

  return message;
}

async function convertBatch() {
  if (isConverting || items.length === 0) {
    return;
  }

  isConverting = true;
  cancelRequested = false;
  const format = selectedFormat();

  items.forEach((item) => {
    if (item.status !== "converting") {
      revokeItemUrl(item);
      item.status = "ready";
      item.progress = 0;
      item.outputName = "";
      item.error = "";
    }
  });

  setStatus(`Preparing ${items.length} file${items.length === 1 ? "" : "s"} for ${formatLabel[format]} conversion.`);
  render();

  for (const item of items) {
    if (cancelRequested) {
      break;
    }

    await convertItem(item, format);
  }

  if (cancelRequested) {
    setStatus("Batch conversion cancelled.");
  } else {
    const completedCount = items.filter((item) => item.status === "done").length;
    setStatus(`${completedCount} of ${items.length} file${items.length === 1 ? "" : "s"} converted.`);
  }

  isConverting = false;
  activeItemId = null;
  cancelRequested = false;
  render();
}

function cancelConversion() {
  if (!isConverting) {
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
    activeItem.error = "Conversion cancelled.";
  }

  activeItemId = null;
  setStatus("Stopping conversion.");
  render();
}

function downloadAllConverted() {
  const completed = items.filter((item) => item.status === "done" && item.outputUrl);

  completed.forEach((item, index) => {
    window.setTimeout(() => {
      const link = document.createElement("a");
      link.href = item.outputUrl;
      link.download = item.outputName;
      document.body.append(link);
      link.click();
      link.remove();
    }, index * 250);
  });
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

  if (status === "converting") {
    return "Converting";
  }

  if (status === "done") {
    return "Done";
  }

  return "Error";
}

function render() {
  const doneCount = items.filter((item) => item.status === "done").length;
  const errorCount = items.filter((item) => item.status === "error").length;

  convertButton.disabled = isConverting || items.length === 0;
  clearButton.disabled = isConverting || items.length === 0;
  cancelButton.hidden = !isConverting;
  downloadAllButton.disabled = doneCount === 0 || isConverting;

  if (items.length === 0) {
    queueSummary.textContent = "No files selected.";
    queueList.innerHTML = '<li class="empty-state">Selected WMA files will appear here.</li>';
    return;
  }

  const pieces = [`${items.length} queued`, `${doneCount} converted`];
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
  meta.textContent = item.outputName
    ? `${fileSize(item.file.size)} - ${item.outputName}`
    : fileSize(item.file.size);

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

  if (item.outputUrl) {
    const download = document.createElement("a");
    download.className = "download-link";
    download.href = item.outputUrl;
    download.download = item.outputName;
    download.textContent = "Download";
    actions.append(download);
  }

  li.append(main, actions);
  return li;
}

fileInput.addEventListener("change", () => addFiles(fileInput.files));
convertButton.addEventListener("click", convertBatch);
clearButton.addEventListener("click", clearQueue);
cancelButton.addEventListener("click", cancelConversion);
downloadAllButton.addEventListener("click", downloadAllConverted);

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

render();
