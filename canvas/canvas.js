(function () {
  const editor = document.getElementById("canvas-editor");
  const statusLabel = document.getElementById("status-label");
  const stopButton = document.getElementById("stop-button");
  const reloadButton = document.getElementById("reload-button");
  const undoButton = document.getElementById("undo-button");
  const copyButton = document.getElementById("copy-button");
  const deleteButton = document.getElementById("delete-button");
  const saveButton = document.getElementById("save-button");
  const systemPromptInput = document.getElementById("system-prompt-input");

  const selectionPanel = document.getElementById("selection-panel");
  const selectionPrompt = document.getElementById("selection-prompt");
  const selectionCancelButton = document.getElementById("selection-cancel");
  const themeToggle = document.getElementById("theme-toggle");

  if (!editor) {
    console.error("Canvas editor not found. Aborting initialization.");
    return;
  }

  const API_ENDPOINT = "https://api.mistral.ai/v1/chat/completions";
  const API_KEY = "XnkOojjrb6H9nRy2RLZh0204K3mwC7UR";

  const DEFAULT_SYSTEM_PROMPT =
    "You are a helpful AI literacy assistant. All responses must remain politically correct, concise, and ready to paste into plain text. Avoid headings, markdown syntax, or meta-commentary unless explicitly requested.";
  const SYSTEM_PROMPT_KEY = "canvas-system-prompt";
  const THEME_KEY = "canvas-theme";
  const conversationHistory = [];

  const DB_NAME = "mistral-canvas";
  const DB_VERSION = 1;
  const STORE_NAME = "documents";
  const DOCUMENT_KEY = "canvas-main";

  const undoStack = [];
  const MAX_UNDO = 200;
  let lastValue = "";
  let generationInFlight = false;
  let activeController = null;
  let pendingSelection = null;
  let dbPromise = null;

  function setStatus(text) {
    statusLabel.textContent = text;
  }

  function applyTheme(theme, { persist = true } = {}) {
    const isDark = theme === "dark";
    document.body.classList.toggle("theme-dark", isDark);
    if (themeToggle) {
      themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
      themeToggle.setAttribute("aria-pressed", String(isDark));
    }
    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (error) {
        console.warn("Unable to store theme preference:", error);
      }
    }
  }

  function getSystemPrompt() {
    const value = systemPromptInput.value.trim();
    return value || DEFAULT_SYSTEM_PROMPT;
  }

  function pushUndoSnapshot(value) {
    undoStack.push(value);
    if (undoStack.length > MAX_UNDO) {
      undoStack.shift();
    }
  }

  function getDb() {
    if (!("indexedDB" in window)) {
      console.warn("IndexedDB not supported; persistence disabled.");
      return null;
    }
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = () => reject(request.error);
      }).catch((error) => {
        console.error("Failed to open IndexedDB:", error);
        return null;
      });
    }
    return dbPromise;
  }

  async function saveDocument(content) {
    try {
      const db = await getDb();
      if (!db) return;
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const request = tx.objectStore(STORE_NAME).put(content, DOCUMENT_KEY);
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Failed to save document:", error);
    }
  }

  async function loadDocument() {
    try {
      const db = await getDb();
      if (!db) return "";
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(DOCUMENT_KEY);
        request.onsuccess = () => resolve(request.result || "");
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Failed to load document:", error);
      return "";
    }
  }

  function measureCaretCoordinates(element, position) {
    if (typeof position !== "number") {
      return null;
    }

    const properties = [
      "direction",
      "boxSizing",
      "width",
      "height",
      "overflowX",
      "overflowY",
      "borderTopWidth",
      "borderRightWidth",
      "borderBottomWidth",
      "borderLeftWidth",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "fontStyle",
      "fontVariant",
      "fontWeight",
      "fontStretch",
      "fontSize",
      "lineHeight",
      "fontFamily",
      "textAlign",
      "textTransform",
      "textIndent",
      "textDecoration",
      "letterSpacing",
      "wordSpacing",
    ];

    const div = document.createElement("div");
    const style = window.getComputedStyle(element);
    div.style.position = "absolute";
    div.style.visibility = "hidden";
    div.style.whiteSpace = "pre-wrap";
    div.style.wordWrap = "break-word";
    div.style.overflow = "hidden";

    properties.forEach((prop) => {
      div.style[prop] = style[prop];
    });

    div.textContent = element.value.slice(0, position);
    const span = document.createElement("span");
    span.textContent = element.value.slice(position) || ".";
    div.appendChild(span);
    document.body.appendChild(div);

    const top = span.offsetTop + parseFloat(style.borderTopWidth || "0") - element.scrollTop;
    const left = span.offsetLeft + parseFloat(style.borderLeftWidth || "0") - element.scrollLeft;

    document.body.removeChild(div);
    return { top, left };
  }

  async function streamFromMistral(prompt, onProgress) {
    const payload = {
      model: "mistral-large-latest",
      messages: [{ role: "system", content: getSystemPrompt() }, ...conversationHistory, { role: "user", content: prompt }],
      stream: true,
    };

    const controller = new AbortController();
    activeController = controller;

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let suggestion = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter((line) => line.trim() !== "");

      for (const line of lines) {
        if (line === "data: [DONE]") {
          break;
        }

        if (line.startsWith("data: ")) {
          const json = line.slice(6);
          try {
            const data = JSON.parse(json);
            const delta = data.choices?.[0]?.delta?.content || "";
            suggestion += delta;
            onProgress?.(suggestion);
          } catch (error) {
            console.error("JSON parse error:", error);
          }
        }
      }
    }

    activeController = null;
    return suggestion.trim();
  }

  function openSelectionPanel(resetPrompt = true) {
    selectionPanel.classList.add("open");
    selectionPanel.setAttribute("aria-hidden", "false");
    selectionPrompt.disabled = false;
    if (resetPrompt) {
      selectionPrompt.value = "";
    }
    requestAnimationFrame(() => {
      positionSelectionPanel();
      selectionPrompt.focus();
      selectionPrompt.select();
    });
    setStatus("Describe the edit for the selected text.");
  }

  function closeSelectionPanel({ collapseSelection = false } = {}) {
    selectionPanel.classList.remove("open");
    selectionPanel.setAttribute("aria-hidden", "true");
    selectionPanel.style.top = "";
    selectionPanel.style.left = "";
    selectionPrompt.value = "";
    selectionPrompt.disabled = false;
    pendingSelection = null;
    if (collapseSelection) {
      const cursor = editor.selectionEnd;
      editor.focus();
      editor.setSelectionRange(cursor, cursor);
    }
  }

  function refreshSelectionState() {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;

    if (start === end) {
      closeSelectionPanel();
      return;
    }

    pendingSelection = {
      start,
      end,
      text: editor.value.slice(start, end),
      snapshot: editor.value,
    };

    openSelectionPanel();
  }

  function positionSelectionPanel() {
    if (!pendingSelection || !selectionPanel.classList.contains("open")) {
      return;
    }

    const caret = measureCaretCoordinates(editor, pendingSelection.end);
    if (!caret) {
      return;
    }

    const editorRect = editor.getBoundingClientRect();
    const style = window.getComputedStyle(editor);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) || 18;
    const padding = 12;
    const caretViewportTop = editorRect.top + caret.top + lineHeight + 6;

    let top = caretViewportTop;
    const panelHeight = selectionPanel.offsetHeight || selectionPanel.scrollHeight;
    const maxTop = window.innerHeight - panelHeight - padding;

    if (top < padding) top = padding;
    if (top > maxTop) top = maxTop;

    selectionPanel.style.top = `${Math.round(top)}px`;
  }

  async function handleSelectionEdit(selection, userPrompt) {
    if (generationInFlight) {
      setStatus("A request is already running.");
      return;
    }

    generationInFlight = true;
    stopButton.disabled = false;
    reloadButton.disabled = true;
    selectionPrompt.disabled = true;
    setStatus("Contacting Mistral for edit...");

    try {
      const prompt =
        `Edit the following passage exactly as instructed. Reply with only the revised text in plain language (no markdown or commentary).\n` +
        `Original text:\n"""${selection.text}"""\nInstruction: ${userPrompt}`;

      const suggestion = await streamFromMistral(prompt, (partial) => {
        setStatus(`Editing... ${partial.length} chars`);
      });

      if (!suggestion) {
        setStatus("Edit returned no content.");
        return;
      }

      conversationHistory.push({ role: "user", content: prompt });
      conversationHistory.push({ role: "assistant", content: suggestion });

      if (editor.value !== selection.snapshot) {
        setStatus("Document changed while editing. Try again.");
        return;
      }

      pushUndoSnapshot(editor.value);
      const before = editor.value.slice(0, selection.start);
      const after = editor.value.slice(selection.end);
      editor.value = `${before}${suggestion}${after}`;
      const cursor = before.length + suggestion.length;
      editor.setSelectionRange(cursor, cursor);
      lastValue = editor.value;
      saveDocument(editor.value);
      closeSelectionPanel();
      setStatus("Selection updated with AI edit.");
    } catch (error) {
      if (error.name === "AbortError") {
        setStatus("Edit cancelled.");
      } else {
        console.error("Edit failed:", error);
        setStatus(`Edit failed: ${error.message}`);
      }
    } finally {
      generationInFlight = false;
      stopButton.disabled = true;
      reloadButton.disabled = false;
      selectionPrompt.disabled = false;
      activeController = null;
    }
  }

  editor.addEventListener("select", () => setTimeout(refreshSelectionState, 0));
  editor.addEventListener("mouseup", () => setTimeout(refreshSelectionState, 0));
  editor.addEventListener("keyup", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Shift"].includes(event.key)) {
      setTimeout(refreshSelectionState, 0);
    }
  });
  editor.addEventListener("scroll", () => {
    if (selectionPanel.classList.contains("open")) {
      positionSelectionPanel();
    }
  });
  window.addEventListener("resize", () => positionSelectionPanel());

  editor.addEventListener("input", () => {
    lastValue = editor.value;
    saveDocument(editor.value);
  });

  selectionPrompt.addEventListener("keydown", async (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSelectionPanel({ collapseSelection: true });
      setStatus("Selection edit cancelled.");
      return;
    }

    const isEnterKey =
      event.key === "Enter" ||
      event.key === "NumpadEnter" ||
      event.code === "Enter" ||
      event.code === "NumpadEnter" ||
      event.keyCode === 13;

    if (!isEnterKey || event.shiftKey || event.isComposing) {
      return;
    }

    event.preventDefault();
    if (!pendingSelection) {
      setStatus("Highlight text before applying an edit.");
      return;
    }

    const userPrompt = selectionPrompt.value.trim();
    if (!userPrompt) {
      selectionPrompt.focus();
      return;
    }

    await handleSelectionEdit(pendingSelection, userPrompt);
  });

  selectionCancelButton.addEventListener("click", () => {
    closeSelectionPanel({ collapseSelection: true });
    editor.focus();
    setStatus("Selection edit cancelled.");
  });

  stopButton.addEventListener("click", () => {
    if (activeController) {
      activeController.abort();
    }
  });

  reloadButton.addEventListener("click", () => {
    conversationHistory.length = 0;
    setStatus("Session reset. History cleared.");
  });

  undoButton.addEventListener("click", () => {
    if (!undoStack.length) {
      setStatus("Nothing to undo.");
      return;
    }
    const previous = undoStack.pop();
    editor.value = previous;
    lastValue = editor.value;
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
    saveDocument(editor.value);
    setStatus("Undo applied.");
  });

  copyButton.addEventListener("click", async () => {
    editor.focus();
    editor.select();
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(editor.value);
        copied = true;
      }
    } catch (error) {
      console.warn("Clipboard API unavailable:", error);
    }

    if (!copied) {
      try {
        document.execCommand("copy");
        copied = true;
      } catch (error) {
        console.error("Copy failed:", error);
      }
    }

    const end = editor.value.length;
    editor.setSelectionRange(end, end);

    setStatus(copied ? "Copied entire document." : "Copy failed.");
  });

  deleteButton.addEventListener("click", () => {
    if (!editor.value) {
      setStatus("Document already empty.");
      return;
    }
    pushUndoSnapshot(editor.value);
    editor.value = "";
    lastValue = "";
    saveDocument("");
    closeSelectionPanel();
    setStatus("Document cleared.");
  });

  saveButton.addEventListener("click", () => {
    const content = `${editor.value}\n\n---\nSystem Prompt:\n${getSystemPrompt()}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mistral-canvas.txt";
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Saved as mistral-canvas.txt");
  });

  systemPromptInput.addEventListener("input", () => {
    localStorage.setItem(SYSTEM_PROMPT_KEY, systemPromptInput.value);
  });

  loadDocument().then((content) => {
    if (content) {
      editor.value = content;
    }
    lastValue = editor.value;
  });

  const storedPrompt = localStorage.getItem(SYSTEM_PROMPT_KEY);
  if (storedPrompt) {
    systemPromptInput.value = storedPrompt;
  } else {
    systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
  }

  const storedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(storedTheme || (prefersDark ? "dark" : "light"), { persist: false });

  themeToggle?.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("theme-dark") ? "light" : "dark";
    applyTheme(nextTheme);
  });

  setStatus("Highlight text to open the Canvas prompt and press Enter to apply changes.");
})();
