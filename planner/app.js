(() => {
  'use strict';

  const LEGACY_STORAGE_KEY = 'weekly-planner-data-v1';
  const HANDLE_DB = 'weekly-planner-file-handles-v1';
  const HANDLE_STORE = 'handles';
  const ACTIVE_HANDLE_KEY = 'active-planner-file';
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const COLORS = ['#24aeb7', '#6877d4', '#e39b54', '#58a77d', '#b677b7', '#d36b77', '#568eb7', '#96a63e'];
  const HISTORY_LIMIT = 100;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const ui = {
    tabs: $('#term-tabs'),
    start: $('#term-start'),
    dateHint: $('#date-hint'),
    count: $('#week-count'),
    addWeek: $('#add-week'),
    removeWeek: $('#remove-week'),
    undo: $('#undo-button'),
    redo: $('#redo-button'),
    copyTermSource: $('#copy-term-source'),
    copyTerm: $('#copy-term-button'),
    subjectForm: $('#subject-form'),
    subjectName: $('#subject-name'),
    newDays: $('#new-subject-days'),
    subjectList: $('#subject-list'),
    subjectListTerm: $('#subject-list-term'),
    subjectTotal: $('#subject-total'),
    emptySubjects: $('#empty-subjects'),
    gridBody: $('#planner-body'),
    workspace: $('#planner-workspace'),
    fileSaveStatus: $('#file-save-status'),
    fileSaveLabel: $('#file-save-label'),
    newPlanner: $('#new-planner-button'),
    saveAs: $('#save-as-button'),
    load: $('#load-button'),
    exportExcel: $('#export-excel-button'),
    reloadFile: $('#reload-file-button'),
    toast: $('#toast'),
    noteDialog: $('#note-dialog'),
    noteDialogEyebrow: $('#note-dialog-eyebrow'),
    noteDialogTitle: $('#note-dialog-title'),
    noteDialogDate: $('#note-dialog-date'),
    noteDialogLabel: $('#note-dialog-label'),
    noteText: $('#note-text'),
    noteForm: $('#note-form'),
    saveNoteButton: $('#save-note-button'),
    cancelNote: $('#cancel-note'),
    closeNoteDialog: $('#close-note-dialog'),
  };

  let hasLegacyPlannerCopy = false;
  let state = loadState();
  let undoStack = [];
  let redoStack = [];
  let lastHistorySnapshot = historySnapshot();
  let toastTimer = 0;
  let saveTimer = 0;
  let draggedLessonId = null;
  let draggedDayNoteId = null;
  let editingLessonId = null;
  let editingDayNote = null;
  let suppressCardClickUntil = 0;
  let linkedFileHandle = null;
  let fileHandlePersisted = false;
  let fileWriteQueue = Promise.resolve();
  let fileBaseSignatures = new WeakMap();
  let fileConflict = false;
  let fileDirty = false;
  let stateGeneration = 0;
  let importedFileName = null;
  let fileRestoreComplete = false;

  function localDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function mondayOf(date) {
    const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const offset = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - offset);
    return monday;
  }

  function addDays(dateString, amount) {
    const date = parseLocalDate(dateString);
    date.setDate(date.getDate() + amount);
    return localDateString(date);
  }

  function parseLocalDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function formatShortDate(dateString) {
    return parseLocalDate(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function createTerm(index, startDate) {
    return {
      name: `Term ${index + 1}`,
      startDate,
      weeks: 6,
      subjects: [],
      lessons: [],
      dayOrders: DAY_NAMES.map(() => []),
      dayNotes: [],
    };
  }

  function newState() {
    const start = localDateString(mondayOf(new Date()));
    return { version: 1, activeTerm: 0, terms: [0, 1, 2, 3].map((index) => createTerm(index, start)) };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return newState();
      const value = JSON.parse(raw);
      if (!value || !Array.isArray(value.terms) || value.terms.length !== 4) return newState();
      hasLegacyPlannerCopy = true;
      value.activeTerm = Number.isInteger(value.activeTerm) && value.activeTerm >= 0 && value.activeTerm < 4 ? value.activeTerm : 0;
      value.terms = value.terms.map((term, index) => normalizeTerm(term, index));
      value.version = 1;
      return value;
    } catch (error) {
      return newState();
    }
  }

  function normalizeTerm(term, index) {
    const defaultDate = localDateString(mondayOf(new Date()));
    const date = typeof term.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(term.startDate) ? term.startDate : defaultDate;
    const start = parseLocalDate(date);
    const startDate = start.getDay() === 1 ? date : localDateString(mondayOf(start));
    const subjects = Array.isArray(term.subjects) ? term.subjects.filter((subject) => subject && typeof subject.name === 'string').map((subject) => ({
      id: typeof subject.id === 'string' ? subject.id : makeId(),
      name: subject.name.slice(0, 50),
      days: Array.isArray(subject.days) ? [...new Set(subject.days.map(Number).filter((day) => day >= 0 && day <= 4))] : [],
    })) : [];
    const lessons = Array.isArray(term.lessons) ? term.lessons.filter((lesson) => lesson && typeof lesson.subjectId === 'string').map((lesson) => ({
      id: typeof lesson.id === 'string' ? lesson.id : makeId(),
      subjectId: lesson.subjectId,
      scheduledDate: typeof lesson.scheduledDate === 'string' ? lesson.scheduledDate : lesson.date,
      date: typeof lesson.date === 'string' ? lesson.date : lesson.scheduledDate,
      notes: typeof lesson.notes === 'string' ? lesson.notes.slice(0, 10000) : '',
    })).filter((lesson) => lesson.scheduledDate && lesson.date && subjects.some((subject) => subject.id === lesson.subjectId)) : [];
    const savedOrders = Array.isArray(term.dayOrders) ? term.dayOrders : [];
    const dayOrders = DAY_NAMES.map((_, dayIndex) => {
      const validIds = Array.isArray(savedOrders[dayIndex]) ? savedOrders[dayIndex].filter((id) => typeof id === 'string' && subjects.some((subject) => subject.id === id)) : [];
      const order = [...new Set(validIds)];
      subjects.forEach((subject) => {
        if (subject.days.includes(dayIndex) && !order.includes(subject.id)) order.push(subject.id);
      });
      return order;
    });
    let dayNotes = [];
    if (Array.isArray(term.dayNotes)) {
      dayNotes = term.dayNotes.filter((note) => note && /^\d{4}-\d{2}-\d{2}$/.test(note.date) && typeof note.text === 'string' && note.text.trim()).map((note) => ({
        id: typeof note.id === 'string' ? note.id : makeId(),
        date: note.date,
        text: note.text.slice(0, 10000),
        position: Number.isInteger(note.position) ? Math.max(0, note.position) : 0,
        completed: note.completed === true,
      }));
    } else if (term.dayNotes && typeof term.dayNotes === 'object') {
        dayNotes = Object.entries(term.dayNotes).flatMap(([date, note]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && typeof note === 'string' && note.trim() ? [{ id: makeId(), date, text: note.slice(0, 10000), position: 0, completed: false }] : []);
    }
    return {
      name: `Term ${index + 1}`,
      startDate,
      weeks: Number.isInteger(term.weeks) ? Math.max(1, term.weeks) : 6,
      subjects,
      lessons,
      dayOrders,
      dayNotes,
    };
  }

  function activeTerm() {
    return state.terms[state.activeTerm];
  }

  function dateForWeekday(weekIndex, dayIndex, term = activeTerm()) {
    return addDays(term.startDate, weekIndex * 7 + dayIndex);
  }

  function getSubject(term, id) {
    return term.subjects.find((subject) => subject.id === id);
  }

  function lessonColor(term, subjectId) {
    const index = term.subjects.findIndex((subject) => subject.id === subjectId);
    return COLORS[Math.max(0, index) % COLORS.length];
  }

  function syncScheduledLessons(term, subject) {
    for (let week = 0; week < term.weeks; week += 1) {
      for (const dayIndex of subject.days) {
        if (!term.dayOrders[dayIndex].includes(subject.id)) term.dayOrders[dayIndex].push(subject.id);
        const scheduledDate = dateForWeekday(week, dayIndex, term);
        const alreadyExists = term.lessons.some((lesson) => lesson.subjectId === subject.id && lesson.scheduledDate === scheduledDate);
        if (!alreadyExists) {
          term.lessons.push({ id: makeId(), subjectId: subject.id, scheduledDate, date: scheduledDate });
        }
      }
    }
  }

  function historySnapshot() {
    return JSON.stringify({ ...state, activeTerm: 0 });
  }

  function resetHistory() {
    undoStack = [];
    redoStack = [];
    lastHistorySnapshot = historySnapshot();
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    const editingUnavailable = !fileRestoreComplete || ui.workspace.inert || fileConflict;
    ui.undo.disabled = editingUnavailable || undoStack.length === 0;
    ui.redo.disabled = editingUnavailable || redoStack.length === 0;
  }

  function applyHistoryChange(fromStack, toStack, actionName) {
    if (fileConflict || ui.workspace.inert) return;
    const snapshot = fromStack.pop();
    if (!snapshot) return;
    toStack.push(historySnapshot());
    if (toStack.length > HISTORY_LIMIT) toStack.shift();
    const selectedTerm = state.activeTerm;
    state = JSON.parse(snapshot);
    state.activeTerm = selectedTerm;
    lastHistorySnapshot = historySnapshot();
    saveState();
    render();
    showToast(`${actionName} complete.`);
  }

  function undoChange() {
    applyHistoryChange(undoStack, redoStack, 'Undo');
  }

  function redoChange() {
    applyHistoryChange(redoStack, undoStack, 'Redo');
  }

  function saveState() {
    const currentHistorySnapshot = historySnapshot();
    if (currentHistorySnapshot !== lastHistorySnapshot) {
      undoStack.push(lastHistorySnapshot);
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
      redoStack = [];
      lastHistorySnapshot = currentHistorySnapshot;
    }
    updateHistoryButtons();
    fileDirty = true;
    stateGeneration += 1;
    window.clearTimeout(saveTimer);
    if (fileConflict) {
      setFileStatus('File changed since it was loaded — reload before saving', true);
      return;
    }
    if (!linkedFileHandle) {
      setUnlinkedStatus();
      return;
    }
    setFileStatus(`Unsaved changes — saving to ${displayFileName(linkedFileHandle.name)}…`);
    const handle = linkedFileHandle;
    const generation = stateGeneration;
    saveTimer = window.setTimeout(() => queueFileSave(handle, createFileSnapshot(), generation), 180);
  }

  function setFileStatus(message, isError = false) {
    ui.fileSaveLabel.textContent = message;
    ui.fileSaveStatus.classList.toggle('error', isError);
    ui.fileSaveStatus.classList.toggle('saving', !isError && (message.startsWith('Saving to ') || message.startsWith('Unsaved changes')));
    ui.fileSaveStatus.classList.toggle('saved', !isError && message.startsWith('Saved to '));
  }

  function setUnlinkedStatus() {
    if (importedFileName) {
      setFileStatus(`Imported ${importedFileName} — use Save As to save changes`);
    } else if (hasLegacyPlannerCopy) {
      setFileStatus('Recovered planner from an older browser save — use Save As to keep it in a file');
    } else {
      setFileStatus('No file linked — use Save As or Load');
    }
  }

  function clearLegacyPlannerCopy() {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      hasLegacyPlannerCopy = false;
      return true;
    } catch (error) {
      return false;
    }
  }

  function formatSavedTime(isoTime) {
    if (!isoTime) return '';
    const date = new Date(isoTime);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function createFileSnapshot() {
    const savedAt = new Date().toISOString();
    const documentData = {
      ...state,
      _fileMeta: { updatedAt: savedAt, revision: makeId() },
    };
    return { text: JSON.stringify(documentData, null, 2), savedAt, stateSignature: JSON.stringify(state) };
  }

  function displayFileName(name) {
    return name.replace(/\.json$/i, '');
  }

  function openHandleDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('Browser file links are unavailable.'));
      const request = indexedDB.open(HANDLE_DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(HANDLE_STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open file link storage.'));
    });
  }

  async function storeFileHandle(handle) {
    const db = await openHandleDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(HANDLE_STORE, 'readwrite');
      transaction.objectStore(HANDLE_STORE).put(handle, ACTIVE_HANDLE_KEY);
      transaction.oncomplete = () => { db.close(); fileHandlePersisted = true; resolve(); };
      transaction.onerror = () => { db.close(); fileHandlePersisted = false; reject(transaction.error || new Error('Could not remember this file.')); };
    });
  }

  async function clearStoredFileHandle() {
    if (!fileHandlePersisted) return;
    const db = await openHandleDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(HANDLE_STORE, 'readwrite');
      transaction.objectStore(HANDLE_STORE).delete(ACTIVE_HANDLE_KEY);
      transaction.oncomplete = () => { db.close(); fileHandlePersisted = false; resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error || new Error('Could not disconnect the linked file.')); };
    });
  }

  async function getStoredFileHandle() {
    const db = await openHandleDatabase();
    return new Promise((resolve, reject) => {
      const request = db.transaction(HANDLE_STORE, 'readonly').objectStore(HANDLE_STORE).get(ACTIVE_HANDLE_KEY);
      request.onsuccess = () => { const result = request.result || null; db.close(); resolve(result); };
      request.onerror = () => { db.close(); reject(request.error || new Error('Could not restore the file link.')); };
    });
  }

  async function hasWritePermission(handle, ask = false) {
    if (!handle || typeof handle.queryPermission !== 'function') return false;
    let permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted' && ask && typeof handle.requestPermission === 'function') {
      permission = await handle.requestPermission({ mode: 'readwrite' });
    }
    return permission === 'granted';
  }

  function markFileConflict(handle) {
    if (linkedFileHandle !== handle) return;
    fileConflict = true;
    ui.workspace.inert = true;
    ui.reloadFile.hidden = false;
    setFileStatus(`File changed since it was loaded — reload ${displayFileName(handle.name)} before saving`, true);
  }

  async function writeFile(handle, snapshot, { askPermission = false, force = false } = {}) {
    if (!(await hasWritePermission(handle, askPermission))) {
      if (linkedFileHandle === handle) {
        ui.workspace.inert = true;
        ui.reloadFile.hidden = false;
        setFileStatus(`Permission needed to save ${displayFileName(handle.name)} — click Reload to reconnect`, true);
      }
      return false;
    }
    if (!force) {
      const expectedText = fileBaseSignatures.get(handle);
      if (typeof expectedText !== 'string') {
        markFileConflict(handle);
        return false;
      }
      const currentText = await (await handle.getFile()).text();
      if (currentText !== expectedText) {
        markFileConflict(handle);
        return false;
      }
    }
    const writable = await handle.createWritable();
    await writable.write(snapshot.text);
    await writable.close();
    fileBaseSignatures.set(handle, snapshot.text);
    if (linkedFileHandle === handle) {
      fileConflict = false;
      if (JSON.stringify(state) === snapshot.stateSignature) fileDirty = false;
      ui.workspace.inert = false;
      ui.reloadFile.hidden = false;
      const reconnectHint = fileHandlePersisted ? '' : ' · Load it again next time';
      setFileStatus(`Saved to ${displayFileName(handle.name)} · ${formatSavedTime(snapshot.savedAt)}${reconnectHint}`);
    }
    return true;
  }

  function queueFileSave(handle, snapshot, generation = stateGeneration, force = false) {
    if (!handle || (fileConflict && !force)) return fileWriteQueue;
    if (linkedFileHandle === handle) setFileStatus(`Saving to ${displayFileName(handle.name)}…`);
    fileWriteQueue = fileWriteQueue.catch(() => {}).then(async () => {
      try {
        const didSave = await writeFile(handle, snapshot, { force });
        if (didSave && linkedFileHandle === handle && generation === stateGeneration) fileDirty = false;
      } catch (error) {
        if (linkedFileHandle === handle) {
          ui.workspace.inert = true;
          ui.reloadFile.hidden = false;
          setFileStatus(`Could not save ${displayFileName(handle.name)}: ${error.message || 'file error'}`, true);
        }
      }
    });
    return fileWriteQueue;
  }

  function suggestedFilename() {
    const now = new Date();
    const date = localDateString(now);
    const time = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    return `Weekly_Plannner_${date}_${time}.json`;
  }

  async function attachFileHandle(handle, askPermission = true, permissionGranted = null) {
    linkedFileHandle = handle;
    try {
      await storeFileHandle(handle);
    } catch (error) {
      fileHandlePersisted = false;
      setFileStatus(`Linked for this session: ${displayFileName(handle.name)} (browser could not remember it)`, true);
    }
    const canWrite = permissionGranted === true || (permissionGranted !== false && await hasWritePermission(handle, askPermission));
    ui.reloadFile.hidden = false;
    if (!canWrite) {
      ui.workspace.inert = true;
      setFileStatus(`Permission needed to save ${displayFileName(handle.name)} — click Reload to reconnect`, true);
      return false;
    }
    ui.workspace.inert = false;
    fileConflict = false;
    importedFileName = null;
    return true;
  }

  async function saveAs() {
    if (!fileRestoreComplete) return;
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: suggestedFilename(),
          types: [{ description: 'Weekly Planner JSON', accept: { 'application/json': ['.json'] } }],
        });
        if (await attachFileHandle(handle)) {
          fileDirty = true;
          const snapshot = createFileSnapshot();
          await queueFileSave(handle, snapshot, stateGeneration, true);
          if (!fileDirty) {
            ui.workspace.inert = false;
            clearLegacyPlannerCopy();
            showToast(`Planner saved as ${handle.name}.`);
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError') setFileStatus(`Save failed: ${error.message || 'file error'}`, true);
      }
      return;
    }
    downloadPlanner();
  }

  function downloadPlanner() {
    const snapshot = createFileSnapshot();
    const blob = new Blob([snapshot.text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = suggestedFilename();
    link.click();
    URL.revokeObjectURL(url);
    setFileStatus(`Downloaded ${displayFileName(link.download)} · ${formatSavedTime(snapshot.savedAt)} — download again after further edits`);
    fileDirty = false;
    showToast('Planner JSON downloaded.');
  }

  function exportRowsForTerm(term) {
    const rows = [[
      'Week', 'Date', 'Day', 'Order', 'Entry type', 'Subject', 'Notes', 'Scheduled date', 'Moved',
    ]];
    for (let weekIndex = 0; weekIndex < term.weeks; weekIndex += 1) {
      for (let dayIndex = 0; dayIndex < DAY_NAMES.length; dayIndex += 1) {
        const date = dateForWeekday(weekIndex, dayIndex, term);
        const lessons = orderedLessons(term, date, dayIndex);
        const dayNotes = term.dayNotes.filter((note) => note.date === date);
        let order = 0;
        for (let position = 0; position <= lessons.length; position += 1) {
          dayNotes.filter((note) => Math.min(note.position || 0, lessons.length) === position).forEach((note) => {
            order += 1;
            rows.push([weekIndex + 1, date, DAY_NAMES[dayIndex], order, 'Day note', '', note.text, '', '']);
          });
          if (position < lessons.length) {
            const lesson = lessons[position];
            const subject = getSubject(term, lesson.subjectId);
            order += 1;
            rows.push([
              weekIndex + 1,
              date,
              DAY_NAMES[dayIndex],
              order,
              'Lesson',
              subject ? subject.name : 'Unknown subject',
              lesson.notes || '',
              lesson.scheduledDate,
              lesson.date !== lesson.scheduledDate ? 'Yes' : 'No',
            ]);
          }
        }
      }
    }
    return rows;
  }

  function xmlEscape(value) {
    return String(value == null ? '' : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function worksheetXml(rows) {
    const columnNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    const numericColumns = new Set([0, 3]);
    const columnWidths = [8, 14, 13, 9, 14, 30, 60, 16, 10];
    const colsXml = columnWidths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('');
    const rowsXml = rows.map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row.map((value, columnIndex) => {
        const reference = `${columnNames[columnIndex]}${rowNumber}`;
        if (numericColumns.has(columnIndex) && typeof value === 'number') {
          return `<c r="${reference}" t="n"><v>${value}</v></c>`;
        }
        return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
      }).join('');
      return `<row r="${rowNumber}">${cells}</row>`;
    }).join('');
    const lastRow = Math.max(1, rows.length);
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:I${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${colsXml}</cols><sheetData>${rowsXml}</sheetData><autoFilter ref="A1:I${lastRow}"/></worksheet>`;
  }

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function zipWorkbookFiles(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;
    const fileDate = 33; // DOS date 1980-01-01; timestamps are not used by Excel for planner data.

    files.forEach((file) => {
      const nameBytes = encoder.encode(file.name);
      const dataBytes = encoder.encode(file.content);
      const checksum = crc32(dataBytes);
      const localHeader = new Uint8Array(30);
      const localView = new DataView(localHeader.buffer);
      localView.setUint32(0, 0x04034B50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0x0800, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, 0, true);
      localView.setUint16(12, fileDate, true);
      localView.setUint32(14, checksum, true);
      localView.setUint32(18, dataBytes.length, true);
      localView.setUint32(22, dataBytes.length, true);
      localView.setUint16(26, nameBytes.length, true);
      localView.setUint16(28, 0, true);
      localParts.push(localHeader, nameBytes, dataBytes);

      const centralHeader = new Uint8Array(46);
      const centralView = new DataView(centralHeader.buffer);
      centralView.setUint32(0, 0x02014B50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0x0800, true);
      centralView.setUint16(10, 0, true);
      centralView.setUint16(12, 0, true);
      centralView.setUint16(14, fileDate, true);
      centralView.setUint32(16, checksum, true);
      centralView.setUint32(20, dataBytes.length, true);
      centralView.setUint32(24, dataBytes.length, true);
      centralView.setUint16(28, nameBytes.length, true);
      centralView.setUint16(30, 0, true);
      centralView.setUint16(32, 0, true);
      centralView.setUint16(34, 0, true);
      centralView.setUint16(36, 0, true);
      centralView.setUint32(38, 0, true);
      centralView.setUint32(42, localOffset, true);
      centralParts.push(centralHeader, nameBytes);
      localOffset += localHeader.length + nameBytes.length + dataBytes.length;
    });

    const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
    const endRecord = new Uint8Array(22);
    const endView = new DataView(endRecord.buffer);
    endView.setUint32(0, 0x06054B50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, files.length, true);
    endView.setUint16(10, files.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, localOffset, true);
    endView.setUint16(20, 0, true);
    return new Blob([...localParts, ...centralParts, endRecord], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  function buildExcelWorkbook() {
    const files = [];
    const sheetOverrides = [];
    const workbookSheets = [];
    const workbookRelationships = [];
    state.terms.forEach((term, index) => {
      const sheetNumber = index + 1;
      const sheetPath = `xl/worksheets/sheet${sheetNumber}.xml`;
      files.push({ name: sheetPath, content: worksheetXml(exportRowsForTerm(term)) });
      sheetOverrides.push(`<Override PartName="/${sheetPath}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
      workbookSheets.push(`<sheet name="${xmlEscape(term.name)}" sheetId="${sheetNumber}" r:id="rId${sheetNumber}"/>`);
      workbookRelationships.push(`<Relationship Id="rId${sheetNumber}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheetNumber}.xml"/>`);
    });
    files.unshift(
      {
        name: '[Content_Types].xml',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetOverrides.join('')}</Types>`,
      },
      {
        name: '_rels/.rels',
        content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      },
      {
        name: 'xl/workbook.xml',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets.join('')}</sheets></workbook>`,
      },
      {
        name: 'xl/_rels/workbook.xml.rels',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRelationships.join('')}</Relationships>`,
      },
    );
    return zipWorkbookFiles(files);
  }

  function exportExcel() {
    if (!fileRestoreComplete) return;
    try {
      const blob = buildExcelWorkbook();
      const now = new Date();
      const date = localDateString(now);
      const time = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `Weekly_Plannner_Export_${date}_${time}.xlsx`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Excel workbook downloaded with one worksheet per term.');
    } catch (error) {
      showToast(`Excel export failed: ${error.message || 'could not create workbook'}`);
    }
  }

  async function startNewPlanner() {
    if (!fileRestoreComplete) return;
    const confirmed = window.confirm(
      'Start a new blank planner with four six-week terms? Unsaved changes will be discarded. If a file is linked, pending changes will be saved when possible and that file will then be disconnected. Use Save As first if you want a separate copy.'
    );
    if (!confirmed) return;

    const wasInert = ui.workspace.inert;
    ui.workspace.inert = true;
    window.clearTimeout(saveTimer);
    if (linkedFileHandle && fileDirty && !fileConflict) queueFileSave(linkedFileHandle, createFileSnapshot(), stateGeneration);
    await fileWriteQueue;
    if (!clearLegacyPlannerCopy()) {
      ui.workspace.inert = wasInert;
      window.alert('The older browser copy could not be removed, so New was cancelled to avoid restoring it later.');
      return;
    }
    try {
      await clearStoredFileHandle();
    } catch (error) {
      ui.workspace.inert = wasInert;
      window.alert('The linked file could not be disconnected, so New was cancelled to protect it.');
      return;
    }

    linkedFileHandle = null;
    fileHandlePersisted = false;
    fileBaseSignatures = new WeakMap();
    fileConflict = false;
    ui.reloadFile.hidden = true;
    ui.workspace.inert = false;
    state = newState();
    resetHistory();
    hasLegacyPlannerCopy = false;
    importedFileName = null;
    fileDirty = false;
    render();
    setUnlinkedStatus();
    showToast('New blank planner started. Use Save As to create its file.');
  }

  function parsePlannerFile(text) {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.terms) || parsed.terms.length !== 4) {
      throw new Error('This file does not contain a four-term planner.');
    }
    return {
      version: 1,
      activeTerm: Number.isInteger(parsed.activeTerm) && parsed.activeTerm >= 0 && parsed.activeTerm < 4 ? parsed.activeTerm : 0,
      terms: parsed.terms.map((term, index) => normalizeTerm(term, index)),
    };
  }

  function fileSavedAt(text, file) {
    try {
      const metadata = JSON.parse(text)._fileMeta;
      if (metadata && typeof metadata.updatedAt === 'string') return metadata.updatedAt;
    } catch (error) {
      // Older planner files have no save metadata.
    }
    return file && file.lastModified ? new Date(file.lastModified).toISOString() : '';
  }

  async function loadSelectedHandle(handle, permissionGranted) {
    try {
      const file = await handle.getFile();
      const rawText = await file.text();
      const loadedState = parsePlannerFile(rawText);
      const canWrite = await attachFileHandle(handle, false, permissionGranted);
      window.clearTimeout(saveTimer);
      state = loadedState;
      resetHistory();
      clearLegacyPlannerCopy();
      importedFileName = null;
      fileBaseSignatures.set(handle, rawText);
      fileConflict = false;
      fileDirty = false;
      render();
      if (canWrite) {
        ui.workspace.inert = false;
        const savedTime = formatSavedTime(fileSavedAt(rawText, file));
        setFileStatus(savedTime ? `Loaded ${displayFileName(handle.name)} · last saved ${savedTime}` : `Loaded ${displayFileName(handle.name)} · ready to save`);
        showToast(`Planner loaded from ${displayFileName(handle.name)}.`);
      } else {
        ui.workspace.inert = true;
      }
    } catch (error) {
      ui.workspace.inert = true;
      setFileStatus(`Could not read ${displayFileName(handle.name)}: ${error.message || 'invalid planner JSON'}`, true);
    }
  }

  function loadFallback() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const rawText = await file.text();
        const loadedState = parsePlannerFile(rawText);
        await clearStoredFileHandle();
        clearLegacyPlannerCopy();
        window.clearTimeout(saveTimer);
        linkedFileHandle = null;
        fileBaseSignatures = new WeakMap();
        fileConflict = false;
        fileDirty = false;
        ui.reloadFile.hidden = true;
        ui.workspace.inert = false;
        importedFileName = displayFileName(file.name);
        state = loadedState;
        resetHistory();
        render();
        setUnlinkedStatus();
        showToast(`Planner loaded from ${displayFileName(file.name)}.`);
      } catch (error) {
        setFileStatus(`Could not load file: ${error.message || 'invalid JSON'}`, true);
      }
    }, { once: true });
    input.click();
  }

  async function loadPlanner() {
    if (!fileRestoreComplete) return;
    if (fileDirty && !window.confirm('Load another planner and discard the current unsaved changes? Use Save As first if you want to keep them.')) return;
    if (typeof window.showOpenFilePicker === 'function') {
      try {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [{ description: 'Weekly Planner JSON', accept: { 'application/json': ['.json'] } }],
        });
        window.clearTimeout(saveTimer);
        let permissionGranted = false;
        try {
          // Ask for write access while Load is still the active user gesture.
          permissionGranted = await hasWritePermission(handle, true);
        } catch (error) {
          // Import the file read-only if the browser declines or defers write access.
        }
        await loadSelectedHandle(handle, permissionGranted);
      } catch (error) {
        if (error.name !== 'AbortError') setFileStatus(`Load failed: ${error.message || 'file error'}`, true);
      }
      return;
    }
    loadFallback();
  }

  async function reloadLinkedFile() {
    if (!fileRestoreComplete) return;
    const handle = linkedFileHandle;
    if (!handle) return loadPlanner();
    if (fileDirty && !window.confirm('Reload the latest file and discard unsaved changes in this page? Choose Save As first if you want to keep a copy.')) return;
    try {
      window.clearTimeout(saveTimer);
      const permissionGranted = await hasWritePermission(handle, true);
      await loadSelectedHandle(handle, permissionGranted);
    } catch (error) {
      ui.workspace.inert = true;
      setFileStatus(`Could not reconnect ${displayFileName(handle.name)}: ${error.message || 'permission needed'}`, true);
    }
  }

  async function restoreFileLink() {
    ui.workspace.inert = true;
    setFileStatus('Checking for a linked planner file…');
    try {
      const handle = await getStoredFileHandle();
      if (!handle) {
        ui.workspace.inert = false;
        ui.reloadFile.hidden = true;
        setUnlinkedStatus();
        return;
      }
      linkedFileHandle = handle;
      fileHandlePersisted = true;
      ui.reloadFile.hidden = false;
      const permissionGranted = await hasWritePermission(handle);
      if (permissionGranted) {
        await loadSelectedHandle(handle, true);
        return;
      }
      setFileStatus(`Click Reload to open the latest ${displayFileName(handle.name)} before editing`, true);
    } catch (error) {
      if (linkedFileHandle) {
        ui.workspace.inert = true;
        ui.reloadFile.hidden = false;
        setFileStatus(`Click Reload to reconnect ${displayFileName(linkedFileHandle.name)} before editing`, true);
      } else {
        ui.workspace.inert = false;
        ui.reloadFile.hidden = true;
        setUnlinkedStatus();
      }
    } finally {
      fileRestoreComplete = true;
      updateHistoryButtons();
    }
  }

  function showToast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => ui.toast.classList.remove('visible'), 2400);
  }

  function render() {
    renderTabs();
    renderToolbar();
    renderSubjectControls();
    renderGrid();
    updateHistoryButtons();
  }

  function renderTabs() {
    ui.tabs.replaceChildren();
    state.terms.forEach((term, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'term-tab';
      button.textContent = term.name;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(state.activeTerm === index));
      button.setAttribute('aria-controls', 'planner-grid');
      button.tabIndex = state.activeTerm === index ? 0 : -1;
      button.addEventListener('click', () => {
        state.activeTerm = index;
        saveState();
        render();
      });
      ui.tabs.append(button);
    });
  }

  function renderToolbar() {
    const term = activeTerm();
    ui.start.value = term.startDate;
    ui.count.textContent = `${term.weeks} ${term.weeks === 1 ? 'week' : 'weeks'}`;
    ui.removeWeek.disabled = term.weeks <= 1;
    const previousSource = ui.copyTermSource.value;
    ui.copyTermSource.replaceChildren();
    state.terms.forEach((otherTerm, index) => {
      if (index === state.activeTerm) return;
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = otherTerm.name;
      ui.copyTermSource.append(option);
    });
    if ([...ui.copyTermSource.options].some((option) => option.value === previousSource)) {
      ui.copyTermSource.value = previousSource;
    }
    ui.dateHint.textContent = 'Choose a Monday';
    ui.dateHint.classList.remove('invalid');
  }

  function copyTermSchedule() {
    const sourceIndex = Number(ui.copyTermSource.value);
    if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= state.terms.length || sourceIndex === state.activeTerm) return;
    const source = state.terms[sourceIndex];
    const target = activeTerm();
    const confirmed = window.confirm(
      `Copy ${source.name}'s recurring subjects and weekday order into ${target.name}? This replaces ${target.name}'s subjects, lessons, one-off moves, lesson notes, and weekday order. Its start date, week count, and day notes will stay as they are.`
    );
    if (!confirmed) return;

    const subjectIds = new Map(source.subjects.map((subject) => [subject.id, makeId()]));
    target.subjects = source.subjects.map((subject) => ({
      id: subjectIds.get(subject.id),
      name: subject.name,
      days: [...subject.days],
    }));
    target.dayOrders = source.dayOrders.map((dayOrder) => dayOrder.map((subjectId) => subjectIds.get(subjectId)).filter(Boolean));
    target.lessons = [];
    for (let week = 0; week < target.weeks; week += 1) {
      for (const subject of target.subjects) {
        for (const dayIndex of subject.days) {
          const scheduledDate = dateForWeekday(week, dayIndex, target);
          target.lessons.push({ id: makeId(), subjectId: subject.id, scheduledDate, date: scheduledDate });
        }
      }
    }
    saveState();
    render();
    showToast(`${source.name}'s schedule copied into ${target.name}.`);
  }

  function dayCheckbox(dayIndex, prefix, checked = false, name = 'days') {
    const label = document.createElement('label');
    label.className = 'day-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = name;
    input.value = String(dayIndex);
    input.checked = checked;
    input.setAttribute('aria-label', DAY_NAMES[dayIndex]);
    const span = document.createElement('span');
    span.textContent = DAY_SHORT[dayIndex];
    label.append(input, span);
    if (prefix) label.dataset.prefix = prefix;
    return { label, input };
  }

  function renderSubjectControls() {
    const term = activeTerm();
    ui.newDays.replaceChildren();
    DAY_NAMES.forEach((_, dayIndex) => ui.newDays.append(dayCheckbox(dayIndex, '', false).label));
    ui.subjectListTerm.textContent = term.name;
    ui.subjectTotal.textContent = `${term.subjects.length} ${term.subjects.length === 1 ? 'subject' : 'subjects'}`;
    ui.subjectList.replaceChildren();
    ui.emptySubjects.hidden = term.subjects.length > 0;

    term.subjects.forEach((subject) => {
      const editor = document.createElement('div');
      editor.className = 'subject-editor';
      const name = document.createElement('span');
      name.className = 'subject-editor-name';
      name.textContent = subject.name;
      name.title = subject.name;
      const days = document.createElement('div');
      days.className = 'editor-day-list';
      DAY_NAMES.forEach((_, dayIndex) => {
        const { label, input } = dayCheckbox(dayIndex, subject.id, subject.days.includes(dayIndex), `subject-${subject.id}-days`);
        input.addEventListener('change', () => updateSubjectDays(subject.id, dayIndex, input.checked));
        days.append(label);
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'delete-subject';
      remove.textContent = '×';
      remove.title = `Delete ${subject.name} and its lesson occurrences`;
      remove.setAttribute('aria-label', `Delete ${subject.name}`);
      remove.addEventListener('click', () => deleteSubject(subject.id));
      editor.append(name, days, remove);
      ui.subjectList.append(editor);
    });
  }

  function renderGrid() {
    const term = activeTerm();
    const today = localDateString(new Date());
    ui.gridBody.replaceChildren();

    for (let weekIndex = 0; weekIndex < term.weeks; weekIndex += 1) {
      const row = document.createElement('tr');
      const weekHeading = document.createElement('th');
      weekHeading.className = 'week-number';
      weekHeading.scope = 'row';
      weekHeading.textContent = String(weekIndex + 1);
      row.append(weekHeading);

      DAY_NAMES.forEach((dayName, dayIndex) => {
        const date = dateForWeekday(weekIndex, dayIndex, term);
        const cell = document.createElement('td');
        cell.dataset.date = date;
        cell.addEventListener('dragover', onDragOver);
        cell.addEventListener('dragleave', onDragLeave);
        cell.addEventListener('drop', onDrop);
        if (date < today) cell.classList.add('past-day');
        if (date === today) cell.classList.add('today');

        const cellInner = document.createElement('div');
        cellInner.className = 'day-cell';
        const heading = document.createElement('div');
        heading.className = 'day-heading';
        const dayLabel = document.createElement('span');
        dayLabel.className = 'sr-only';
        dayLabel.textContent = dayName;
        const dateLabel = document.createElement('span');
        dateLabel.className = `day-date${date === today ? ' today-date' : ''}`;
        dateLabel.textContent = formatShortDate(date);
        dateLabel.title = `${dayName}, ${parseLocalDate(date).toLocaleDateString()}`;
        const noteButton = document.createElement('button');
        noteButton.type = 'button';
        const dayNotes = term.dayNotes.filter((note) => note.date === date);
        noteButton.className = `day-note-add${dayNotes.length ? ' has-note' : ''}`;
        noteButton.textContent = '+';
        noteButton.title = `Add day note for ${dayName}, ${formatShortDate(date)}`;
        noteButton.setAttribute('aria-label', `Add day note for ${dayName}, ${formatShortDate(date)}`);
        noteButton.addEventListener('click', () => openDayNote(date));
        heading.append(dayLabel, dateLabel, noteButton);

        cellInner.append(heading);
        const list = document.createElement('div');
        list.className = 'lesson-list';
        list.dataset.date = date;
        const lessons = orderedLessons(term, date, dayIndex);
        if (lessons.length === 0 && dayNotes.length === 0) {
          const empty = document.createElement('span');
          empty.className = 'empty-day';
          empty.textContent = 'Drop lesson here';
          list.append(empty);
        } else {
          for (let position = 0; position <= lessons.length; position += 1) {
            dayNotes.filter((note) => Math.min(note.position || 0, lessons.length) === position)
              .forEach((note) => list.append(createDayNoteCard(note, dayName)));
            if (position < lessons.length) list.append(createLessonCard(lessons[position], term));
          }
        }
        cellInner.append(list);
        cell.append(cellInner);
        row.append(cell);
      });
      ui.gridBody.append(row);
    }
  }

  function orderedLessons(term, date, dayIndex) {
    const order = term.dayOrders[dayIndex] || [];
    return term.lessons.filter((lesson) => lesson.date === date).sort((a, b) => {
      const aRank = order.indexOf(a.subjectId);
      const bRank = order.indexOf(b.subjectId);
      if (aRank !== bRank) return (aRank < 0 ? Number.MAX_SAFE_INTEGER : aRank) - (bRank < 0 ? Number.MAX_SAFE_INTEGER : bRank);
      const sa = getSubject(term, a.subjectId)?.name || '';
      const sb = getSubject(term, b.subjectId)?.name || '';
      return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  function createDayNoteCard(note, dayName) {
    const card = document.createElement('div');
    card.className = 'day-note-preview';
    card.classList.toggle('completed', note.completed === true);
    card.draggable = true;
    card.dataset.dayNoteId = note.id;
    const text = document.createElement('button');
    text.type = 'button';
    text.className = 'day-note-text';
    text.textContent = note.text;
    text.title = 'Select to edit; drag the note to move it';
    text.setAttribute('aria-label', `Edit day note for ${dayName}, ${formatShortDate(note.date)}`);
    text.addEventListener('click', () => {
      if (Date.now() < suppressCardClickUntil) return;
      openDayNote(note.date, note.id);
    });
    const completion = makeCompletionCheckbox(note.completed, `day note for ${dayName}, ${formatShortDate(note.date)}`);
    completion.addEventListener('change', () => {
      note.completed = completion.checked;
      card.classList.toggle('completed', note.completed);
      saveState();
      showToast(note.completed ? 'Day note marked complete.' : 'Day note marked incomplete.');
    });
    card.append(text, completion);
    card.addEventListener('dragstart', (event) => {
      draggedDayNoteId = note.id;
      suppressCardClickUntil = Date.now() + 500;
      card.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-planner-day-note', note.id);
    });
    card.addEventListener('dragend', () => {
      draggedDayNoteId = null;
      card.classList.remove('dragging');
      $$('.drop-target', ui.gridBody).forEach((cell) => cell.classList.remove('drop-target'));
    });
    return card;
  }

  function makeCompletionCheckbox(completed, description) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'note-completion-toggle';
    checkbox.checked = completed === true;
    const updateLabel = () => {
      checkbox.title = checkbox.checked ? 'Mark as incomplete' : 'Mark as complete';
      checkbox.setAttribute('aria-label', `Mark ${description} ${checkbox.checked ? 'incomplete' : 'complete'}`);
    };
    updateLabel();
    checkbox.addEventListener('click', (event) => event.stopPropagation());
    checkbox.addEventListener('pointerdown', (event) => event.stopPropagation());
    checkbox.addEventListener('dragstart', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    checkbox.addEventListener('change', updateLabel);
    return checkbox;
  }

  function createLessonCard(lesson, term) {
    const subject = getSubject(term, lesson.subjectId);
    const card = document.createElement('div');
    card.className = 'lesson-card';
    card.draggable = true;
    card.dataset.lessonId = lesson.id;
    card.style.setProperty('--lesson-color', lessonColor(term, lesson.subjectId));
    const name = document.createElement('span');
    name.className = 'lesson-name';
    name.textContent = subject ? subject.name : 'Unknown subject';
    card.append(name);
    if (lesson.notes) {
      const note = document.createElement('span');
      note.className = 'lesson-note-preview';
      note.textContent = lesson.notes;
      card.append(note);
      card.classList.add('has-notes');
    }
    const scheduledDayIndex = (parseLocalDate(lesson.scheduledDate).getDay() + 6) % 7;
    const isScheduled = subject && subject.days.includes(scheduledDayIndex);
    if (!isScheduled) card.classList.add('exception');
    if (lesson.date !== lesson.scheduledDate) card.classList.add('moved');
    card.title = `${subject ? subject.name : 'Lesson'} — select to edit notes; drag to move or reorder`;
    card.setAttribute('aria-label', `${subject ? subject.name : 'Lesson'}, scheduled ${formatShortDate(lesson.scheduledDate)}${lesson.date !== lesson.scheduledDate ? `, moved to ${formatShortDate(lesson.date)}` : ''}`);
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    card.addEventListener('click', () => {
      if (Date.now() < suppressCardClickUntil) return;
      openLessonNotes(lesson.id);
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openLessonNotes(lesson.id);
      }
    });
    card.addEventListener('dragstart', (event) => {
      draggedLessonId = lesson.id;
      suppressCardClickUntil = Date.now() + 500;
      card.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', lesson.id);
    });
    card.addEventListener('dragend', () => {
      draggedLessonId = null;
      card.classList.remove('dragging');
      $$('.drop-target', ui.gridBody).forEach((cell) => cell.classList.remove('drop-target'));
    });
    return card;
  }

  function onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    event.currentTarget.closest('td').classList.add('drop-target');
  }

  function onDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.closest('td').classList.remove('drop-target');
  }

  function onDrop(event) {
    event.preventDefault();
    const targetCell = event.currentTarget.closest('td');
    const targetDate = targetCell.dataset.date;
    const dayNoteId = event.dataTransfer.getData('application/x-planner-day-note') || draggedDayNoteId;
    if (dayNoteId) {
      const lessonCards = $$('.lesson-card', targetCell);
      const position = lessonCards.filter((card) => event.clientY > card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2).length;
      moveDayNote(dayNoteId, targetDate, position);
      draggedDayNoteId = null;
      targetCell.classList.remove('drop-target');
      return;
    }
    const lessonId = event.dataTransfer.getData('text/plain') || draggedLessonId;
    let targetCard = event.target.closest('.lesson-card');
    let afterTarget = targetCard ? event.clientY > targetCard.getBoundingClientRect().top + targetCard.getBoundingClientRect().height / 2 : false;
    if (!targetCard) {
      const candidates = $$('.lesson-card', targetCell).filter((card) => card.dataset.lessonId !== lessonId);
      if (candidates.length > 0) {
        targetCard = candidates.find((card) => event.clientY < card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2) || candidates[candidates.length - 1];
        afterTarget = event.clientY > targetCard.getBoundingClientRect().top + targetCard.getBoundingClientRect().height / 2;
      }
    }
    const targetLessonId = targetCard ? targetCard.dataset.lessonId : null;
    targetCell.classList.remove('drop-target');
    const term = activeTerm();
    const lesson = term.lessons.find((item) => item.id === lessonId);
    if (!lesson) return;

    const subject = getSubject(term, lesson.subjectId);
    const sourceWeekday = (parseLocalDate(lesson.scheduledDate).getDay() + 6) % 7;
    const targetWeekday = (parseLocalDate(targetDate).getDay() + 6) % 7;
    if (lesson.date === lesson.scheduledDate && sourceWeekday === targetWeekday && subject && subject.days.includes(sourceWeekday)) {
      const targetSubjectId = targetLessonId && targetLessonId !== lessonId ? term.lessons.find((item) => item.id === targetLessonId)?.subjectId : null;
      if (targetSubjectId === lesson.subjectId) return;
      reorderWeekday(term, sourceWeekday, lesson.subjectId, targetSubjectId, afterTarget);
      saveState();
      renderGrid();
      showToast(`${DAY_NAMES[sourceWeekday]} lesson sequence updated across ${term.name}.`);
      return;
    }
    if (lesson.date === targetDate) return;
    lesson.date = targetDate;
    saveState();
    renderGrid();
    showToast('Lesson occurrence moved. Other weeks are unchanged.');
  }

  function reorderWeekday(term, dayIndex, movedSubjectId, targetSubjectId, afterTarget) {
    const order = term.dayOrders[dayIndex] || (term.dayOrders[dayIndex] = []);
    if (!order.includes(movedSubjectId)) order.push(movedSubjectId);
    if (targetSubjectId && !order.includes(targetSubjectId)) order.push(targetSubjectId);
    const next = order.filter((id) => id !== movedSubjectId);
    if (!targetSubjectId) {
      next.push(movedSubjectId);
    } else {
      const targetIndex = next.indexOf(targetSubjectId);
      next.splice(targetIndex + (afterTarget ? 1 : 0), 0, movedSubjectId);
    }
    term.dayOrders[dayIndex] = next;
  }

  function openLessonNotes(lessonId) {
    const term = activeTerm();
    const lesson = term.lessons.find((item) => item.id === lessonId);
    if (!lesson) return;
    const subject = getSubject(term, lesson.subjectId);
    editingLessonId = lessonId;
    editingDayNote = null;
    ui.noteDialogEyebrow.textContent = 'LESSON NOTES';
    ui.noteDialogTitle.textContent = subject ? subject.name : 'Lesson';
    ui.noteDialogDate.textContent = `${term.name} · ${formatShortDate(lesson.date)}`;
    ui.noteDialogLabel.textContent = 'Notes for this occurrence';
    ui.noteText.value = lesson.notes || '';
    ui.saveNoteButton.textContent = 'Save notes';
    ui.noteDialog.showModal();
    ui.noteText.focus();
  }

  function openDayNote(date, noteId = null) {
    const term = activeTerm();
    const note = noteId ? term.dayNotes.find((item) => item.id === noteId) : null;
    editingLessonId = null;
    editingDayNote = { id: note ? note.id : null, date };
    ui.noteDialogEyebrow.textContent = 'DAY NOTE';
    ui.noteDialogTitle.textContent = 'Day note';
    ui.noteDialogDate.textContent = `${term.name} · ${formatShortDate(date)}`;
    ui.noteDialogLabel.textContent = 'Notes for this day';
    ui.noteText.value = note ? note.text : '';
    ui.saveNoteButton.textContent = 'Save day note';
    ui.noteDialog.showModal();
    ui.noteText.focus();
  }

  function moveDayNote(noteId, date, position) {
    const note = activeTerm().dayNotes.find((item) => item.id === noteId);
    if (!note) return;
    const sameDate = note.date === date;
    const nextPosition = Math.max(0, position);
    if (sameDate && (note.position || 0) === nextPosition) return;
    note.date = date;
    note.position = nextPosition;
    saveState();
    renderGrid();
    showToast(sameDate ? 'Day note position updated.' : `Day note moved to ${formatShortDate(date)}.`);
  }

  function closeNotes() {
    editingLessonId = null;
    editingDayNote = null;
    if (ui.noteDialog.open) ui.noteDialog.close();
  }

  function saveNotes(event) {
    event.preventDefault();
    const term = activeTerm();
    const text = ui.noteText.value.trim();
    if (editingLessonId) {
      const lesson = term.lessons.find((item) => item.id === editingLessonId);
      if (lesson) lesson.notes = text;
    } else if (editingDayNote) {
      if (editingDayNote.id) {
        const note = term.dayNotes.find((item) => item.id === editingDayNote.id);
        if (text && note) note.text = text;
        else if (!text) term.dayNotes = term.dayNotes.filter((item) => item.id !== editingDayNote.id);
      } else if (text) {
        term.dayNotes.push({ id: makeId(), date: editingDayNote.date, text, position: 0 });
      }
    } else {
      return closeNotes();
    }
    saveState();
    const wasDayNote = Boolean(editingDayNote);
    closeNotes();
    renderGrid();
    showToast(wasDayNote ? 'Day note saved.' : 'Lesson notes saved.');
  }

  function updateSubjectDays(subjectId, dayIndex, checked) {
    const term = activeTerm();
    const subject = getSubject(term, subjectId);
    if (!subject) return;
    const next = new Set(subject.days);
    if (checked) next.add(dayIndex);
    else next.delete(dayIndex);
    subject.days = [...next].sort((a, b) => a - b);
    syncScheduledLessons(term, subject);
    saveState();
    render();
    showToast('Subject schedule updated for this term.');
  }

  function deleteSubject(subjectId) {
    const term = activeTerm();
    const subject = getSubject(term, subjectId);
    if (!subject) return;
    const shouldDelete = window.confirm(`Delete “${subject.name}” and all of its lesson occurrences from ${term.name}?`);
    if (!shouldDelete) return;
    term.subjects = term.subjects.filter((item) => item.id !== subjectId);
    term.lessons = term.lessons.filter((lesson) => lesson.subjectId !== subjectId);
    saveState();
    render();
    showToast('Subject and its lessons deleted.');
  }

  function addSubject(event) {
    event.preventDefault();
    const name = ui.subjectName.value.trim();
    const days = $$('input[name="days"]:checked', ui.newDays).map((input) => Number(input.value));
    if (!name) {
      ui.subjectName.focus();
      return;
    }
    if (days.length === 0) {
      showToast('Choose at least one teaching day.');
      return;
    }
    const term = activeTerm();
    const subject = { id: makeId(), name, days: days.sort((a, b) => a - b) };
    term.subjects.push(subject);
    syncScheduledLessons(term, subject);
    ui.subjectForm.reset();
    saveState();
    render();
    ui.subjectPanel.open = true;
    showToast(`${name} added to ${term.name}.`);
  }

  function shiftDate(dateString, delta) {
    return addDays(dateString, delta);
  }

  function changeStartDate(event) {
    const nextDate = event.target.value;
    if (!nextDate) return;
    const parsed = parseLocalDate(nextDate);
    if (parsed.getDay() !== 1) {
      ui.dateHint.textContent = 'Please choose a Monday';
      ui.dateHint.classList.add('invalid');
      event.target.value = activeTerm().startDate;
      return;
    }
    const term = activeTerm();
    const oldMonday = parseLocalDate(term.startDate);
    const newMonday = parsed;
    const difference = Math.round((newMonday - oldMonday) / 86400000);
    if (difference !== 0) {
      term.startDate = nextDate;
      term.lessons.forEach((lesson) => {
        lesson.scheduledDate = shiftDate(lesson.scheduledDate, difference);
        lesson.date = shiftDate(lesson.date, difference);
      });
      term.dayNotes.forEach((note) => {
        note.date = shiftDate(note.date, difference);
      });
      saveState();
      renderGrid();
      showToast(`${term.name} dates updated.`);
    }
    ui.dateHint.textContent = 'Choose a Monday';
    ui.dateHint.classList.remove('invalid');
  }

  function addWeek() {
    const term = activeTerm();
    const newWeekIndex = term.weeks;
    term.weeks += 1;
    for (const subject of term.subjects) {
      for (const dayIndex of subject.days) {
        const scheduledDate = dateForWeekday(newWeekIndex, dayIndex, term);
        term.lessons.push({ id: makeId(), subjectId: subject.id, scheduledDate, date: scheduledDate });
      }
    }
    saveState();
    render();
    showToast(`Week ${term.weeks} added to ${term.name}.`);
    requestAnimationFrame(() => ui.gridBody.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
  }

  function removeWeek() {
    const term = activeTerm();
    if (term.weeks <= 1) return;
    const removedStart = dateForWeekday(term.weeks - 1, 0, term);
    const removedEnd = dateForWeekday(term.weeks - 1, 4, term);
    term.weeks -= 1;
    const removedDates = new Set(DAY_NAMES.map((_, dayIndex) => dateForWeekday(term.weeks, dayIndex, term)));
    term.dayNotes = term.dayNotes.filter((note) => !removedDates.has(note.date));
    term.lessons = term.lessons.flatMap((lesson) => {
      const scheduledInRemovedWeek = lesson.scheduledDate >= removedStart && lesson.scheduledDate <= removedEnd;
      const currentlyInRemovedWeek = lesson.date >= removedStart && lesson.date <= removedEnd;
      if (scheduledInRemovedWeek) return [];
      if (currentlyInRemovedWeek) return [{ ...lesson, date: lesson.scheduledDate }];
      return [lesson];
    });
    saveState();
    render();
    showToast(`Last week removed from ${term.name}.`);
  }

  ui.subjectForm.addEventListener('submit', addSubject);
  ui.newPlanner.addEventListener('click', startNewPlanner);
  ui.saveAs.addEventListener('click', saveAs);
  ui.load.addEventListener('click', loadPlanner);
  ui.exportExcel.addEventListener('click', exportExcel);
  ui.reloadFile.addEventListener('click', reloadLinkedFile);
  ui.start.addEventListener('change', changeStartDate);
  ui.addWeek.addEventListener('click', addWeek);
  ui.removeWeek.addEventListener('click', removeWeek);
  ui.undo.addEventListener('click', undoChange);
  ui.redo.addEventListener('click', redoChange);
  ui.copyTerm.addEventListener('click', copyTermSchedule);
  ui.noteForm.addEventListener('submit', saveNotes);
  ui.cancelNote.addEventListener('click', closeNotes);
  ui.closeNoteDialog.addEventListener('click', closeNotes);
  ui.noteDialog.addEventListener('click', (event) => {
    if (event.target === ui.noteDialog) closeNotes();
  });
  window.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || ui.noteDialog.open) return;
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && event.shiftKey) {
      event.preventDefault();
      redoChange();
    } else if (key === 'y' && !event.shiftKey) {
      event.preventDefault();
      redoChange();
    } else if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      undoChange();
    }
  });
  window.addEventListener('beforeunload', (event) => {
    if (!fileDirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
  render();
  restoreFileLink();
})();
