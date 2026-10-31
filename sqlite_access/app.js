const DATABASE_NAME = 'sqlite-studio-browser';
const DATABASE_STORE = 'databases';
const DATABASE_KEY = 'school-demo-default-v1';
const SQLJS_VERSION = '1.14.2';
const SAVED_QUERIES_TABLE = '__APP_SAVED_QUERIES_DO_NOT_EDIT';
const SAVED_REPORTS_TABLE = '__APP_SAVED_REPORTS_DO_NOT_EDIT';
const SAVED_REPORT_DESIGNS_TABLE = '__APP_SAVED_REPORT_DESIGNS_DO_NOT_EDIT';
const QUERY_DRAFT_KEY = 'sql_editor_draft';
const DATABASE_FILENAME_KEY = 'database_filename';
const RELATIONSHIP_LAYOUT_KEY = 'relationship_layout';

let db;
let SQLModule;
let currentFileHandle = null;
let currentFileName = 'sqlite-studio.sqlite';
let saveQueue = Promise.resolve();
let importState = null;
let activeTable = null;
let designerEditingTable = null;
let gridState = null;
let drawingGrid = false;
let datasheetFilters = new Map();
let datasheetFilterTable = null;
let openDatasheetFilterField = null;
let datasheetFilterDraft = null;
let openDatasheetFilterMenu = null;
let queryDraftTimer = null;
let sqlSuggestionItems = [];
let sqlSuggestionIndex = 0;
let sqlSuggestionRange = null;
let suppressSqlSuggestionRefresh = false;
let selectedRelationship = null;
let relationshipPositions = {};
let queryDesignTables = [];
let queryDesignFields = [];
let queryDesignPositions = {};
let queryDesignTotalsMode = false;
let lastQueryResultSet = null;
let lastQuerySqlText = '';
let reportDesignSourceMode = 'related';
let reportDesignLevels = [];
let reportDesignControls = [];
let reportDesignSections = { 'report-header': true, 'page-header': false, 'report-footer': true, 'page-footer': false };
let reportDesignPendingDefinition = null;
let reportDesignPreviewReady = false;
let reportDesignViewMode = 'design';
let reportDesignNextId = 1;

const SQL_KEYWORDS = `ABORT ACTION ADD AFTER ALL ALTER ANALYZE AND AS ASC ATTACH AUTOINCREMENT BEFORE BEGIN BETWEEN BY CASCADE CASE CAST CHECK COLLATE COLUMN COMMIT CONFLICT CONSTRAINT CREATE CROSS CURRENT_DATE CURRENT_TIME CURRENT_TIMESTAMP DATABASE DEFAULT DEFERRABLE DEFERRED DELETE DESC DETACH DISTINCT DROP EACH ELSE END ESCAPE EXCEPT EXCLUSIVE EXISTS EXPLAIN FAIL FILTER FIRST FOLLOWING FOR FOREIGN FROM FULL GLOB GROUP GROUPS HAVING IF IGNORE IMMEDIATE IN INDEX INDEXED INITIALLY INNER INSERT INSTEAD INTERSECT INTO IS ISNULL JOIN KEY LAST LEFT LIKE LIMIT MATCH MATERIALIZED NATURAL NO NOT NOTHING NOTNULL NULL NULLS OF OFFSET ON OR ORDER OTHERS OUTER OVER PARTITION PLAN PRAGMA PRECEDING PRIMARY QUERY RAISE RANGE RECURSIVE REFERENCES REGEXP REINDEX RELEASE RENAME REPLACE RESTRICT RIGHT ROLLBACK ROW ROWS SAVEPOINT SELECT SET TABLE TEMP TEMPORARY THEN TIES TO TRANSACTION TRIGGER UNBOUNDED UNION UNIQUE UPDATE USING VACUUM VALUES VIEW VIRTUAL WHEN WHERE WINDOW WITH WITHOUT`.split(' ');
const SQL_FUNCTIONS = `ABS AVG CHANGES CHAR COALESCE COUNT DATE DATETIME DENSE_RANK FIRST_VALUE GROUP_CONCAT IFNULL INSTR JULIANDAY LAG LAST_VALUE LEAD LENGTH LIKE LOWER LTRIM MAX MIN NULLIF NTILE PRINTF QUOTE RANK REPLACE ROUND ROW_NUMBER RTRIM SIGN STRFTIME SUBSTR SUM TIME TOTAL TRIM TYPEOF UNICODE UNHEX UPPER ZEROBLOB`.split(' ');

const elements = {
  status: document.querySelector('#save-status'),
  statusLabel: document.querySelector('#save-label'),
  sqlInput: document.querySelector('#sql-input'),
  runButton: document.querySelector('#run-query'),
  results: document.querySelector('#results-content'),
  resultCount: document.querySelector('#result-count'),
  resultTime: document.querySelector('#result-time'),
  tableList: document.querySelector('#table-list'),
  engineVersion: document.querySelector('#engine-version'),
  dataGrid: document.querySelector('#data-grid-container'),
  dataRowCount: document.querySelector('#data-row-count'),
  dataFeedback: document.querySelector('#data-feedback'),
};

function setSaveStatus(state, label) {
  elements.status.dataset.state = state;
  elements.statusLabel.textContent = label;
}

function openStorage() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DATABASE_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open browser storage.'));
  });
}

function readSavedDatabase(storage) {
  return new Promise((resolve, reject) => {
    const transaction = storage.transaction(DATABASE_STORE, 'readonly');
    const request = transaction.objectStore(DATABASE_STORE).get(DATABASE_KEY);
    request.onsuccess = () => resolve(request.result ? new Uint8Array(request.result) : null);
    request.onerror = () => reject(request.error || new Error('Could not read the saved database.'));
  });
}

function readStoredValue(storage, key) {
  return new Promise((resolve, reject) => {
    const transaction = storage.transaction(DATABASE_STORE, 'readonly');
    const request = transaction.objectStore(DATABASE_STORE).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error || new Error('Could not read browser application state.'));
  });
}

function writeStoredValue(storage, key, value) {
  return new Promise((resolve, reject) => {
    const transaction = storage.transaction(DATABASE_STORE, 'readwrite');
    transaction.objectStore(DATABASE_STORE).put(value, key);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Could not save browser application state.'));
    transaction.onabort = () => reject(transaction.error || new Error('The browser application state save was interrupted.'));
  });
}

function removeLegacyInternalTables(database) {
  const internalTables = database.exec(`SELECT name FROM sqlite_master WHERE type = 'table';`)[0]?.values.map(([name]) => name) || [];
  for (const tableName of internalTables) {
    if (tableName.toLowerCase().startsWith('__app_') && ![SAVED_QUERIES_TABLE, SAVED_REPORTS_TABLE, SAVED_REPORT_DESIGNS_TABLE].includes(tableName.toUpperCase())) {
      database.run(`DROP TABLE ${quoteIdentifier(tableName)};`);
    }
  }
}

function ensureSavedQueriesTable(database) {
  const existingName = database.exec(`SELECT name FROM sqlite_master WHERE type = 'table' AND upper(name) = '${SAVED_QUERIES_TABLE}' LIMIT 1;`)[0]?.values[0]?.[0];
  if (existingName) {
    const existingColumns = database.exec(`PRAGMA table_info(${quoteIdentifier(existingName)});`)[0]?.values.map((column) => column[1]) || [];
    if (!['query_name', 'sql_text', 'created_at', 'updated_at'].every((column) => existingColumns.includes(column))) {
      throw new Error(`This database already contains “${existingName}” with a different structure. Rename that table before using saved queries.`);
    }
    return;
  }
  database.run(`CREATE TABLE IF NOT EXISTS ${quoteIdentifier(SAVED_QUERIES_TABLE)} (
    query_id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_name TEXT NOT NULL UNIQUE,
    sql_text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);
}

function ensureSavedReportDesignsTable(database) {
  const existingName = database.exec(`SELECT name FROM sqlite_master WHERE type = 'table' AND upper(name) = '${SAVED_REPORT_DESIGNS_TABLE}' LIMIT 1;`)[0]?.values[0]?.[0];
  if (existingName) {
    const existingColumns = database.exec(`PRAGMA table_info(${quoteIdentifier(existingName)});`)[0]?.values.map((column) => column[1]) || [];
    if (!['design_id', 'design_name', 'design_json', 'created_at', 'updated_at'].every((column) => existingColumns.includes(column))) {
      throw new Error(`This database already contains “${existingName}” with a different structure. Rename that table before using saved report designs.`);
    }
    return;
  }
  database.run(`CREATE TABLE IF NOT EXISTS ${quoteIdentifier(SAVED_REPORT_DESIGNS_TABLE)} (
    design_id INTEGER PRIMARY KEY AUTOINCREMENT,
    design_name TEXT NOT NULL UNIQUE,
    design_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);
}

async function loadDefaultDatabase(SQL) {
  try {
    const response = await fetch('./school-demo.sqlite');
    if (!response.ok) throw new Error(`Could not load school-demo.sqlite (${response.status}).`);
    return new SQL.Database(new Uint8Array(await response.arrayBuffer()));
  } catch (error) {
    console.warn('Could not fetch school-demo.sqlite; using the built-in school sample for this local-file launch.', error);
    const database = new SQL.Database();
    database.run(`BEGIN TRANSACTION;
CREATE TABLE __APP_SAVED_QUERIES_DO_NOT_EDIT (
  query_id INTEGER PRIMARY KEY AUTOINCREMENT,
  query_name TEXT NOT NULL UNIQUE,
  sql_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE __APP_SAVED_REPORT_DESIGNS_DO_NOT_EDIT (
  design_id INTEGER PRIMARY KEY AUTOINCREMENT,
  design_name TEXT NOT NULL UNIQUE,
  design_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE enrollments (
  enrollment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  enrolled_on TEXT NOT NULL DEFAULT CURRENT_DATE,
  grade TEXT,
  UNIQUE (student_id, subject_id)
);
INSERT INTO "enrollments" VALUES(1,1,1,'2026-02-02','A');
INSERT INTO "enrollments" VALUES(2,1,2,'2026-02-02','B+');
INSERT INTO "enrollments" VALUES(3,2,1,'2026-02-02','A-');
INSERT INTO "enrollments" VALUES(4,2,2,'2026-02-02','B');
INSERT INTO "enrollments" VALUES(5,3,3,'2026-02-03','A');
INSERT INTO "enrollments" VALUES(6,4,4,'2026-02-03',NULL);
INSERT INTO "enrollments" VALUES(7,5,1,'2026-02-03','B+');
INSERT INTO "enrollments" VALUES(8,5,4,'2026-02-03','A');
INSERT INTO "enrollments" VALUES(9,1,3,'2026-02-08','C');
INSERT INTO "enrollments" VALUES(10,2,3,'2026-02-11','B+');
INSERT INTO "enrollments" VALUES(11,2,4,'2026-02-12','B');
INSERT INTO "enrollments" VALUES(12,3,4,'2026-02-15','C');
INSERT INTO "enrollments" VALUES(13,3,5,'2026-02-16','A');
INSERT INTO "enrollments" VALUES(14,4,5,'2026-02-19','B');
INSERT INTO "enrollments" VALUES(15,4,6,'2026-02-20','B-');
INSERT INTO "enrollments" VALUES(16,5,5,'2026-02-22','C');
INSERT INTO "enrollments" VALUES(17,5,6,'2026-02-23','A');
INSERT INTO "enrollments" VALUES(18,5,7,'2026-02-24','A-');
INSERT INTO "enrollments" VALUES(19,6,6,'2026-02-26','B');
INSERT INTO "enrollments" VALUES(20,6,7,'2026-02-27','B-');
INSERT INTO "enrollments" VALUES(21,6,8,'2026-02-28','C+');
INSERT INTO "enrollments" VALUES(22,7,7,'2026-02-03','A');
INSERT INTO "enrollments" VALUES(23,7,8,'2026-02-04','A-');
INSERT INTO "enrollments" VALUES(24,7,1,'2026-02-24','A-');
INSERT INTO "enrollments" VALUES(25,8,8,'2026-02-07','B-');
INSERT INTO "enrollments" VALUES(26,8,1,'2026-02-27','B-');
INSERT INTO "enrollments" VALUES(27,8,2,'2026-02-28','C+');
INSERT INTO "enrollments" VALUES(28,9,1,'2026-02-03','A');
INSERT INTO "enrollments" VALUES(29,9,2,'2026-02-04','A-');
INSERT INTO "enrollments" VALUES(30,9,3,'2026-02-05','B+');
INSERT INTO "enrollments" VALUES(31,10,2,'2026-02-07','B-');
INSERT INTO "enrollments" VALUES(32,10,3,'2026-02-08','C+');
INSERT INTO "enrollments" VALUES(33,10,4,'2026-02-09','C');
INSERT INTO "enrollments" VALUES(34,11,3,'2026-02-11','A-');
INSERT INTO "enrollments" VALUES(35,11,4,'2026-02-12','B+');
INSERT INTO "enrollments" VALUES(36,11,5,'2026-02-13','B');
INSERT INTO "enrollments" VALUES(37,12,4,'2026-02-15','C+');
INSERT INTO "enrollments" VALUES(38,12,5,'2026-02-16','C');
INSERT INTO "enrollments" VALUES(39,12,6,'2026-02-17','A');
INSERT INTO "enrollments" VALUES(40,13,5,'2026-02-19','B+');
INSERT INTO "enrollments" VALUES(41,13,6,'2026-02-20','B');
INSERT INTO "enrollments" VALUES(42,13,7,'2026-02-21','B-');
INSERT INTO "enrollments" VALUES(43,14,6,'2026-02-23','C');
INSERT INTO "enrollments" VALUES(44,14,7,'2026-02-24','A');
INSERT INTO "enrollments" VALUES(45,14,8,'2026-02-25','A-');
INSERT INTO "enrollments" VALUES(46,15,7,'2026-02-27','B');
INSERT INTO "enrollments" VALUES(47,15,8,'2026-02-28','B-');
INSERT INTO "enrollments" VALUES(48,15,1,'2026-02-21','B-');
INSERT INTO "enrollments" VALUES(49,16,8,'2026-02-04','A');
INSERT INTO "enrollments" VALUES(50,16,1,'2026-02-24','A');
INSERT INTO "enrollments" VALUES(51,16,2,'2026-02-25','A-');
INSERT INTO "enrollments" VALUES(52,17,1,'2026-02-27','B');
INSERT INTO "enrollments" VALUES(53,17,2,'2026-02-28','B-');
INSERT INTO "enrollments" VALUES(54,17,3,'2026-02-02','C+');
INSERT INTO "enrollments" VALUES(55,18,2,'2026-02-04','A');
INSERT INTO "enrollments" VALUES(56,18,3,'2026-02-05','A-');
INSERT INTO "enrollments" VALUES(57,18,4,'2026-02-06','B+');
INSERT INTO "enrollments" VALUES(58,19,3,'2026-02-08','B-');
INSERT INTO "enrollments" VALUES(59,19,4,'2026-02-09','C+');
INSERT INTO "enrollments" VALUES(60,19,5,'2026-02-10','C');
INSERT INTO "enrollments" VALUES(61,20,4,'2026-02-12','A-');
INSERT INTO "enrollments" VALUES(62,20,5,'2026-02-13','B+');
INSERT INTO "enrollments" VALUES(63,20,6,'2026-02-14','B');
INSERT INTO "enrollments" VALUES(64,21,5,'2026-02-16','C+');
INSERT INTO "enrollments" VALUES(65,21,6,'2026-02-17','C');
INSERT INTO "enrollments" VALUES(66,21,7,'2026-02-18','A');
INSERT INTO "enrollments" VALUES(67,22,6,'2026-02-20','B+');
INSERT INTO "enrollments" VALUES(68,22,7,'2026-02-21','B');
INSERT INTO "enrollments" VALUES(69,22,8,'2026-02-22','B-');
INSERT INTO "enrollments" VALUES(70,23,7,'2026-02-24','C');
INSERT INTO "enrollments" VALUES(71,23,8,'2026-02-25','A');
INSERT INTO "enrollments" VALUES(72,23,1,'2026-02-18','A');
INSERT INTO "enrollments" VALUES(73,24,8,'2026-02-28','B');
INSERT INTO "enrollments" VALUES(74,24,1,'2026-02-21','B');
INSERT INTO "enrollments" VALUES(75,24,2,'2026-02-22','B-');
INSERT INTO "enrollments" VALUES(76,25,1,'2026-02-24','C');
INSERT INTO "enrollments" VALUES(77,25,2,'2026-02-25','A');
INSERT INTO "enrollments" VALUES(78,25,3,'2026-02-26','A-');
INSERT INTO "enrollments" VALUES(79,26,2,'2026-02-28','B');
INSERT INTO "enrollments" VALUES(80,26,3,'2026-02-02','B-');
INSERT INTO "enrollments" VALUES(81,26,4,'2026-02-03','C+');
INSERT INTO "enrollments" VALUES(82,27,3,'2026-02-05','A');
INSERT INTO "enrollments" VALUES(83,27,4,'2026-02-06','A-');
INSERT INTO "enrollments" VALUES(84,27,5,'2026-02-07','B+');
INSERT INTO "enrollments" VALUES(85,28,4,'2026-02-09','B-');
INSERT INTO "enrollments" VALUES(86,28,5,'2026-02-10','C+');
INSERT INTO "enrollments" VALUES(87,28,6,'2026-02-11','C');
INSERT INTO "enrollments" VALUES(88,29,5,'2026-02-13','A-');
INSERT INTO "enrollments" VALUES(89,29,6,'2026-02-14','B+');
INSERT INTO "enrollments" VALUES(90,29,7,'2026-02-15','B');
INSERT INTO "enrollments" VALUES(91,30,6,'2026-02-17','C+');
INSERT INTO "enrollments" VALUES(92,30,7,'2026-02-18','C');
INSERT INTO "enrollments" VALUES(93,30,8,'2026-02-19','A');
CREATE TABLE students (
  student_id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE
);
INSERT INTO "students" VALUES(1,'Amara','Singh','amara.singh@greenfield.edu');
INSERT INTO "students" VALUES(2,'Luca','Martin','luca.martin@greenfield.edu');
INSERT INTO "students" VALUES(3,'Mia','Chen','mia.chen@greenfield.edu');
INSERT INTO "students" VALUES(4,'Noah','Williams','noah.williams@greenfield.edu');
INSERT INTO "students" VALUES(5,'Isla','Brown','isla.brown@greenfield.edu');
INSERT INTO "students" VALUES(6,'Zara','James','zara.james@greenfield.edu');
INSERT INTO "students" VALUES(7,'Ethan','Walker','ethan.walker@greenfield.edu');
INSERT INTO "students" VALUES(8,'Priya','Nair','priya.nair@greenfield.edu');
INSERT INTO "students" VALUES(9,'Oliver','Thompson','oliver.thompson@greenfield.edu');
INSERT INTO "students" VALUES(10,'Ruby','Clarke','ruby.clarke@greenfield.edu');
INSERT INTO "students" VALUES(11,'Noah','Bennett','noah.bennett@greenfield.edu');
INSERT INTO "students" VALUES(12,'Hannah','Reed','hannah.reed@greenfield.edu');
INSERT INTO "students" VALUES(13,'Leo','Parker','leo.parker@greenfield.edu');
INSERT INTO "students" VALUES(14,'Sienna','Ward','sienna.ward@greenfield.edu');
INSERT INTO "students" VALUES(15,'Arjun','Singh','arjun.singh@greenfield.edu');
INSERT INTO "students" VALUES(16,'Evie','Martin','evie.martin@greenfield.edu');
INSERT INTO "students" VALUES(17,'Mateo','Garcia','mateo.garcia@greenfield.edu');
INSERT INTO "students" VALUES(18,'Chloe','Adams','chloe.adams@greenfield.edu');
INSERT INTO "students" VALUES(19,'Isaac','Brooks','isaac.brooks@greenfield.edu');
INSERT INTO "students" VALUES(20,'Layla','Hussein','layla.hussein@greenfield.edu');
INSERT INTO "students" VALUES(21,'Finn','Campbell','finn.campbell@greenfield.edu');
INSERT INTO "students" VALUES(22,'Amira','Khan','amira.khan@greenfield.edu');
INSERT INTO "students" VALUES(23,'Jack','Cooper','jack.cooper@greenfield.edu');
INSERT INTO "students" VALUES(24,'Grace','Turner','grace.turner@greenfield.edu');
INSERT INTO "students" VALUES(25,'Eli','Robinson','eli.robinson@greenfield.edu');
INSERT INTO "students" VALUES(26,'Maya','Wilson','maya.wilson@greenfield.edu');
INSERT INTO "students" VALUES(27,'Thomas','Nguyen','thomas.nguyen@greenfield.edu');
INSERT INTO "students" VALUES(28,'Aaliyah','White','aaliyah.white@greenfield.edu');
INSERT INTO "students" VALUES(29,'Samuel','Green','samuel.green@greenfield.edu');
INSERT INTO "students" VALUES(30,'Sofia','Edwards','sofia.edwards@greenfield.edu');
CREATE TABLE subjects (
  subject_id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_name TEXT NOT NULL UNIQUE,
  teacher_id INTEGER NOT NULL,
  credits INTEGER NOT NULL DEFAULT 1
);
INSERT INTO "subjects" VALUES(1,'English Literature',1,2);
INSERT INTO "subjects" VALUES(2,'Mathematics',2,2);
INSERT INTO "subjects" VALUES(3,'Earth and Environmental Science',3,2);
INSERT INTO "subjects" VALUES(4,'Visual Arts',4,1);
INSERT INTO "subjects" VALUES(5,'History',5,1);
INSERT INTO "subjects" VALUES(6,'Health and Physical Education',6,1);
INSERT INTO "subjects" VALUES(7,'Computing and Digital Technologies',7,2);
INSERT INTO "subjects" VALUES(8,'Music',8,1);
CREATE TABLE teachers (
  teacher_id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_name TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL
);
INSERT INTO "teachers" VALUES(1,'Ms Patel','ms.patel@greenfield.edu','Languages');
INSERT INTO "teachers" VALUES(2,'Mr Thompson','mr.thompson@greenfield.edu','Mathematics');
INSERT INTO "teachers" VALUES(3,'Dr Nguyen','dr.nguyen@greenfield.edu','Science');
INSERT INTO "teachers" VALUES(4,'Ms Cooper','ms.cooper@greenfield.edu','The Arts');
INSERT INTO "teachers" VALUES(5,'Mr Wilson','mr.wilson@greenfield.edu','Humanities');
INSERT INTO "teachers" VALUES(6,'Ms King','ms.king@greenfield.edu','Health and Physical Education');
INSERT INTO "teachers" VALUES(7,'Mr Ahmed','mr.ahmed@greenfield.edu','Technology');
INSERT INTO "teachers" VALUES(8,'Ms Taylor','ms.taylor@greenfield.edu','The Arts');
INSERT INTO "teachers" VALUES(9,'Ms Brooks','ms.brooks@greenfield.edu','Year Level Coordination');
INSERT INTO "teachers" VALUES(10,'Mr Lee','mr.lee@greenfield.edu','Year Level Coordination');
DELETE FROM "sqlite_sequence";
INSERT INTO "sqlite_sequence" VALUES('students',30);
INSERT INTO "sqlite_sequence" VALUES('teachers',10);
INSERT INTO "sqlite_sequence" VALUES('subjects',8);
INSERT INTO "sqlite_sequence" VALUES('enrollments',93);
COMMIT;
    `);
    return database;
  }
}

function writeSavedDatabase(storage, bytes) {
  return new Promise((resolve, reject) => {
    const transaction = storage.transaction(DATABASE_STORE, 'readwrite');
    transaction.objectStore(DATABASE_STORE).put(bytes, DATABASE_KEY);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Could not save the database.'));
    transaction.onabort = () => reject(transaction.error || new Error('The database save was interrupted.'));
  });
}

function saveDatabase(storage) {
  setSaveStatus('saving', 'Saving…');
  const bytes = db.export();
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    await writeSavedDatabase(storage, bytes);
    if (!currentFileHandle) return true;
    try {
      await writeDatabaseFile(currentFileHandle, bytes);
      return true;
    } catch (error) {
      console.error('The browser copy was saved, but the database file could not be updated.', error);
      return false;
    }
  });
  return saveQueue.then((fileSaved) => {
    setSaveStatus(fileSaved ? 'saved' : 'error', fileSaved ? 'All changes saved' : 'File auto-save failed');
  })
    .catch((error) => {
      setSaveStatus('error', 'Save failed');
      throw error;
    });
}

async function writeDatabaseFile(handle, bytes) {
  const writable = await handle.createWritable();
  try {
    await writable.write(bytes);
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => {});
    throw error;
  }
}

function setDatabaseFileName(name) {
  currentFileName = name || 'sqlite-studio.sqlite';
  const title = document.querySelector('#database-title');
  if (title) title.textContent = currentFileName;
  const subtitle = document.querySelector('#database-subtitle');
  if (subtitle) subtitle.textContent = currentFileHandle ? 'Auto-saves to this file' : 'Saved in this browser';
}

function showDatabaseError(error) {
  if (error?.name === 'AbortError') return;
  console.error(error);
  window.alert(error?.message || 'The database file could not be opened.');
}

async function openDatabaseFile(storage, file, handle = null) {
  if (!file) return;
  if (!window.confirm(`Open “${file.name}” and replace the database currently in this workspace?`)) return;

  await flushQueryDraft(storage);
  await saveQueue.catch(() => {});
  const bytes = new Uint8Array(await file.arrayBuffer());
  const candidate = new SQLModule.Database(bytes);
  removeLegacyInternalTables(candidate);
  candidate.run('PRAGMA foreign_keys = ON;');
  ensureSavedQueriesTable(candidate);
  ensureSavedReportDesignsTable(candidate);
  const currentDraft = elements.sqlInput.value;
  await writeStoredValue(storage, QUERY_DRAFT_KEY, currentDraft);

  if (handle) {
    try {
      let permission = await handle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') permission = await handle.requestPermission({ mode: 'readwrite' });
      currentFileHandle = permission === 'granted' ? handle : null;
    } catch (error) {
      console.warn('File access was not granted; this database will save in browser storage only.', error);
      currentFileHandle = null;
    }
  } else {
    currentFileHandle = null;
  }

  const previousDatabase = db;
  db = candidate;
  lastQuerySqlText = '';
  lastQueryResultSet = null;
  reportDesignPendingDefinition = null;
  window.resetReportDesignForDatabase?.();
  queryDesignTables = []; queryDesignFields = []; queryDesignPositions = {}; queryDesignTotalsMode = false;
  relationshipPositions = {};
  await writeStoredValue(storage, RELATIONSHIP_LAYOUT_KEY, relationshipPositions);
  previousDatabase?.close();
  elements.sqlInput.value = currentDraft;
  setDatabaseFileName(file.name);
  await writeStoredValue(storage, DATABASE_FILENAME_KEY, file.name);
  activeTable = listTables()[0] || null;
  datasheetFilters.clear();
  datasheetFilterTable = activeTable;
  renderSchema();
  renderDataGrid();
  refreshSavedQueries('');
  window.refreshReportDesignSources?.();
  if (!document.querySelector('#relationships-panel').hidden) renderRelationships();
  await saveDatabase(storage);
}

async function chooseDatabaseToOpen(storage) {
  if (typeof window.showOpenFilePicker === 'function') {
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: 'SQLite database', accept: { 'application/vnd.sqlite3': ['.sqlite', '.sqlite3', '.db'] } }],
      });
      const file = await handle.getFile();
      await openDatabaseFile(storage, file, handle);
    } catch (error) {
      showDatabaseError(error);
    }
    return;
  }
  document.querySelector('#database-file-input').click();
}

function downloadDatabaseCopy(bytes, fileName) {
  const blob = new Blob([bytes], { type: 'application/vnd.sqlite3' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function createNewDatabase(storage) {
  let handle = null;
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: 'new-database.sqlite',
        types: [{ description: 'SQLite database', accept: { 'application/vnd.sqlite3': ['.sqlite', '.sqlite3', '.db'] } }],
      });
    } catch (error) {
      showDatabaseError(error);
      return;
    }
  }

  const fileName = handle?.name || 'new-database.sqlite';
  let candidate = null;
  if (!handle) {
    candidate = new SQLModule.Database();
    candidate.run('PRAGMA foreign_keys = ON;');
    ensureSavedQueriesTable(candidate);
    ensureSavedReportDesignsTable(candidate);
    downloadDatabaseCopy(candidate.export(), fileName);
  }
  await flushQueryDraft(storage);
  await saveQueue.catch(() => {});
  const initialDraft = 'SELECT 1;';
  if (handle) {
    candidate = new SQLModule.Database();
    candidate.run('PRAGMA foreign_keys = ON;');
    ensureSavedQueriesTable(candidate);
    ensureSavedReportDesignsTable(candidate);
    try {
      await writeDatabaseFile(handle, candidate.export());
    } catch (error) {
      candidate.close();
      showDatabaseError(error);
      return;
    }
  }

  const previousDatabase = db;
  db = candidate;
  lastQuerySqlText = '';
  lastQueryResultSet = null;
  reportDesignPendingDefinition = null;
  window.resetReportDesignForDatabase?.();
  queryDesignTables = []; queryDesignFields = []; queryDesignPositions = {}; queryDesignTotalsMode = false;
  relationshipPositions = {};
  await writeStoredValue(storage, RELATIONSHIP_LAYOUT_KEY, relationshipPositions);
  currentFileHandle = handle;
  setDatabaseFileName(fileName);
  previousDatabase?.close();
  elements.sqlInput.value = initialDraft;
  await writeStoredValue(storage, DATABASE_FILENAME_KEY, fileName);
  await writeStoredValue(storage, QUERY_DRAFT_KEY, initialDraft);
  activeTable = null;
  datasheetFilters.clear();
  datasheetFilterTable = null;
  renderSchema();
  renderDataGrid();
  refreshSavedQueries('');
  window.refreshReportDesignSources?.();
  elements.results.innerHTML = '<div class="welcome-state"><span class="welcome-icon" aria-hidden="true">⌁</span><strong>Run a query to see results</strong><span>Try editing the sample query above.</span></div>';
  elements.resultCount.textContent = 'Ready';
  elements.resultTime.textContent = '';
  await saveDatabase(storage);
  if (elements.status.dataset.state !== 'error') {
    setSaveStatus('saved', handle ? `Saved to ${fileName}` : 'Database downloaded');
  }
  activateTab('data');
}

async function saveDatabaseAs(storage) {
  await flushQueryDraft(storage);
  await saveQueue.catch(() => {});
  const bytes = db.export();
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: currentFileName,
        types: [{ description: 'SQLite database', accept: { 'application/vnd.sqlite3': ['.sqlite', '.sqlite3', '.db'] } }],
      });
      await writeDatabaseFile(handle, bytes);
      currentFileHandle = handle;
      setDatabaseFileName(handle.name || currentFileName);
      await writeStoredValue(storage, DATABASE_FILENAME_KEY, currentFileName);
      await saveDatabase(storage);
      setSaveStatus('saved', `Saved to ${currentFileName}`);
      return;
    } catch (error) {
      showDatabaseError(error);
      return;
    }
  }

  downloadDatabaseCopy(bytes, currentFileName);
  await writeSavedDatabase(storage, bytes);
  await writeStoredValue(storage, DATABASE_FILENAME_KEY, currentFileName);
  setSaveStatus('saved', 'Database downloaded');
}

async function persistQueryDraft(storage) {
  await writeStoredValue(storage, QUERY_DRAFT_KEY, elements.sqlInput.value);
  await saveQueue.catch(() => {});
  setSaveStatus('saved', 'All changes saved');
}

function scheduleQueryDraftSave(storage) {
  window.clearTimeout(queryDraftTimer);
  queryDraftTimer = window.setTimeout(() => {
    queryDraftTimer = null;
    persistQueryDraft(storage).catch((error) => {
      console.error(error);
      setSaveStatus('error', 'Draft save failed');
    });
  }, 450);
}

function flushQueryDraft(storage) {
  if (queryDraftTimer === null) return Promise.resolve();
  window.clearTimeout(queryDraftTimer);
  queryDraftTimer = null;
  return persistQueryDraft(storage).catch((error) => {
    console.error(error);
    setSaveStatus('error', 'Draft save failed');
  });
}

function refreshSavedQueries(selectedName = document.querySelector('#saved-query-select')?.value || '') {
  const select = document.querySelector('#saved-query-select');
  const loadButton = document.querySelector('#load-saved-query');
  const deleteButton = document.querySelector('#delete-saved-query');
  if (!select || !db) return;
  const selected = selectedName;
  select.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  const rows = db.exec(`SELECT query_name FROM ${quoteIdentifier(SAVED_QUERIES_TABLE)} ORDER BY query_name COLLATE NOCASE;`)[0]?.values || [];
  placeholder.textContent = rows.length ? 'Choose a saved query…' : 'No saved queries yet';
  select.append(placeholder);
  for (const [queryName] of rows) {
    const option = document.createElement('option');
    option.value = queryName;
    option.textContent = queryName;
    select.append(option);
  }
  if (rows.some(([name]) => name === selected)) select.value = selected;
  loadButton.disabled = !select.value;
  deleteButton.disabled = !select.value;
}

function loadSavedQuery(storage) {
  const name = document.querySelector('#saved-query-select').value;
  if (!name) return;
  const statement = db.prepare(`SELECT sql_text FROM ${quoteIdentifier(SAVED_QUERIES_TABLE)} WHERE query_name = ?;`);
  let sql = null;
  try {
    statement.bind([name]);
    if (statement.step()) sql = statement.getAsObject().sql_text;
  } finally {
    statement.free();
  }
  if (sql === null) {
    refreshSavedQueries();
    return;
  }
  elements.sqlInput.value = sql;
  updateJoinDiagram();
  scheduleQueryDraftSave(storage);
  hideSqlSuggestions();
  const feedback = document.querySelector('#saved-query-feedback');
  feedback.classList.remove('is-error');
  feedback.textContent = `Loaded “${name}”.`;
  elements.sqlInput.focus();
}

function askForSavedQueryName(currentName = '') {
  const dialog = document.querySelector('#saved-query-name-dialog');
  const form = document.querySelector('#saved-query-name-form');
  const input = document.querySelector('#saved-query-name-input');
  input.value = currentName;
  input.setCustomValidity('');
  return new Promise((resolve) => {
    let finished = false;
    const clearValidity = () => input.setCustomValidity('');
    const finish = (value) => {
      if (finished) return;
      finished = true;
      form.removeEventListener('submit', submit);
      dialog.removeEventListener('close', closed);
      input.removeEventListener('input', clearValidity);
      resolve(value);
    };
    const submit = (event) => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name) {
        input.setCustomValidity('Enter a name for this query.');
        input.reportValidity();
        return;
      }
      input.setCustomValidity('');
      finish(name);
      dialog.close();
    };
    const closed = () => finish(null);
    input.addEventListener('input', clearValidity);
    form.addEventListener('submit', submit);
    dialog.addEventListener('close', closed);
    dialog.showModal();
    input.focus();
    input.select();
  });
}

function askForAppConfirmation(title, message, acceptLabel) {
  const dialog = document.querySelector('#app-confirm-dialog');
  const form = document.querySelector('#app-confirm-form');
  document.querySelector('#app-confirm-title').textContent = title;
  document.querySelector('#app-confirm-message').textContent = message;
  document.querySelector('#app-confirm-accept').textContent = acceptLabel;
  return new Promise((resolve) => {
    let finished = false;
    const finish = (confirmed) => {
      if (finished) return;
      finished = true;
      form.removeEventListener('submit', submit);
      dialog.removeEventListener('close', closed);
      resolve(confirmed);
    };
    const submit = (event) => {
      event.preventDefault();
      finish(true);
      dialog.close();
    };
    const closed = () => finish(false);
    form.addEventListener('submit', submit);
    dialog.addEventListener('close', closed);
    dialog.showModal();
  });
}

async function saveSavedQuery(storage) {
  const sql = elements.sqlInput.value.trim();
  if (!sql) {
    document.querySelector('#saved-query-feedback').textContent = 'Enter a query before saving it.';
    return;
  }
  const currentName = document.querySelector('#saved-query-select').value;
  const name = await askForSavedQueryName(currentName);
  if (name === null) return;
  const lookup = db.prepare(`SELECT 1 FROM ${quoteIdentifier(SAVED_QUERIES_TABLE)} WHERE query_name = ?;`);
  let exists;
  try {
    lookup.bind([name]);
    exists = lookup.step();
  } finally {
    lookup.free();
  }
  if (exists && !await askForAppConfirmation('Replace saved query?', `A saved query named “${name}” already exists. Replace it?`, 'Replace')) return;
  const statement = db.prepare(exists
    ? `UPDATE ${quoteIdentifier(SAVED_QUERIES_TABLE)} SET sql_text = ?, updated_at = CURRENT_TIMESTAMP WHERE query_name = ?;`
    : `INSERT INTO ${quoteIdentifier(SAVED_QUERIES_TABLE)} (query_name, sql_text) VALUES (?, ?);`);
  try {
    statement.run(exists ? [sql, name] : [name, sql]);
  } finally {
    statement.free();
  }
  await saveDatabase(storage);
  refreshSavedQueries(name);
  const feedback = document.querySelector('#saved-query-feedback');
  feedback.classList.remove('is-error');
  feedback.textContent = `Saved “${name}” with this database.`;
}

async function deleteSavedQuery(storage) {
  const name = document.querySelector('#saved-query-select').value;
  if (!name || !await askForAppConfirmation('Delete saved query?', `Delete the saved query “${name}”?`, 'Delete')) return;
  const statement = db.prepare(`DELETE FROM ${quoteIdentifier(SAVED_QUERIES_TABLE)} WHERE query_name = ?;`);
  try {
    statement.run([name]);
  } finally {
    statement.free();
  }
  await saveDatabase(storage);
  refreshSavedQueries();
  const feedback = document.querySelector('#saved-query-feedback');
  feedback.classList.remove('is-error');
  feedback.textContent = `Deleted “${name}”.`;
}

function askForSavedReportName(currentName = '') {
  const dialog = document.querySelector('#saved-report-name-dialog');
  const form = document.querySelector('#saved-report-name-form');
  const input = document.querySelector('#saved-report-name-input');
  document.querySelector('#saved-report-name-eyebrow').textContent = 'SAVE REPORT DESIGN';
  document.querySelector('#saved-report-name-title').textContent = 'Name this report design';
  document.querySelector('#saved-report-name-description').textContent = 'The report design will be saved with this database.';
  document.querySelector('#saved-report-name-label').textContent = 'Report design name';
  document.querySelector('#saved-report-name-submit').textContent = 'Save design';
  input.value = currentName;
  input.setCustomValidity('');
  return new Promise((resolve) => {
    let finished = false;
    const clearValidity = () => input.setCustomValidity('');
    const finish = (value) => {
      if (finished) return;
      finished = true;
      form.removeEventListener('submit', submit);
      dialog.removeEventListener('close', closed);
      input.removeEventListener('input', clearValidity);
      resolve(value);
    };
    const submit = (event) => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name) {
        input.setCustomValidity('Enter a name for this report design.');
        input.reportValidity();
        return;
      }
      finish(name);
      dialog.close();
    };
    const closed = () => finish(null);
    input.addEventListener('input', clearValidity);
    form.addEventListener('submit', submit);
    dialog.addEventListener('close', closed);
    dialog.showModal();
    input.focus();
    input.select();
  });
}

function renderSchema() {
  const tables = listTables();

  elements.tableList.replaceChildren();
  if (tables.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-tables';
    empty.textContent = 'No tables yet';
    elements.tableList.append(empty);
    return;
  }

  for (const table of tables) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    const glyph = document.createElement('span');
    glyph.className = 'table-glyph';
    glyph.textContent = '▦';
    glyph.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.textContent = table;
    button.append(glyph, name);
    button.classList.toggle('is-selected', table === activeTable);
    button.title = `Open ${table} in the datasheet`;
    button.addEventListener('click', () => {
      activeTable = table;
      renderDataGrid();
      elements.sqlInput.value = `SELECT * FROM "${table.replaceAll('"', '""')}";`;
      updateJoinDiagram();
    });
    item.append(button);
    elements.tableList.append(item);
  }
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function parseCsv(text, delimiter) {
  const source = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (character === '\r' && source[index + 1] === '\n') index += 1;
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('This CSV has a quoted field that was not closed.');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(text) {
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestScore = 1;
  for (const candidate of candidates) {
    try {
      const rows = parseCsv(text, candidate).slice(0, 6).filter((item) => item.some((value) => value !== ''));
      if (!rows.length) continue;
      const widths = rows.map((item) => item.length);
      const width = Math.max(...widths);
      const consistency = widths.filter((item) => item === width).length / widths.length;
      const score = width > 1 ? width * consistency : 1;
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    } catch { /* Try the next separator. */ }
  }
  return best;
}

function currentCsvRows() {
  if (!importState) return [];
  const selected = document.querySelector('#csv-delimiter').value;
  const delimiter = selected === 'auto' ? detectDelimiter(importState.text) : selected === 'tab' ? '\t' : selected;
  return { delimiter, rows: parseCsv(importState.text, delimiter) };
}

function uniqueColumnNames(rawNames) {
  const used = new Set();
  return rawNames.map((rawName, index) => {
    const base = String(rawName).trim() || `column_${index + 1}`;
    let name = base;
    let suffix = 2;
    while (used.has(name.toLocaleLowerCase())) {
      name = `${base}_${suffix}`;
      suffix += 1;
    }
    used.add(name.toLocaleLowerCase());
    return name;
  });
}

function csvTableData() {
  const { rows, delimiter } = currentCsvRows();
  if (!rows.length || !rows.some((row) => row.some((value) => value !== ''))) {
    throw new Error('The selected file is empty.');
  }
  const hasHeader = document.querySelector('#csv-has-header').checked;
  const rawColumnNames = hasHeader
    ? rows[0]
    : rows[0].map((_, index) => `column_${index + 1}`);
  if (rawColumnNames.length === 0) throw new Error('No columns were found in this file.');

  const columns = uniqueColumnNames(rawColumnNames);
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const cleanRows = dataRows.filter((row) => !(row.length === 1 && row[0] === ''));
  for (let index = 0; index < cleanRows.length; index += 1) {
    if (cleanRows[index].length > columns.length) {
      throw new Error(`Row ${index + (hasHeader ? 2 : 1)} has more fields than the ${columns.length} columns.`);
    }
    while (cleanRows[index].length < columns.length) cleanRows[index].push('');
  }
  return { columns, rows: cleanRows, delimiter };
}

function refreshCsvPreview() {
  const preview = document.querySelector('#csv-preview');
  const feedback = document.querySelector('#import-feedback');
  const submit = document.querySelector('#import-submit');
  preview.replaceChildren();
  feedback.textContent = '';
  submit.disabled = true;
  if (!importState) {
    const placeholder = document.createElement('span');
    placeholder.className = 'preview-placeholder';
    placeholder.textContent = 'Choose a file to preview its columns and rows.';
    preview.append(placeholder);
    return;
  }

  try {
    const { columns, rows, delimiter } = csvTableData();
    const table = document.createElement('table');
    table.className = 'preview-table';
    const head = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const column of columns.slice(0, 6)) {
      const cell = document.createElement('th');
      cell.textContent = column;
      headerRow.append(cell);
    }
    head.append(headerRow);
    const body = document.createElement('tbody');
    const sample = rows.slice(0, 4);
    for (const row of sample) {
      const rowElement = document.createElement('tr');
      for (const value of row.slice(0, 6)) {
        const cell = document.createElement('td');
        cell.textContent = value || ' ';
        rowElement.append(cell);
      }
      body.append(rowElement);
    }
    table.append(head, body);
    preview.append(table);
    const detail = document.createElement('span');
    detail.className = 'preview-detail';
    detail.textContent = `${rows.length} data row${rows.length === 1 ? '' : 's'} · ${columns.length} column${columns.length === 1 ? '' : 's'} · ${delimiter === '\t' ? 'tab' : delimiter} separated`;
    preview.append(detail);
    submit.disabled = false;
  } catch (error) {
    feedback.textContent = error.message;
    feedback.classList.add('is-error');
  }
}

function listTables() {
  return db.exec(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND upper(name) NOT IN ('${SAVED_QUERIES_TABLE}', '${SAVED_REPORTS_TABLE}', '${SAVED_REPORT_DESIGNS_TABLE}') ORDER BY name;`)
    [0]?.values.map(([name]) => name) || [];
}

function getTableSchema(tableName) {
  const info = db.exec(`PRAGMA table_info(${quoteIdentifier(tableName)});`)[0]?.values || [];
  return info.map((column) => ({
    name: column[1],
    type: column[2] || '',
    notNull: Boolean(column[3]),
    defaultValue: column[4],
    primaryKey: column[5],
  }));
}

function getDesignerSchema(tableName) {
  const columns = getTableSchema(tableName);
  const ddlResult = db.exec('SELECT sql FROM sqlite_master WHERE type = ? AND name = ?;');
  const ddl = ddlResult[0]?.values[0]?.[0] || '';
  const autoIncrementColumn = /\bAUTOINCREMENT\b/i.test(ddl)
    ? columns.find((column) => column.primaryKey && String(column.type).toUpperCase() === 'INTEGER')?.name
    : null;
  const indexes = db.exec(`PRAGMA index_list(${quoteIdentifier(tableName)});`)[0]?.values || [];
  const uniqueColumns = new Set();
  const compositeUniqueConstraints = [];
  let unsupportedUniqueIndex = false;
  for (const index of indexes) {
    if (!index[2] || index[3] === 'pk') continue;
    const indexColumns = (db.exec(`PRAGMA index_info(${quoteIdentifier(index[1])});`)[0]?.values || []).sort((left, right) => left[0] - right[0]);
    const names = indexColumns.map((column) => column[2]);
    if (!index[4] && names.length === 1 && names[0] !== null) uniqueColumns.add(names[0]);
    else if (!index[4] && index[3] === 'u' && names.length > 1 && names.every((name) => name !== null)) compositeUniqueConstraints.push(names);
    else unsupportedUniqueIndex = true;
  }
  return {
    columns: columns.map((column) => ({
      name: column.name,
      type: column.type || 'TEXT',
      notNull: column.notNull,
      defaultValue: column.defaultValue === null ? '' : String(column.defaultValue),
      primaryKey: column.primaryKey > 0,
      unique: uniqueColumns.has(column.name),
      autoincrement: column.name === autoIncrementColumn,
    })),
    ddl,
    unsupportedUniqueIndex,
    compositeUniqueConstraints,
    unsupportedPrimaryKey: columns.filter((column) => column.primaryKey > 0).length > 1,
  };
}

function readTableData(tableName) {
  const columns = getTableSchema(tableName);
  if (!columns.length) return { columns, rows: [], keyMode: null, keyColumns: [] };
  const sqlStatement = db.prepare('SELECT sql FROM sqlite_master WHERE type = ? AND name = ?;');
  sqlStatement.bind(['table', tableName]);
  const ddl = sqlStatement.step() ? sqlStatement.get()[0] || '' : '';
  sqlStatement.free();
  const withoutRowid = /\bWITHOUT\s+ROWID\b/i.test(ddl);
  const columnNames = new Set(columns.map((column) => column.name.toLocaleLowerCase()));
  const rowidColumn = withoutRowid ? null : ['rowid', '_rowid_', 'oid'].find((name) => !columnNames.has(name));
  const keyColumns = columns.filter((column) => column.primaryKey > 0).sort((a, b) => a.primaryKey - b.primaryKey);
  if (!rowidColumn && !keyColumns.length) {
    return { columns, rows: [], keyMode: null, keyColumns: [] };
  }

  let keyMode = 'rowid';
  let selectSql;
  if (rowidColumn) {
    let keyAlias = '__app_row_key__';
    while (columnNames.has(keyAlias.toLocaleLowerCase())) keyAlias += '_';
    selectSql = `SELECT ${quoteIdentifier(rowidColumn)} AS ${quoteIdentifier(keyAlias)}, * FROM ${quoteIdentifier(tableName)};`;
  } else {
    keyMode = 'primary-key';
    selectSql = `SELECT * FROM ${quoteIdentifier(tableName)};`;
  }
  const result = db.exec(selectSql)[0];
  if (!result) return { columns, rows: [], keyMode, keyColumns };
  const dataOffset = keyMode === 'rowid' ? 1 : 0;
  const rows = result.values.map((values) => {
    const rowValues = values.slice(dataOffset);
    const key = keyMode === 'rowid'
      ? [values[0]]
      : keyColumns.map((column) => rowValues[columns.findIndex((item) => item.name === column.name)]);
    return { key, values: rowValues, original: rowValues.slice(), touched: new Set(), isNew: false };
  });
  return { columns, rows, keyMode, keyColumns, rowidColumn };
}

function datasheetSearchTerm() {
  return document.querySelector('#datasheet-search').value.trim().toLocaleLowerCase();
}

function datasheetRowMatches(row, term = datasheetSearchTerm()) {
  if (term && !row.values.some((value) => displayCellValue(value).toLocaleLowerCase().includes(term))) return false;
  for (const [fieldName, selectedValues] of datasheetFilters) {
    const fieldIndex = gridState?.columns.findIndex((column) => column.name === fieldName) ?? -1;
    if (fieldIndex >= 0 && !selectedValues.has(datasheetFilterValueKey(row.values[fieldIndex]))) return false;
  }
  return true;
}

function datasheetFilterValueKey(value) {
  return displayCellValue(value).toLocaleLowerCase();
}

function datasheetDistinctFilterValues(fieldName) {
  const fieldIndex = gridState?.columns.findIndex((column) => column.name === fieldName) ?? -1;
  if (fieldIndex < 0) return [];
  const values = new Map();
  gridState.rows.filter((row) => !row.isNew).forEach((row) => {
    const value = row.values[fieldIndex];
    const key = datasheetFilterValueKey(value);
    if (!values.has(key)) values.set(key, { key, label: value === null || value === undefined || value === '' ? '(Blanks)' : displayCellValue(value) });
  });
  return [...values.values()].sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true, sensitivity: 'base' }));
}

function datasheetViewHasFilters() {
  return datasheetFilters.size > 0;
}

function updateDatasheetRowCount() {
  if (!gridState) return { visibleRows: 0, viewIsFiltered: false };
  const totalRows = gridState.rows.filter((row) => !row.isNew).length;
  const visibleRows = gridState.rows.filter((row) => !row.isNew && datasheetRowMatches(row)).length;
  const viewIsFiltered = Boolean(datasheetSearchTerm()) || datasheetViewHasFilters();
  elements.dataRowCount.textContent = viewIsFiltered
    ? `${visibleRows} of ${totalRows} rows`
    : `${totalRows} row${totalRows === 1 ? '' : 's'}`;
  return { visibleRows, viewIsFiltered };
}

function renderDatasheetFilterOptions(menu, fieldName, selectedValues) {
  const list = menu.querySelector('.datasheet-filter-options');
  const search = menu.querySelector('.datasheet-filter-search').value.trim().toLocaleLowerCase();
  const allValues = datasheetDistinctFilterValues(fieldName);
  const matching = search ? allValues.filter((item) => item.label.toLocaleLowerCase().includes(search)) : allValues;
  const shown = matching.slice(0, 500);
  list.replaceChildren();
  for (const item of shown) {
    const label = document.createElement('label');
    label.className = 'datasheet-filter-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selectedValues.has(item.key);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selectedValues.add(item.key);
      else selectedValues.delete(item.key);
      updateDatasheetFilterSelectionCount(menu, selectedValues, allValues.length);
    });
    const text = document.createElement('span');
    text.textContent = item.label;
    label.append(checkbox, text);
    list.append(label);
  }
  menu.querySelector('.datasheet-filter-limit').hidden = matching.length <= shown.length;
  menu.querySelector('.datasheet-filter-empty').hidden = allValues.length > 0 && matching.length > 0;
  menu.querySelector('.datasheet-filter-empty').textContent = allValues.length ? 'No values match your search.' : 'This field has no values to filter.';
  updateDatasheetFilterSelectionCount(menu, selectedValues, allValues.length);
}

function updateDatasheetFilterSelectionCount(menu, selectedValues, valueCount) {
  menu.querySelector('.datasheet-filter-count').textContent = `${selectedValues.size} of ${valueCount} selected`;
}

function positionDatasheetFilterMenu() {
  const menu = openDatasheetFilterMenu;
  const button = menu?.filterButton;
  if (!menu || menu.hidden || !button?.isConnected) return;
  const anchor = button.getBoundingClientRect();
  const margin = 8;
  const width = Math.max(120, Math.min(270, window.innerWidth - margin * 2));
  menu.style.width = `${width}px`;
  menu.style.maxHeight = `${Math.max(80, window.innerHeight - margin * 2)}px`;
  const left = Math.max(margin, Math.min(anchor.right - width, window.innerWidth - width - margin));
  const menuHeight = menu.getBoundingClientRect().height;
  const spaceBelow = window.innerHeight - anchor.bottom - margin;
  const spaceAbove = anchor.top - margin;
  let top = anchor.bottom + 4;
  if (spaceBelow < menuHeight && spaceAbove > spaceBelow) top = anchor.top - menuHeight - 4;
  top = Math.max(margin, Math.min(top, window.innerHeight - menuHeight - margin));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function closeDatasheetFilterMenu(restoreFocus = false) {
  const menu = openDatasheetFilterMenu;
  const button = menu?.filterButton;
  if (menu) menu.remove();
  if (button) {
    button.setAttribute('aria-expanded', 'false');
    if (restoreFocus && button.isConnected) button.focus();
  }
  openDatasheetFilterMenu = null;
  openDatasheetFilterField = null;
  datasheetFilterDraft = null;
}

function createDatasheetFilterMenu(fieldName) {
  const menu = document.createElement('div');
  menu.className = 'datasheet-filter-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', `Filter ${fieldName}`);
  const top = document.createElement('div');
  top.className = 'datasheet-filter-menu-top';
  const search = document.createElement('input');
  search.className = 'text-input datasheet-filter-search';
  search.type = 'search';
  search.placeholder = 'Search values';
  search.setAttribute('aria-label', `Search ${fieldName} values`);
  top.append(search);
  const actions = document.createElement('div');
  actions.className = 'datasheet-filter-menu-actions';
  const selectAll = document.createElement('button');
  selectAll.type = 'button';
  selectAll.className = 'text-button';
  selectAll.textContent = 'Select all';
  selectAll.setAttribute('aria-label', `Select all ${fieldName} values`);
  const selectNone = document.createElement('button');
  selectNone.type = 'button';
  selectNone.className = 'text-button';
  selectNone.textContent = 'Select none';
  selectNone.setAttribute('aria-label', `Select no ${fieldName} values`);
  const clearFilter = document.createElement('button');
  clearFilter.type = 'button';
  clearFilter.className = 'text-button';
  clearFilter.textContent = 'Clear filter';
  actions.append(selectAll, selectNone, clearFilter);
  const count = document.createElement('div');
  count.className = 'datasheet-filter-count';
  const options = document.createElement('div');
  options.className = 'datasheet-filter-options';
  const empty = document.createElement('div');
  empty.className = 'datasheet-filter-empty';
  empty.hidden = true;
  const limit = document.createElement('div');
  limit.className = 'datasheet-filter-limit';
  limit.hidden = true;
  limit.textContent = 'Showing 500 values. Search to find more.';
  const footer = document.createElement('div');
  footer.className = 'datasheet-filter-menu-footer';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'secondary-button';
  cancel.textContent = 'Cancel';
  const apply = document.createElement('button');
  apply.type = 'button';
  apply.className = 'primary-button';
  apply.textContent = 'Apply';
  footer.append(cancel, apply);
  menu.append(top, actions, count, options, empty, limit, footer);
  search.addEventListener('input', () => renderDatasheetFilterOptions(menu, fieldName, datasheetFilterDraft));
  menu.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeDatasheetFilterMenu(true);
  });
  const selectMatchingValues = (checked) => {
    const searchTerm = search.value.trim().toLocaleLowerCase();
    const matchingValues = datasheetDistinctFilterValues(fieldName).filter((item) => !searchTerm || item.label.toLocaleLowerCase().includes(searchTerm));
    matchingValues.forEach((item) => checked ? datasheetFilterDraft.add(item.key) : datasheetFilterDraft.delete(item.key));
    renderDatasheetFilterOptions(menu, fieldName, datasheetFilterDraft);
  };
  selectAll.addEventListener('click', () => selectMatchingValues(true));
  selectNone.addEventListener('click', () => selectMatchingValues(false));
  clearFilter.addEventListener('click', () => {
    datasheetFilters.delete(fieldName);
    closeDatasheetFilterMenu();
    renderDataGrid();
  });
  cancel.addEventListener('click', () => {
    closeDatasheetFilterMenu(true);
  });
  apply.addEventListener('click', () => {
    const allKeys = new Set(datasheetDistinctFilterValues(fieldName).map((item) => item.key));
    if (datasheetFilterDraft.size >= allKeys.size && [...allKeys].every((key) => datasheetFilterDraft.has(key))) datasheetFilters.delete(fieldName);
    else datasheetFilters.set(fieldName, new Set(datasheetFilterDraft));
    closeDatasheetFilterMenu();
    renderDataGrid();
  });
  return menu;
}

function openDatasheetFilter(fieldName, button, menu) {
  if (openDatasheetFilterField === fieldName && !menu.hidden) {
    closeDatasheetFilterMenu();
    return;
  }
  closeDatasheetFilterMenu();
  document.querySelectorAll('.datasheet-filter-button').forEach((item) => item.setAttribute('aria-expanded', 'false'));
  const values = datasheetDistinctFilterValues(fieldName);
  const currentFilter = datasheetFilters.get(fieldName);
  menu.querySelector('.datasheet-filter-menu-actions button:last-child').disabled = !currentFilter;
  datasheetFilterDraft = currentFilter ? new Set(currentFilter) : new Set(values.map((item) => item.key));
  openDatasheetFilterField = fieldName;
  menu.hidden = false;
  menu.filterButton = button;
  document.body.append(menu);
  openDatasheetFilterMenu = menu;
  button.setAttribute('aria-expanded', 'true');
  menu.querySelector('.datasheet-filter-search').value = '';
  renderDatasheetFilterOptions(menu, fieldName, datasheetFilterDraft);
  positionDatasheetFilterMenu();
  menu.querySelector('.datasheet-filter-search').focus();
}

function sortDatasheetRows() {
  if (!gridState) return;
  const fieldName = document.querySelector('#datasheet-sort-field').value;
  if (!fieldName) return;
  const direction = document.querySelector('#datasheet-sort-direction').value === 'DESC' ? -1 : 1;
  const fieldIndex = gridState.columns.findIndex((column) => column.name === fieldName);
  if (fieldIndex < 0) return;
  gridState.rows.sort((left, right) => {
    if (left.isNew || right.isNew) return left.isNew === right.isNew ? 0 : left.isNew ? 1 : -1;
    const a = left.values[fieldIndex];
    const b = right.values[fieldIndex];
    if (a === null || a === undefined || a === '') return b === null || b === undefined || b === '' ? 0 : 1;
    if (b === null || b === undefined || b === '') return -1;
    const aNumber = typeof a === 'number' ? a : Number(a);
    const bNumber = typeof b === 'number' ? b : Number(b);
    const bothNumeric = Number.isFinite(aNumber) && Number.isFinite(bNumber) && String(a).trim() !== '' && String(b).trim() !== '';
    const comparison = bothNumeric
      ? aNumber - bNumber
      : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
    return comparison * direction;
  });
}

function updateDatasheetViewControls(columns = []) {
  const search = document.querySelector('#datasheet-search');
  const sortField = document.querySelector('#datasheet-sort-field');
  const sortDirection = document.querySelector('#datasheet-sort-direction');
  const clear = document.querySelector('#datasheet-clear-view');
  for (const fieldName of datasheetFilters.keys()) {
    if (!columns.some((column) => column.name === fieldName)) datasheetFilters.delete(fieldName);
  }
  const previousField = sortField.value;
  search.disabled = columns.length === 0;
  sortField.replaceChildren(new Option('No sorting', ''));
  for (const column of columns) sortField.append(new Option(column.name, column.name));
  sortField.disabled = columns.length === 0;
  sortField.value = columns.some((column) => column.name === previousField) ? previousField : '';
  sortDirection.disabled = columns.length === 0 || !sortField.value;
  clear.disabled = !search.value && !sortField.value && !datasheetViewHasFilters();
}

function renderDataGrid() {
  closeDatasheetFilterMenu();
  const title = document.querySelector('#selected-table-name');
  const deleteTableButton = document.querySelector('#datasheet-delete-table');
  const availableTables = listTables();
  if (!activeTable || !availableTables.includes(activeTable)) activeTable = availableTables[0] || null;
  if (!activeTable) {
    datasheetFilters.clear();
    datasheetFilterTable = null;
    openDatasheetFilterField = null;
    datasheetFilterDraft = null;
    deleteTableButton.disabled = true;
    gridState = null;
    title.textContent = 'No tables yet';
    elements.dataRowCount.textContent = '0 rows';
    elements.dataGrid.replaceChildren();
    const empty = document.createElement('div');
    empty.className = 'grid-empty-state';
    empty.textContent = 'Create a table in Table Designer or import a CSV file to get started.';
    elements.dataGrid.append(empty);
    document.querySelector('#data-table-select').replaceChildren();
    document.querySelector('#data-table-select').disabled = true;
    updateDatasheetViewControls();
    elements.dataFeedback.textContent = '';
    elements.dataFeedback.classList.remove('is-error');
    return;
  }
  if (datasheetFilterTable !== activeTable) {
    datasheetFilters.clear();
    datasheetFilterTable = activeTable;
    openDatasheetFilterField = null;
    datasheetFilterDraft = null;
  }
  gridState = { table: activeTable, ...readTableData(activeTable) };
  deleteTableButton.disabled = false;
  updateDatasheetViewControls(gridState.columns);
  sortDatasheetRows();
  title.textContent = activeTable;
  const tableSelect = document.querySelector('#data-table-select');
  tableSelect.replaceChildren();
  for (const tableName of availableTables) {
    const option = document.createElement('option');
    option.value = tableName;
    option.textContent = tableName;
    tableSelect.append(option);
  }
  tableSelect.value = activeTable;
  tableSelect.disabled = false;
  elements.tableList.querySelectorAll('button').forEach((button) => {
    button.classList.toggle('is-selected', button.lastElementChild?.textContent === activeTable);
  });
  const { visibleRows, viewIsFiltered } = updateDatasheetRowCount();
  elements.dataFeedback.classList.remove('is-error');
  if (!gridState.keyMode) {
    elements.dataFeedback.textContent = 'This table has no editable row key, so its data is shown read-only.';
  } else if (viewIsFiltered && visibleRows === 0) {
    elements.dataFeedback.textContent = 'No rows match the current search and filters.';
  } else {
    elements.dataFeedback.textContent = '';
  }
  drawDataGrid();
}

function displayCellValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Uint8Array) return `[BLOB · ${value.byteLength} bytes]`;
  return String(value);
}

function drawDataGrid() {
  const container = elements.dataGrid;
  drawingGrid = true;
  container.replaceChildren();
  if (!gridState) {
    drawingGrid = false;
    return;
  }
  if (!gridState.rows.at(-1)?.isNew) {
    gridState.rows.push({ key: null, values: gridState.columns.map(() => ''), original: null, touched: new Set(), isNew: true });
  }
  const table = document.createElement('table');
  table.className = 'spreadsheet-grid';
  const head = document.createElement('thead');
  const header = document.createElement('tr');
  const rowNumberHeading = document.createElement('th');
  rowNumberHeading.className = 'row-number-heading';
  rowNumberHeading.textContent = '#';
  header.append(rowNumberHeading);
  for (const column of gridState.columns) {
    const cell = document.createElement('th');
    const heading = document.createElement('div');
    heading.className = 'field-heading-layout';
    const fieldButton = document.createElement('button');
    fieldButton.className = 'field-heading-button';
    fieldButton.type = 'button';
    fieldButton.textContent = column.name;
    fieldButton.title = `${column.name}${column.type ? ` · ${column.type}` : ''} · Click to edit field information`;
    fieldButton.setAttribute('aria-label', `Edit ${column.name} field information`);
    fieldButton.addEventListener('click', () => {
      closeDatasheetFilterMenu();
      openFieldDesigner(gridState.table, column.name);
    });
    heading.append(fieldButton);
    const filterButton = document.createElement('button');
    filterButton.type = 'button';
    filterButton.className = 'datasheet-filter-button';
    const filterApplied = datasheetFilters.has(column.name);
    filterButton.title = filterApplied ? `Filter ${column.name} (applied)` : `Filter ${column.name}`;
    filterButton.setAttribute('aria-label', filterApplied ? `Filter ${column.name}, filter applied` : `Filter ${column.name}`);
    filterButton.setAttribute('aria-haspopup', 'dialog');
    filterButton.setAttribute('aria-expanded', 'false');
    if (filterApplied) {
      filterButton.classList.add('is-filtered');
      const filterIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      filterIcon.classList.add('datasheet-filter-icon');
      filterIcon.setAttribute('viewBox', '0 0 16 16');
      filterIcon.setAttribute('aria-hidden', 'true');
      const funnel = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      funnel.setAttribute('d', 'M1.5 2.5h13L9 8v5l-2 1V8L1.5 2.5z');
      filterIcon.append(funnel);
      filterButton.append(filterIcon);
    } else {
      filterButton.textContent = '\u25BE';
    }
    const menu = createDatasheetFilterMenu(column.name);
    filterButton.addEventListener('click', (event) => {
      event.stopPropagation();
      openDatasheetFilter(column.name, filterButton, menu);
    });
    menu.filterButton = filterButton;
    heading.append(filterButton);
    cell.append(heading);
    header.append(cell);
  }
  head.append(header);
  const body = document.createElement('tbody');
  gridState.viewRows = [];
  const term = datasheetSearchTerm();
  let displayIndex = 0;
  gridState.rows.forEach((row, rowIndex) => {
    if (!row.isNew && !datasheetRowMatches(row, term)) return;
    const viewIndex = gridState.viewRows.length;
    gridState.viewRows.push({ row, rowIndex });
    const tr = document.createElement('tr');
    if (row.isNew) tr.className = 'new-grid-row';
    const rowNumber = document.createElement('th');
    rowNumber.className = 'row-number';
    rowNumber.scope = 'row';
    rowNumber.textContent = row.isNew ? '+' : String(++displayIndex);
    tr.append(rowNumber);
    row.values.forEach((value, columnIndex) => {
      const cell = document.createElement('td');
      cell.className = 'grid-cell';
      const isBlob = value instanceof Uint8Array;
      cell.textContent = displayCellValue(value);
      cell.contentEditable = Boolean(gridState.keyMode && !isBlob);
      cell.spellcheck = false;
      cell.dataset.row = String(viewIndex);
      cell.dataset.column = String(columnIndex);
      if (isBlob) cell.classList.add('blob-cell');
      if (row.isNew) cell.setAttribute('aria-label', `New row, ${gridState.columns[columnIndex].name}`);
      tr.append(cell);
    });
    body.append(tr);
  });
  table.append(head, body);
  container.append(table);
  drawingGrid = false;
  updateDatasheetRowCount();
}

function ensureGridViewRow(viewIndex) {
  while (gridState.viewRows.length <= viewIndex) {
    let row = gridState.rows.at(-1);
    if (!row?.isNew || gridState.viewRows.some((entry) => entry.row === row)) {
      row = { key: null, values: gridState.columns.map(() => ''), original: null, touched: new Set(), isNew: true };
      gridState.rows.push(row);
    }
    gridState.viewRows.push({ row, rowIndex: gridState.rows.indexOf(row) });
  }
  return gridState.viewRows[viewIndex].row;
}

function cellInput(event) {
  const cell = event.target.closest('.grid-cell');
  if (!cell || !gridState) return;
  const row = ensureGridViewRow(Number(cell.dataset.row));
  if (!row) return;
  const columnIndex = Number(cell.dataset.column);
  row.values[columnIndex] = cell.textContent;
  row.touched.add(columnIndex);
}

async function persistGridRows(rowIndexes, storage, focusTarget = null) {
  const rowsToSave = [...new Set(rowIndexes)].map((index) => gridState.viewRows[index]?.row).filter((row) => row && (row.isNew ? row.touched.size > 0 : row.values.some((value, index) => value !== displayCellValue(row.original[index]))));
  if (!rowsToSave.length) return;
  const tableName = gridState.table;
  const schema = gridState.columns;
  try {
    db.run('SAVEPOINT spreadsheet_edit;');
    const insertedRows = [];
    const updatedRows = [];
    for (const row of rowsToSave) {
      if (row.isNew) {
        if (!row.touched.size) continue;
        const indexes = [...row.touched].filter((index) => !(schema[index].primaryKey > 0
          && String(schema[index].type).toUpperCase() === 'INTEGER'
          && row.values[index] === ''));
        const sql = indexes.length
          ? `INSERT INTO ${quoteIdentifier(tableName)} (${indexes.map((index) => quoteIdentifier(schema[index].name)).join(', ')}) VALUES (${indexes.map(() => '?').join(', ')});`
          : `INSERT INTO ${quoteIdentifier(tableName)} DEFAULT VALUES;`;
        const statement = db.prepare(sql);
        try { statement.run(indexes.map((index) => row.values[index])); }
        finally { statement.free(); }
        const key = gridState.keyMode === 'rowid'
          ? [db.exec('SELECT last_insert_rowid();')[0].values[0][0]]
          : gridState.keyColumns.map((column) => row.values[schema.findIndex((item) => item.name === column.name)]);
        insertedRows.push({ row, key });
        continue;
      }
      const changed = schema.map((column, index) => index).filter((index) => !(row.original[index] instanceof Uint8Array) && row.values[index] !== displayCellValue(row.original[index]));
      if (!changed.length) continue;
      const whereColumns = gridState.keyMode === 'rowid' ? [gridState.rowidColumn] : gridState.keyColumns.map((column) => column.name);
      const whereValues = row.key;
      const updateSql = `UPDATE ${quoteIdentifier(tableName)} SET ${changed.map((index) => `${quoteIdentifier(schema[index].name)} = ?`).join(', ')} WHERE ${whereColumns.map((column) => `${quoteIdentifier(column)} IS ?`).join(' AND ')};`;
      const statement = db.prepare(updateSql);
      try { statement.run([...changed.map((index) => row.values[index]), ...whereValues]); }
      finally { statement.free(); }
      updatedRows.push(row);
    }
    db.run('RELEASE spreadsheet_edit;');
    for (const { row, key } of insertedRows) {
      row.isNew = false;
      row.key = key;
      row.original = row.values.slice();
      row.touched.clear();
    }
    for (const row of updatedRows) {
      row.original = row.values.slice();
      row.touched.clear();
      if (gridState.keyMode === 'primary-key') {
        row.key = gridState.keyColumns.map((column) => row.values[schema.findIndex((item) => item.name === column.name)]);
      }
    }
    await saveDatabase(storage);
    window.invalidateReportDesignPreview?.();
    elements.dataFeedback.textContent = 'Changes saved';
    elements.dataFeedback.classList.remove('is-error');
    const hasActiveView = Boolean(datasheetSearchTerm() || document.querySelector('#datasheet-sort-field').value);
    if (insertedRows.length || (updatedRows.length && hasActiveView)) {
      renderDataGrid();
      if (focusTarget) {
        elements.dataGrid.querySelector(`[data-row="${focusTarget.row}"][data-column="${focusTarget.column}"]`)?.focus();
      }
    }
  } catch (error) {
    try { db.run('ROLLBACK TO spreadsheet_edit; RELEASE spreadsheet_edit;'); } catch { /* The savepoint may already be released. */ }
    elements.dataFeedback.textContent = error.message || 'The data could not be saved.';
    elements.dataFeedback.classList.add('is-error');
  }
}

function cellBlur(event, storage) {
  if (drawingGrid) return;
  const cell = event.target.closest('.grid-cell');
  if (cell && gridState) {
    const nextCell = event.relatedTarget?.closest?.('.grid-cell');
    const focusTarget = nextCell ? { row: Number(nextCell.dataset.row), column: Number(nextCell.dataset.column) } : null;
    persistGridRows([Number(cell.dataset.row)], storage, focusTarget);
  }
}

function cellPaste(event, storage) {
  const cell = event.target.closest('.grid-cell');
  if (!cell || !gridState) return;
  const text = event.clipboardData?.getData('text/plain');
  if (!text || (!text.includes('\t') && !/[\r\n]/.test(text))) return;
  event.preventDefault();
  let matrix;
  try {
    matrix = parseCsv(text, '\t');
  } catch (error) {
    elements.dataFeedback.textContent = error.message || 'The pasted range could not be read.';
    elements.dataFeedback.classList.add('is-error');
    return;
  }
  const startRow = Number(cell.dataset.row);
  const startColumn = Number(cell.dataset.column);
  const pasteWidth = Math.max(...matrix.map((row) => row.length));
  if (startColumn + pasteWidth > gridState.columns.length) {
    elements.dataFeedback.textContent = `The pasted range is wider than ${gridState.table}; no cells were changed.`;
    elements.dataFeedback.classList.add('is-error');
    return;
  }
  const changedRows = new Set();
  matrix.forEach((values, rowOffset) => {
    const rowIndex = startRow + rowOffset;
    const row = ensureGridViewRow(rowIndex);
    values.forEach((value, columnOffset) => {
      const columnIndex = startColumn + columnOffset;
      if (columnIndex >= gridState.columns.length) return;
      row.values[columnIndex] = value;
      row.touched.add(columnIndex);
    });
    changedRows.add(rowIndex);
  });
  elements.dataFeedback.classList.remove('is-error');
  elements.dataFeedback.textContent = 'Pasting data…';
  persistGridRows([...changedRows], storage);
  drawDataGrid();
}

function getRelationships() {
  return listTables().flatMap((childTable) => foreignKeyGroups(childTable).map((key) => ({
    ...key,
    key: JSON.stringify([childTable, key.from, key.targetTable, key.to]),
  })));
}

function queryDesignFeedback(message, isError = false) {
  const feedback = document.querySelector('#query-design-feedback');
  feedback.textContent = message;
  feedback.classList.toggle('is-error', isError);
}

function addQueryDesignTable(table) {
  if (!listTables().includes(table)) return;
  if (!queryDesignTables.includes(table)) queryDesignTables.push(table);
  renderQueryDesigner();
}

function addQueryDesignField(table, field) {
  if (!queryDesignTables.includes(table)) addQueryDesignTable(table);
  const schemaField = getTableSchema(table).find((column) => column.name === field);
  if (!schemaField) return;
  const duplicate = queryDesignFields.some((item) => item.table === table && item.field === field);
  const numericField = /INT|REAL|FLOA|DOUB|NUM|DEC/i.test(schemaField.type);
  queryDesignFields.push({ table, field, total: queryDesignTotalsMode && duplicate && numericField ? 'SUM' : 'GROUP BY', sort: '', show: true, criteria: '' });
  renderQueryDesignGrid();
  queryDesignFeedback(`${duplicate ? 'Added another instance of' : 'Added'} ${table}.${field}. Set each instance’s Total independently.`);
}

function buildQueryDesignFromClause() {
  if (!queryDesignTables.length) throw new Error('Add at least one table to the design surface.');
  const root = queryDesignTables[0];
  const joined = new Set([root]);
  const from = [`FROM ${quoteIdentifier(root)}`];
  while (joined.size < queryDesignTables.length) {
    let match = null;
    for (const relationship of getRelationships()) {
      const childReady = joined.has(relationship.childTable) && queryDesignTables.includes(relationship.targetTable) && !joined.has(relationship.targetTable);
      const parentReady = joined.has(relationship.targetTable) && queryDesignTables.includes(relationship.childTable) && !joined.has(relationship.childTable);
      if (childReady || parentReady) { match = { relationship, next: childReady ? relationship.targetTable : relationship.childTable }; break; }
    }
    if (!match) {
      const next = queryDesignTables.find((table) => !joined.has(table));
      from.push(`CROSS JOIN ${quoteIdentifier(next)}`);
      joined.add(next);
      continue;
    }
    const { relationship, next } = match;
    const conditions = relationship.from.map((field, index) => `${quoteIdentifier(relationship.childTable)}.${quoteIdentifier(field)} = ${quoteIdentifier(relationship.targetTable)}.${quoteIdentifier(relationship.to[index])}`);
    from.push(`LEFT JOIN ${quoteIdentifier(next)} ON ${conditions.join(' AND ')}`);
    joined.add(next);
  }
  return from.join('\n');
}

function validateCalculatedQueryField(name, expression) {
  const cleanName = name.trim();
  const cleanExpression = expression.trim();
  if (!cleanName) throw new Error('Enter a name for the calculated field.');
  if (cleanName.length > 100) throw new Error('The calculated field name must be 100 characters or fewer.');
  if (queryDesignFields.some((item) => item.field.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) {
    throw new Error('Choose a result name that is different from the fields already in the query grid.');
  }
  if (!cleanExpression) throw new Error('Enter an expression for the calculated field.');
  if (cleanExpression.length > 1000) throw new Error('The expression must be 1,000 characters or fewer.');
  if (/[;\u0000]|--|\/\*|\*\//.test(cleanExpression)) throw new Error('Enter one SQLite expression without comments or statement separators.');
  const sql = `SELECT (${cleanExpression}) AS ${quoteIdentifier(cleanName)}\n${buildQueryDesignFromClause()}\nLIMIT 0;`;
  try {
    db.exec(sql);
  } catch (error) {
    throw new Error(`The expression could not be validated: ${error.message}`);
  }
  return { name: cleanName, expression: cleanExpression };
}

function addCalculatedQueryField(name, expression) {
  const field = validateCalculatedQueryField(name, expression);
  queryDesignFields.push({
    isCalculated: true,
    table: 'Calculated field',
    field: field.name,
    expression: field.expression,
    total: 'GROUP BY',
    sort: '',
    show: true,
    criteria: '',
  });
  renderQueryDesignGrid();
  queryDesignFeedback(`Added calculated field ${field.name}. It exists in query results only.`);
}

function renderQueryDesigner() {
  const sources = document.querySelector('#query-design-table-sources');
  sources.replaceChildren();
  const tables = listTables();
  if (!tables.length) {
    const empty = document.createElement('li'); empty.className = 'query-source-empty'; empty.textContent = 'No user tables in this database.'; sources.append(empty);
  }
  for (const table of tables) {
    const item = document.createElement('li'); item.className = 'query-source-item'; item.draggable = true; item.dataset.queryTable = table;
    const name = document.createElement('span'); name.textContent = table;
    const add = document.createElement('button'); add.type = 'button'; add.textContent = queryDesignTables.includes(table) ? 'Added' : 'Add'; add.disabled = queryDesignTables.includes(table); add.addEventListener('click', () => addQueryDesignTable(table));
    item.append(name, add); sources.append(item);
  }
  const cards = document.querySelector('#query-design-cards'); cards.replaceChildren();
  const stage = document.querySelector('#query-design-stage');
  document.querySelector('#query-design-empty').hidden = queryDesignTables.length > 0;
  let maxX = 0; let maxY = 0;
  queryDesignTables.forEach((table, index) => {
    const position = queryDesignPositions[table] || { x: 20 + (index % 4) * 300, y: 20 + Math.floor(index / 4) * 225 }; queryDesignPositions[table] = position;
    const card = document.createElement('section'); card.className = 'query-table-card'; card.dataset.queryTableCard = table; card.style.left = `${position.x}px`; card.style.top = `${position.y}px`;
    const heading = document.createElement('div'); heading.className = 'query-table-card-heading'; heading.dataset.moveQueryTable = table; heading.textContent = `▦  ${table}`; heading.title = 'Drag to move table';
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'query-table-remove'; remove.textContent = '×'; remove.title = `Remove ${table} from query`; remove.setAttribute('aria-label', `Remove ${table} from query`); remove.addEventListener('pointerdown', (event) => event.stopPropagation()); remove.addEventListener('click', () => { queryDesignTables = queryDesignTables.filter((item) => item !== table); queryDesignFields = queryDesignFields.filter((item) => item.table !== table); renderQueryDesigner(); }); heading.append(remove); card.append(heading);
    for (const field of getTableSchema(table)) {
      const row = document.createElement('div'); row.className = 'query-table-field'; row.setAttribute('role', 'button'); row.tabIndex = 0; row.draggable = true; row.dataset.queryFieldTable = table; row.dataset.queryFieldName = field.name; row.title = `Double-click or drag ${table}.${field.name} into the query grid`;
      const marker = document.createElement('span'); marker.textContent = field.primaryKey ? '🔑' : '·'; const fieldName = document.createElement('span'); fieldName.textContent = field.name; const type = document.createElement('small'); type.textContent = field.type || ''; row.append(marker, fieldName, type); row.addEventListener('dblclick', () => addQueryDesignField(table, field.name)); row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); addQueryDesignField(table, field.name); } }); card.append(row);
      row.addEventListener('dragstart', (event) => {
        const payload = JSON.stringify({ table, field: field.name });
        event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('application/x-query-field', payload); event.dataTransfer.setData('text/plain', payload);
      });
    }
    cards.append(card); maxX = Math.max(maxX, position.x + 235); maxY = Math.max(maxY, position.y + 100 + getTableSchema(table).length * 32);
  });
  stage.style.width = `${Math.max(680, maxX + 30)}px`; stage.style.height = `${Math.max(250, maxY + 30)}px`;
  renderQueryDesignLines(); renderQueryDesignGrid();
}

function renderQueryDesignLines() {
  const stage = document.querySelector('#query-design-stage'); const svg = document.querySelector('#query-design-lines');
  svg.setAttribute('width', String(stage.scrollWidth)); svg.setAttribute('height', String(stage.scrollHeight)); svg.setAttribute('viewBox', `0 0 ${stage.scrollWidth} ${stage.scrollHeight}`); svg.replaceChildren();
  for (const relationship of getRelationships()) {
    if (!queryDesignTables.includes(relationship.childTable) || !queryDesignTables.includes(relationship.targetTable)) continue;
    const child = [...stage.querySelectorAll('.query-table-card')].find((card) => card.dataset.queryTableCard === relationship.childTable);
    const parent = [...stage.querySelectorAll('.query-table-card')].find((card) => card.dataset.queryTableCard === relationship.targetTable); if (!child || !parent) continue;
    const childField = [...child.querySelectorAll('.query-table-field')].find((row) => row.dataset.queryFieldName === relationship.from[0]);
    const parentField = [...parent.querySelectorAll('.query-table-field')].find((row) => row.dataset.queryFieldName === relationship.to[0]);
    if (!childField || !parentField) continue;
    const childBox = childField.getBoundingClientRect(); const parentBox = parentField.getBoundingClientRect(); const stageBox = stage.getBoundingClientRect();
    const childCenter = childBox.left + childBox.width / 2; const parentCenter = parentBox.left + parentBox.width / 2; const towardRight = childCenter >= parentCenter;
    const startX = (towardRight ? parentBox.right : parentBox.left) - stageBox.left + stage.scrollLeft;
    const startY = parentBox.top + parentBox.height / 2 - stageBox.top + stage.scrollTop;
    const endX = (towardRight ? childBox.left : childBox.right) - stageBox.left + stage.scrollLeft;
    const endY = childBox.top + childBox.height / 2 - stageBox.top + stage.scrollTop;
    const bend = Math.max(38, Math.abs(endX - startX) * 0.4);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', `M ${startX} ${startY} C ${startX + (towardRight ? bend : -bend)} ${startY}, ${endX - (towardRight ? bend : -bend)} ${endY}, ${endX} ${endY}`); path.setAttribute('class', 'query-relationship-line');
    const one = document.createElementNS('http://www.w3.org/2000/svg', 'text'); one.setAttribute('class', 'query-relationship-cardinality'); one.setAttribute('x', String(startX + (towardRight ? 5 : -15))); one.setAttribute('y', String(startY + 4)); one.textContent = '1';
    const many = document.createElementNS('http://www.w3.org/2000/svg', 'text'); many.setAttribute('class', 'query-relationship-cardinality'); many.setAttribute('x', String(endX + (towardRight ? -15 : 5))); many.setAttribute('y', String(endY + 4)); many.textContent = '∞';
    svg.append(path, one, many);
  }
}

function reorderQueryDesignField(sourceIndex, destinationIndex) {
  if (sourceIndex < 0 || sourceIndex >= queryDesignFields.length || destinationIndex < 0 || destinationIndex >= queryDesignFields.length || sourceIndex === destinationIndex) return;
  const [field] = queryDesignFields.splice(sourceIndex, 1);
  queryDesignFields.splice(destinationIndex, 0, field);
  renderQueryDesignGrid();
  const row = document.querySelector(`#query-design-grid-body [data-query-field-index="${destinationIndex}"]`);
  row?.focus();
  queryDesignFeedback(`Moved ${field.field} to position ${destinationIndex + 1}.`);
}

function renderQueryDesignGrid() {
  const body = document.querySelector('#query-design-grid-body'); body.replaceChildren();
  document.querySelector('#query-design-total-heading').hidden = !queryDesignTotalsMode;
  const totalsButton = document.querySelector('#query-design-totals');
  totalsButton.setAttribute('aria-pressed', String(queryDesignTotalsMode));
  totalsButton.classList.toggle('is-active', queryDesignTotalsMode);
  document.querySelector('#query-design-field-count').textContent = `${queryDesignFields.length} ${queryDesignFields.length === 1 ? 'field' : 'fields'}`;
  if (!queryDesignFields.length) { const row = document.createElement('tr'); const cell = document.createElement('td'); cell.className = 'query-grid-empty'; cell.colSpan = 7; cell.textContent = 'Drag a field from a table card into this grid.'; row.append(cell); body.append(row); return; }
  queryDesignFields.forEach((item, index) => {
    const row = document.createElement('tr'); const field = document.createElement('td'); field.className = 'query-grid-field'; field.textContent = item.field; const table = document.createElement('td'); table.className = 'query-grid-table'; table.textContent = item.table;
    if (!item.total) item.total = 'GROUP BY';
    const totalCell = document.createElement('td'); totalCell.hidden = !queryDesignTotalsMode;
    const total = document.createElement('select'); total.className = 'query-grid-control query-grid-total'; total.setAttribute('aria-label', `Total for ${item.field}, instance ${index + 1}`);
    [['GROUP BY', 'Group By'], ['SUM', 'Sum'], ['AVG', 'Avg'], ['COUNT', 'Count'], ['MIN', 'Min'], ['MAX', 'Max'], ['WHERE', 'Where']].forEach(([value, label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; total.append(option); });
    total.value = item.total; total.addEventListener('change', () => { item.total = total.value; renderQueryDesignGrid(); }); totalCell.append(total);
    const sortCell = document.createElement('td'); const sort = document.createElement('select'); sort.className = 'query-grid-control'; sort.setAttribute('aria-label', `Sort ${item.field}, instance ${index + 1}`); [['', 'No sorting'], ['ASC', 'Ascending'], ['DESC', 'Descending']].forEach(([value, label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; sort.append(option); }); sort.value = item.sort; sort.disabled = queryDesignTotalsMode && item.total === 'WHERE'; sort.addEventListener('change', () => { item.sort = sort.value; }); sortCell.append(sort);
    const showCell = document.createElement('td'); const show = document.createElement('input'); show.type = 'checkbox'; show.checked = queryDesignTotalsMode && item.total === 'WHERE' ? false : item.show; show.disabled = queryDesignTotalsMode && item.total === 'WHERE'; show.setAttribute('aria-label', `Show ${item.field}, instance ${index + 1}`); show.addEventListener('change', () => { item.show = show.checked; }); showCell.append(show);
    const criteriaCell = document.createElement('td'); const criteria = document.createElement('input'); criteria.className = 'query-grid-control query-grid-criteria'; criteria.type = 'text'; criteria.value = item.criteria; criteria.placeholder = "e.g. >= 10, LIKE 'A%', IS NULL"; criteria.setAttribute('aria-label', `Criteria for ${item.field}, instance ${index + 1}`); criteria.addEventListener('input', () => { item.criteria = criteria.value; }); criteriaCell.append(criteria);
    const removeCell = document.createElement('td'); const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'query-grid-remove'; remove.textContent = '×'; remove.title = `Remove ${item.field}`; remove.setAttribute('aria-label', `Remove ${item.field}, instance ${index + 1}`); remove.addEventListener('click', () => { queryDesignFields.splice(index, 1); renderQueryDesignGrid(); }); removeCell.append(remove);
    row.classList.add('query-grid-row');
    row.dataset.queryFieldIndex = String(index);
    row.draggable = true;
    row.tabIndex = 0;
    row.title = 'Drag to reorder · use Alt + Arrow Up or Down to move this field';
    row.addEventListener('dragstart', (event) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-query-grid-row', String(index));
      row.classList.add('is-dragging');
    });
    row.addEventListener('dragend', () => {
      body.querySelectorAll('.is-dragging, .drop-before, .drop-after').forEach((element) => element.classList.remove('is-dragging', 'drop-before', 'drop-after'));
    });
    row.addEventListener('dragover', (event) => {
      if (!event.dataTransfer.types.includes('application/x-query-grid-row')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const bounds = row.getBoundingClientRect();
      const before = event.clientY < bounds.top + bounds.height / 2;
      row.classList.toggle('drop-before', before);
      row.classList.toggle('drop-after', !before);
    });
    row.addEventListener('dragleave', (event) => {
      if (!row.contains(event.relatedTarget)) row.classList.remove('drop-before', 'drop-after');
    });
    row.addEventListener('drop', (event) => {
      const sourceIndex = Number(event.dataTransfer.getData('application/x-query-grid-row'));
      if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= queryDesignFields.length) return;
      event.preventDefault();
      const bounds = row.getBoundingClientRect();
      const before = event.clientY < bounds.top + bounds.height / 2;
      let destinationIndex = index + (before ? 0 : 1);
      if (sourceIndex < destinationIndex) destinationIndex -= 1;
      reorderQueryDesignField(sourceIndex, destinationIndex);
    });
    row.addEventListener('keydown', (event) => {
      if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      reorderQueryDesignField(index, index + (event.key === 'ArrowUp' ? -1 : 1));
    });
    row.append(field, table, totalCell, sortCell, showCell, criteriaCell, removeCell); body.append(row);
  });
}

function queryCriteriaExpression(field, criteria, expressionOverride = '') {
  const value = criteria.trim(); if (!value) return '';
  const column = expressionOverride || `${quoteIdentifier(field.table)}.${quoteIdentifier(field.field)}`;
  if (/^(?:IS\s+NOT\s+NULL|IS\s+NULL|NOT\s+NULL|NULL)$/i.test(value)) return `${column} ${value.toUpperCase().replace(/^NULL$/, 'IS NULL').replace(/^NOT\s+NULL$/, 'IS NOT NULL')}`;
  if (/^(?:=|<>|!=|>=|<=|>|<|IS\b|LIKE\b|NOT\s+LIKE\b|GLOB\b|NOT\s+GLOB\b|MATCH\b|IN\s*\(|NOT\s+IN\s*\(|BETWEEN\b|NOT\s+BETWEEN\b)/i.test(value)) return `${column} ${value}`;
  if (/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return `${column} = ${value}`;
  return `${column} = '${value.replace(/^'(.*)'$/s, '$1').replace(/'/g, "''")}'`;
}

function readJoinTableName(rawName) {
  return rawName.trim()
    .replace(/^\[/, '').replace(/\]$/, '')
    .replace(/^`/, '').replace(/`$/, '')
    .replace(/^"/, '').replace(/"$/, '')
    .replaceAll('""', '"').replaceAll('``', '`')
    .split('.').pop() || '';
}

function createJoinDiagram(joinType, index, leftTable, rightTable, description, label) {
  const card = document.createElement('div');
  card.className = 'join-diagram-card';
  const heading = document.createElement('div');
  heading.className = 'join-diagram-card-heading';
  const name = document.createElement('span'); name.textContent = label;
  heading.append(name);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('join-diagram');
  svg.dataset.joinType = joinType;
  svg.setAttribute('viewBox', '0 0 160 88');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${joinType} join: ${description}`);
  const leftMask = `join-left-only-${index}`;
  const rightMask = `join-right-only-${index}`;
  const overlapClip = `join-overlap-${index}`;
  const svgNS = 'http://www.w3.org/2000/svg';
  const defs = document.createElementNS(svgNS, 'defs');
  defs.innerHTML = `<mask id="${leftMask}" maskUnits="userSpaceOnUse" x="0" y="0" width="160" height="88"><rect width="160" height="88" fill="black"/><circle cx="58" cy="42" r="31" fill="white"/><circle cx="102" cy="42" r="31" fill="black"/></mask><mask id="${rightMask}" maskUnits="userSpaceOnUse" x="0" y="0" width="160" height="88"><rect width="160" height="88" fill="black"/><circle cx="102" cy="42" r="31" fill="white"/><circle cx="58" cy="42" r="31" fill="black"/></mask><clipPath id="${overlapClip}"><circle cx="102" cy="42" r="31"/></clipPath>`;
  svg.append(defs);
  const addCircle = (className, cx, options = {}) => {
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('class', className); circle.setAttribute('cx', String(cx)); circle.setAttribute('cy', '42'); circle.setAttribute('r', '31');
    for (const [key, value] of Object.entries(options)) circle.setAttribute(key, value.replace('{leftMask}', leftMask).replace('{rightMask}', rightMask).replace('{overlapClip}', overlapClip));
    svg.append(circle);
  };
  addCircle('join-set', 58); addCircle('join-set', 102);
  addCircle('join-region join-region-left', 58, { mask: 'url(#{leftMask})' });
  addCircle('join-region join-region-right', 102, { mask: 'url(#{rightMask})' });
  addCircle('join-region join-region-overlap', 58, { 'clip-path': 'url(#{overlapClip})' });
  addCircle('join-region join-region-left-whole', 58); addCircle('join-region join-region-right-whole', 102);
  addCircle('join-outline', 58); addCircle('join-outline', 102);
  const addText = (className, x, text) => {
    const element = document.createElementNS(svgNS, 'text'); element.setAttribute('class', className); element.setAttribute('x', String(x)); element.setAttribute('y', '46'); element.textContent = text; svg.append(element);
  };
  addText('join-set-label', 40, 'A'); addText('join-set-label', 120, 'B'); addText('join-cross-mark', 80, '×');
  const labels = document.createElement('div'); labels.className = 'join-table-labels';
  const left = document.createElement('span'); left.textContent = `A · ${leftTable || 'left input'}`;
  const right = document.createElement('span'); right.textContent = `B · ${rightTable || 'joined input'}`;
  labels.append(left, right);
  const descriptionElement = document.createElement('p'); descriptionElement.className = 'join-guide-description'; descriptionElement.textContent = description;
  card.append(heading, svg, labels, descriptionElement);
  return card;
}

function updateJoinDiagram() {
  const sql = elements.sqlInput.value;
  const searchable = sql
    .replace(/'(?:''|[^'])*'/g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  const joinPattern = /\b(?:(FULL(?:\s+OUTER)?|LEFT(?:\s+OUTER)?|RIGHT(?:\s+OUTER)?|INNER|CROSS)\s+)?JOIN\s+([^\s,;(]+)/gi;
  const joins = [...searchable.matchAll(joinPattern)].map((match) => ({
    type: (match[1] || 'INNER').replace(/\s+OUTER/i, '').toUpperCase(),
    table: readJoinTableName(match[2]),
  }));
  const fromMatch = searchable.match(/\bFROM\s+([^\s,;(]+)/i);
  const leftTable = fromMatch ? readJoinTableName(fromMatch[1]) : '';
  const container = document.querySelector('#join-diagrams');
  const previousScroll = container.scrollTop;
  container.replaceChildren();
  const summary = document.querySelector('#join-summary');
  const descriptions = {
    INNER: 'Only rows where A and B match.',
    LEFT: 'All rows from A, plus matching rows from B.',
    RIGHT: 'All rows from B, plus matching rows from A.',
    FULL: 'All rows from A and B; matching rows combine.',
    CROSS: 'Every possible A × B row combination.',
  };
  if (!joins.length) {
    summary.textContent = 'No JOIN';
    container.append(createJoinDiagram('NONE', 0, 'Left input', 'Joined input', 'Add a JOIN to see which rows the query keeps.', 'No JOIN detected'));
    container.scrollTop = 0;
    return;
  }
  summary.textContent = `${joins.length} ${joins.length === 1 ? 'JOIN' : 'JOINs'}`;
  joins.forEach((join, index) => {
    const leftInput = index === 0 ? (leftTable || 'left input') : 'previous result';
    const explanation = descriptions[join.type] || 'Rows are combined according to this join.';
    container.append(createJoinDiagram(join.type, index, leftInput, join.table, explanation, `${index + 1}. ${join.type} JOIN`));
  });
  container.scrollTop = previousScroll;
}

function buildQueryDesignSql() {
  const activeTotals = queryDesignTotalsMode;
  const outputFields = queryDesignFields.filter((item) => item.show && !(activeTotals && item.total === 'WHERE'));
  if (!queryDesignTables.length) throw new Error('Add at least one table to the design surface.');
  if (!outputFields.length) throw new Error('Select Show for at least one output field.');
  const sourceColumn = (item) => item.isCalculated
    ? `(${item.expression})`
    : `${quoteIdentifier(item.table)}.${quoteIdentifier(item.field)}`;
  const selectExpression = (item) => {
    if (!activeTotals) return sourceColumn(item);
    if (item.total === 'SUM' || item.total === 'AVG' || item.total === 'COUNT' || item.total === 'MIN' || item.total === 'MAX') return `${item.total}(${sourceColumn(item)})`;
    return sourceColumn(item);
  };
  const outputAliases = new Set();
  const select = outputFields.map((item) => {
    const sourceCount = outputFields.filter((candidate) => candidate.table === item.table && candidate.field === item.field).length;
    const aggregate = activeTotals && ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'].includes(item.total);
    const aggregateName = item.total[0] + item.total.slice(1).toLowerCase();
    const baseAlias = aggregate && (item.isCalculated || sourceCount > 1) ? `${aggregateName} of ${item.field}`
      : sourceCount > 1 && outputAliases.has(item.field) ? `${item.table}.${item.field}`
        : item.field;
    let alias = baseAlias;
    let suffix = 2;
    while (outputAliases.has(alias)) alias = `${baseAlias} (${suffix++})`;
    outputAliases.add(alias);
    return `${selectExpression(item)} AS ${quoteIdentifier(alias)}`;
  });
  const root = queryDesignTables[0]; const joined = new Set([root]); const from = [`FROM ${quoteIdentifier(root)}`];
  while (joined.size < queryDesignTables.length) {
    let match = null;
    for (const relationship of getRelationships()) {
      const childReady = joined.has(relationship.childTable) && queryDesignTables.includes(relationship.targetTable) && !joined.has(relationship.targetTable);
      const parentReady = joined.has(relationship.targetTable) && queryDesignTables.includes(relationship.childTable) && !joined.has(relationship.childTable);
      if (childReady || parentReady) { match = { relationship, next: childReady ? relationship.targetTable : relationship.childTable }; break; }
    }
    if (!match) { const next = queryDesignTables.find((table) => !joined.has(table)); from.push(`CROSS JOIN ${quoteIdentifier(next)}`); joined.add(next); continue; }
    const { relationship, next } = match; const conditions = relationship.from.map((field, index) => `${quoteIdentifier(relationship.childTable)}.${quoteIdentifier(field)} = ${quoteIdentifier(relationship.targetTable)}.${quoteIdentifier(relationship.to[index])}`);
    from.push(`LEFT JOIN ${quoteIdentifier(next)} ON ${conditions.join(' AND ')}`); joined.add(next);
  }
  const where = queryDesignFields
    .filter((item) => !activeTotals || item.total === 'WHERE' || item.total === 'GROUP BY')
    .map((item) => queryCriteriaExpression(item, item.criteria, sourceColumn(item))).filter(Boolean);
  const groupBy = activeTotals ? queryDesignFields.filter((item) => item.total === 'GROUP BY').map(sourceColumn) : [];
  const having = activeTotals ? queryDesignFields
    .filter((item) => ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'].includes(item.total))
    .map((item) => queryCriteriaExpression(item, item.criteria, selectExpression(item))).filter(Boolean) : [];
  const orderBy = queryDesignFields.filter((item) => item.sort && (!activeTotals || item.total !== 'WHERE')).map((item) => `${selectExpression(item)} ${item.sort}`);
  return `SELECT ${select.join(',\n       ')}\n${from.join('\n')}\n${where.length ? `WHERE ${where.join('\n  AND ')}\n` : ''}${groupBy.length ? `GROUP BY ${groupBy.join(', ')}\n` : ''}${having.length ? `HAVING ${having.join('\n  AND ')}\n` : ''}${orderBy.length ? `ORDER BY ${orderBy.join(', ')};` : ';'}`;
}

function relationshipFeedback(message, isError = false) {
  const feedback = document.querySelector('#relationships-feedback');
  feedback.textContent = message;
  feedback.classList.toggle('is-error', isError);
}

function relationshipFieldElement(table, field, canReference, foreignKey) {
  const row = document.createElement('div');
  row.className = 'relationship-field';
  row.dataset.relTable = table;
  row.dataset.relField = field.name;
  row.draggable = true;
  const marker = document.createElement('span');
  marker.className = 'relationship-field-marker';
  marker.textContent = field.primaryKey ? '🔑' : foreignKey ? '↳' : field.unique ? '◆' : '·';
  marker.setAttribute('aria-hidden', 'true');
  const name = document.createElement('span');
  name.className = 'relationship-field-name';
  name.textContent = field.name;
  const type = document.createElement('span');
  type.className = 'relationship-field-type';
  type.textContent = field.type || '—';
  if (foreignKey) row.classList.add('is-foreign-key');
  if (canReference) row.classList.add('is-reference-key');
  row.title = `${field.name} · ${field.type || 'no type'}${field.primaryKey ? ' · Primary key' : field.unique ? ' · Unique' : ''}`;
  row.append(marker, name, type);
  return row;
}

function renderRelationshipLines(relationships) {
  const stage = document.querySelector('#relationships-stage');
  const svg = document.querySelector('#relationship-lines');
  const bounds = stage.getBoundingClientRect();
  svg.setAttribute('width', String(stage.scrollWidth));
  svg.setAttribute('height', String(stage.scrollHeight));
  svg.setAttribute('viewBox', `0 0 ${stage.scrollWidth} ${stage.scrollHeight}`);
  svg.replaceChildren();
  for (const relationship of relationships) {
    if (!relationship.from.length || !relationship.to.length) continue;
    const source = [...stage.querySelectorAll('.relationship-field')].find((row) => row.dataset.relTable === relationship.targetTable && row.dataset.relField === relationship.to[0]);
    const target = [...stage.querySelectorAll('.relationship-field')].find((row) => row.dataset.relTable === relationship.childTable && row.dataset.relField === relationship.from[0]);
    if (!source || !target) continue;
    const start = source.getBoundingClientRect();
    const end = target.getBoundingClientRect();
    const parentCenter = start.left + start.width / 2;
    const childCenter = end.left + end.width / 2;
    const flowsRight = childCenter >= parentCenter;
    const x1 = (flowsRight ? start.right : start.left) - bounds.left + stage.scrollLeft;
    const y1 = start.top + start.height / 2 - bounds.top + stage.scrollTop;
    const x2 = (flowsRight ? end.left : end.right) - bounds.left + stage.scrollLeft;
    const y2 = end.top + end.height / 2 - bounds.top + stage.scrollTop;
    const bend = Math.max(38, Math.abs(x2 - x1) * .4);
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('relationship-connector');
    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', '0');
    group.setAttribute('aria-label', `${relationship.targetTable}.${relationship.to.join(', ')} to ${relationship.childTable}.${relationship.from.join(', ')}`);
    if (selectedRelationship === relationship.key) group.classList.add('is-selected');
    group.dataset.relationshipKey = relationship.key;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${x1 + (flowsRight ? bend : -bend)} ${y1}, ${x2 - (flowsRight ? bend : -bend)} ${y2}, ${x2} ${y2}`);
    const one = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    one.setAttribute('x', String(x1 + (flowsRight ? 5 : -15))); one.setAttribute('y', String(y1 + 4)); one.textContent = '1';
    const many = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    many.setAttribute('x', String(x2 + (flowsRight ? -15 : 5))); many.setAttribute('y', String(y2 + 4)); many.textContent = '∞';
    group.append(path, one, many);
    const selectRelationship = () => {
      selectedRelationship = relationship.key;
      document.querySelector('#remove-relationship').disabled = false;
      renderRelationshipLines(relationships);
      relationshipFeedback(`${relationship.targetTable}.${relationship.to.join(', ')} → ${relationship.childTable}.${relationship.from.join(', ')}`);
    };
    group.addEventListener('click', selectRelationship);
    group.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      selectRelationship();
    });
    svg.append(group);
  }
}

function renderRelationships() {
  const tablesHost = document.querySelector('#relationship-tables');
  const viewport = document.querySelector('#relationships-viewport');
  const stage = document.querySelector('#relationships-stage');
  const tables = listTables();
  const relationships = getRelationships();
  const childNames = new Set(relationships.map((relation) => relation.childTable));
  const parents = tables.filter((table) => !childNames.has(table));
  const children = tables.filter((table) => childNames.has(table));
  tablesHost.replaceChildren();
  document.querySelector('#remove-relationship').disabled = !relationships.some((relation) => relation.key === selectedRelationship);
  if (!tables.length) {
    relationshipFeedback('Create or import a table to begin building relationships.');
    document.querySelector('#relationship-lines').replaceChildren();
    return;
  }
  relationshipFeedback(relationships.length ? `${relationships.length} relationship${relationships.length === 1 ? '' : 's'} · Select a line to remove it.` : 'No relationships yet. Drag a primary key or unique field onto another table field.');
  const parentRow = parents.length ? parents : tables;
  const childRow = parents.length ? children : [];
  const positions = new Map();
  parentRow.forEach((table, index) => positions.set(table, relationshipPositions[table] || { x: 24 + index * 310, y: 24 }));
  childRow.forEach((table, index) => positions.set(table, relationshipPositions[table] || { x: 24 + index * 310, y: 315 }));
  tables.forEach((table) => { if (!positions.has(table)) positions.set(table, relationshipPositions[table] || { x: 24 + positions.size * 310, y: 24 }); });
  for (const [table, position] of positions) {
    relationshipPositions[table] = { x: Math.max(0, position.x), y: Math.max(0, position.y) };
  }
  const width = Math.max(viewport.clientWidth - 2, ...[...positions.values()].map((position) => position.x + 310), 640);
  const height = Math.max(390, ...[...positions.entries()].map(([table, position]) => position.y + getDesignerSchema(table).columns.length * 33 + 75));
  stage.style.width = `${width}px`;
  stage.style.height = `${height}px`;
  const foreignKeys = new Map();
  relationships.forEach((relation) => relation.from.forEach((field) => foreignKeys.set(`${relation.childTable}\0${field}`, true)));
  for (const table of tables) {
    const schema = getDesignerSchema(table);
    const card = document.createElement('article');
    card.className = 'relationship-table';
    card.dataset.relTable = table;
    card.style.left = `${positions.get(table).x}px`;
    card.style.top = `${positions.get(table).y}px`;
    const heading = document.createElement('div');
    heading.className = 'relationship-table-heading';
    heading.dataset.moveTable = table;
    heading.innerHTML = '<span aria-hidden="true">▦</span>';
    const title = document.createElement('strong');
    title.textContent = table;
    title.title = 'Drag to move this table';
    heading.append(title);
    const fieldsHost = document.createElement('div');
    fieldsHost.className = 'relationship-table-fields';
    schema.columns.forEach((field) => fieldsHost.append(relationshipFieldElement(table, field,
      field.primaryKey || field.unique, foreignKeys.has(`${table}\0${field.name}`))));
    card.append(heading, fieldsHost);
    tablesHost.append(card);
  }
  requestAnimationFrame(() => renderRelationshipLines(relationships));
}

async function persistRelationshipPositions(storage) {
  try {
    await writeStoredValue(storage, RELATIONSHIP_LAYOUT_KEY, relationshipPositions);
  } catch (error) {
    console.error(error);
    relationshipFeedback('Table positions could not be saved in this browser.', true);
  }
}

function reportFieldToken(table, field) {
  return JSON.stringify([table, field]);
}

function compareReportValues(left, right) {
  if (left === right) return 0;
  if (left === null || left === undefined || left === '') return -1;
  if (right === null || right === undefined || right === '') return 1;
  if (typeof left === 'number' && typeof right === 'number') return left < right ? -1 : left > right ? 1 : 0;
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
}

function buildReportJoins(fields, rootTable) {
  const relationships = getRelationships();
  const paths = new Map([[rootTable, null]]);
  const queue = [rootTable];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const relation of relationships) {
      const next = relation.childTable === current ? relation.targetTable
        : relation.targetTable === current ? relation.childTable : null;
      if (!next || paths.has(next)) continue;
      paths.set(next, { previous: current, relation });
      queue.push(next);
    }
  }
  const joins = [];
  const addedTables = new Set([rootTable]);
  for (const table of [...new Set(fields.map((field) => field.table))]) {
    if (addedTables.has(table)) continue;
    const path = [];
    let current = table;
    while (current !== rootTable) {
      const step = paths.get(current);
      if (!step) throw new Error(`No saved relationship path connects ${rootTable} to ${table}.`);
      path.push({ key: step.relation.key, toTable: current });
      current = step.previous;
    }
    path.reverse().forEach((join) => {
      if (!addedTables.has(join.toTable)) { joins.push(join); addedTables.add(join.toTable); }
    });
  }
  return joins;
}

function reportXmlText(value) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function reportFileBaseName() {
  const title = document.querySelector('#report-design-preview h1')?.textContent || 'DataNook report';
  return title.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/\s+/g, ' ').slice(0, 90) || 'DataNook report';
}

function downloadReportFile(blob, extension) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${reportFileBaseName()}.${extension}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getReportExportContent() {
  const preview = document.querySelector('#report-design-preview');
  if (!reportDesignPreviewReady || !preview.querySelector('.report-data-table')) throw new Error('Generate a current report preview before exporting.');
  const table = preview.querySelector('.report-data-table');
  const exportCellText = (cell) => (cell.innerText || cell.textContent || '').replace(/\s+/g, ' ').trim();
  const footer = preview.querySelector('.report-page-footer');
  return {
    title: preview.querySelector('h1')?.textContent.trim() || 'Database report',
    metadata: [...preview.querySelectorAll('.report-page-meta span, .report-page-header .report-design-output-controls span')].map((item) => item.textContent.trim()),
    pageHeader: [...table.querySelectorAll('thead .report-design-output-controls span')].map((item) => item.textContent.trim()),
    pageFooter: [...table.querySelectorAll('tfoot .report-design-output-controls span')].map((item) => item.textContent.trim()),
    footer: footer ? [...footer.children].map((item) => item.textContent.trim()).filter(Boolean) : [],
    headings: [...table.querySelectorAll('thead th')].map((cell) => cell.textContent.trim()),
    bodyRows: [...table.querySelectorAll('tbody tr')].map((row) => ({
      className: row.className,
      cells: [...row.cells].map((cell) => ({ text: exportCellText(cell), span: Number(cell.colSpan) || 1, type: cell.dataset.exportType || '', value: cell.dataset.exportValue || '' })),
    })),
  };
}

function excelColumnName(number) {
  let name = '';
  for (let value = number; value > 0; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  return name;
}

function excelCell(reference, value, style = 0) {
  if (value?.type === 'number' && Number.isFinite(Number(value.value))) return `<c r="${reference}" s="${style}"><v>${Number(value.value)}</v></c>`;
  const text = typeof value === 'object' && value !== null ? value.text : value;
  return `<c r="${reference}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${reportXmlText(text)}</t></is></c>`;
}

function createExcelWorksheet(report) {
  const count = Math.max(1, report.headings.length);
  const rows = [];
  const addRow = (cells, style = 0) => {
    const rowNumber = rows.length + 1;
    const normalized = cells.slice(0, count).map((value) => typeof value === 'object' && value !== null ? value : { text: value });
    while (normalized.length < count) normalized.push({ text: '' });
    rows.push(`<row r="${rowNumber}">${normalized.map((value, index) => excelCell(`${excelColumnName(index + 1)}${rowNumber}`, value, style)).join('')}</row>`);
  };
  addRow([report.title], 1);
  report.metadata.forEach((line) => addRow([line], 2));
  report.pageHeader.forEach((line) => addRow([line], 2));
  addRow([]);
  const headingRow = rows.length + 1;
  if (report.headings.length) addRow(report.headings, 3);
  for (const row of report.bodyRows) {
    const isGroup = row.className.includes('report-group-heading');
    const isFooter = row.className.includes('report-group-footer');
    addRow(row.cells.map((cell) => cell), isGroup ? 4 : isFooter ? 5 : 0);
  }
  report.pageFooter.forEach((line) => addRow([line], 2));
  if (report.footer.length) {
    addRow([]);
    addRow(report.footer, 2);
  }
  const lastCell = `${excelColumnName(count)}${rows.length}`;
  const autoFilter = report.headings.length ? `<autoFilter ref="A${headingRow}:${lastCell}"/>` : '';
  const pane = report.headings.length ? `<pane ySplit="${headingRow}" topLeftCell="A${headingRow + 1}" activePane="bottomLeft" state="frozen"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${Array.from({ length: count }, (_, index) => `<col min="${index + 1}" max="${index + 1}" width="22" customWidth="1"/>`).join('')}</cols><sheetData>${rows.join('')}</sheetData>${autoFilter}<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}

function createExcelStyles() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="10"/><name val="Aptos"/></font><font><b/><sz val="16"/><color rgb="FF35483C"/><name val="Aptos Display"/></font><font><i/><sz val="9"/><color rgb="FF849188"/><name val="Aptos"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDF5EF"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F1EB"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
}

async function exportReportToExcel() {
  try {
    if (typeof JSZip === 'undefined') throw new Error('Excel export could not load. Check your internet connection and reload DataNook.');
    const report = getReportExportContent();
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
    zip.folder('_rels').file('.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    zip.folder('xl').file('workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>');
    zip.folder('xl').folder('_rels').file('workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    zip.folder('xl').file('styles.xml', createExcelStyles());
    zip.folder('xl').folder('worksheets').file('sheet1.xml', createExcelWorksheet(report));
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadReportFile(blob, 'xlsx');
    reportDesignFeedback('Excel file downloaded.');
  } catch (error) {
    reportDesignFeedback(error.message || 'The Excel file could not be created.', true);
  }
}

function wordRun(text, options = {}) {
  const props = [options.bold ? '<w:b/>' : '', options.color ? `<w:color w:val="${options.color}"/>` : '', options.size ? `<w:sz w:val="${options.size}"/>` : ''].join('');
  return `<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${reportXmlText(text)}</w:t></w:r>`;
}

function wordParagraph(text, options = {}) {
  const pPr = options.spaceAfter ? `<w:pPr><w:spacing w:after="${options.spaceAfter}"/></w:pPr>` : '';
  return `<w:p>${pPr}${wordRun(text, options)}</w:p>`;
}

function createWordTable(report) {
  const columnCount = Math.max(1, report.headings.length);
  const tableWidth = 10466;
  const baseColumnWidth = Math.floor(tableWidth / columnCount);
  const columnWidths = Array.from({ length: columnCount }, (_, index) => baseColumnWidth + (index < tableWidth % columnCount ? 1 : 0));
  const grid = columnWidths.map((width) => `<w:gridCol w:w="${width}"/>`).join('');
  const rowXml = (cells, style = '') => {
    let columnIndex = 0;
    return `<w:tr>${cells.map((cell) => {
    const span = Math.max(1, Math.min(columnCount, cell.span || 1));
    const cellWidth = columnWidths.slice(columnIndex, columnIndex + span).reduce((total, width) => total + width, 0);
    columnIndex += span;
    const shading = style === 'heading' ? '<w:shd w:fill="EDF5EF"/>' : style === 'group' ? '<w:shd w:fill="E8F1EB"/>' : '';
    const bold = style === 'heading' || style === 'group' || style === 'footer';
    return `<w:tc><w:tcPr><w:tcW w:w="${cellWidth}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}${shading}<w:vAlign w:val="center"/></w:tcPr>${wordParagraph(cell.text, { bold, size: style === 'footer' ? 18 : 20, color: style === 'footer' ? '6E8074' : '39483F' })}</w:tc>`;
    }).join('')}</w:tr>`;
  };
  const rows = report.headings.length ? [rowXml(report.headings.map((text) => ({ text, span: 1 })), 'heading')] : [];
  for (const row of report.bodyRows) {
    const type = row.className.includes('report-group-heading') ? 'group' : row.className.includes('report-group-footer') ? 'footer' : '';
    rows.push(rowXml(row.cells, type));
  }
  return `<w:tbl><w:tblPr><w:tblW w:w="${tableWidth}" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D8E3DB"/><w:left w:val="single" w:sz="4" w:color="D8E3DB"/><w:bottom w:val="single" w:sz="4" w:color="D8E3DB"/><w:right w:val="single" w:sz="4" w:color="D8E3DB"/><w:insideH w:val="single" w:sz="3" w:color="E9EEEA"/><w:insideV w:val="single" w:sz="3" w:color="E9EEEA"/></w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="75" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="75" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows.join('')}</w:tbl>`;
}

async function exportReportToWord() {
  try {
    if (typeof JSZip === 'undefined') throw new Error('Word export could not load. Check your internet connection and reload DataNook.');
    const report = getReportExportContent();
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.folder('_rels').file('.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    const body = [wordParagraph(report.title, { bold: true, size: 36, color: '35483C' }), ...report.metadata.map((line) => wordParagraph(line, { size: 18, color: '849188' })), ...report.pageHeader.map((line) => wordParagraph(line, { size: 18, color: '849188' })), createWordTable(report), ...report.pageFooter.map((line) => wordParagraph(line, { size: 18, color: '849188' }))];
    if (report.footer.length) body.push(wordParagraph(report.footer.join(' · '), { size: 18, color: '89958D' }));
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838" w:orient="portrait"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    zip.folder('word').file('document.xml', documentXml);
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    downloadReportFile(blob, 'docx');
    reportDesignFeedback('Word file downloaded.');
  } catch (error) {
    reportDesignFeedback(error.message || 'The Word file could not be created.', true);
  }
}

function reportDesignFeedback(message, isError = false) {
  const feedback = document.querySelector('#report-design-feedback');
  feedback.textContent = message;
  feedback.classList.toggle('is-error', isError);
}

function fieldAffinity(type) {
  const value = String(type).toUpperCase();
  if (value.includes('INT')) return 'INTEGER';
  if (value.includes('CHAR') || value.includes('CLOB') || value.includes('TEXT')) return 'TEXT';
  if (value.includes('BLOB') || !value.trim()) return 'BLOB';
  if (value.includes('REAL') || value.includes('FLOA') || value.includes('DOUB')) return 'REAL';
  return 'NUMERIC';
}

async function createRelationship(storage, source, target) {
  const feedback = document.querySelector('#relationships-feedback');
  try {
    if (source.table === target.table) throw new Error('Choose fields from two different tables.');
    const sourceField = getDesignerSchema(source.table).columns.find((field) => field.name === source.field);
    const targetField = getDesignerSchema(target.table).columns.find((field) => field.name === target.field);
    const sourceIsKey = sourceField.primaryKey || sourceField.unique;
    const targetIsKey = targetField.primaryKey || targetField.unique;
    const parent = sourceIsKey || !targetIsKey ? source : target;
    const child = parent === source ? target : source;
    const parentField = parent === source ? sourceField : targetField;
    const childField = parent === source ? targetField : sourceField;
    if (!parentField.primaryKey && !parentField.unique) throw new Error('The referenced field must be a primary key or unique field.');
    if (fieldAffinity(parentField.type) !== fieldAffinity(childField.type)) throw new Error('Choose fields with compatible SQLite data types.');
    const existing = getRelationships();
    if (existing.some((relation) => relation.childTable === child.table && relation.from.length === 1 && relation.from[0] === child.field
      && relation.targetTable === parent.table && relation.to.length === 1 && relation.to[0] === parent.field)) {
      throw new Error('That relationship already exists.');
    }
    const orphan = db.exec(`SELECT 1 FROM ${quoteIdentifier(child.table)} AS child WHERE child.${quoteIdentifier(child.field)} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ${quoteIdentifier(parent.table)} AS parent WHERE parent.${quoteIdentifier(parent.field)} = child.${quoteIdentifier(child.field)}) LIMIT 1;`);
    if (orphan[0]?.values.length) throw new Error('Some existing values have no matching record in the parent table. Fix those values before creating this relationship.');
    if (!window.confirm(`Create a relationship from ${parent.table}.${parent.field} to ${child.table}.${child.field}? Future changes will enforce this link.`)) return;
    const key = { targetTable: parent.table, from: [child.field], to: [parent.field], onUpdate: 'CASCADE', onDelete: 'RESTRICT' };
    const definitions = [...readForeignKeyDefinitions(child.table), foreignKeyDefinition(key)];
    await saveTableDesign(storage, child.table, getDesignerSchema(child.table).columns, definitions);
    db.run('PRAGMA foreign_keys = ON;');
    selectedRelationship = null;
    renderSchema();
    renderRelationships();
    relationshipFeedback(`Created relationship: ${parent.table}.${parent.field} → ${child.table}.${child.field}.`);
  } catch (error) {
    relationshipFeedback(error.message || 'Could not create the relationship.', true);
  }
}

async function removeSelectedRelationship(storage) {
  const relationship = getRelationships().find((item) => item.key === selectedRelationship);
  if (!relationship) return;
  if (!window.confirm(`Remove the relationship from ${relationship.targetTable} to ${relationship.childTable}?`)) return;
  const definitions = foreignKeyGroups(relationship.childTable)
    .filter((key) => JSON.stringify([key.childTable, key.from, key.targetTable, key.to]) !== relationship.key)
    .map(foreignKeyDefinition);
  try {
    await saveTableDesign(storage, relationship.childTable, getDesignerSchema(relationship.childTable).columns, definitions);
    selectedRelationship = null;
    renderSchema();
    renderRelationships();
    relationshipFeedback('Relationship removed.');
  } catch (error) {
    relationshipFeedback(error.message || 'Could not remove the relationship.', true);
  }
}

function activateTab(tabName) {
  const workspace = document.querySelector('.workspace');
  workspace.dataset.activeTab = tabName;
  document.querySelectorAll('.workspace-tab').forEach((button) => {
    const selected = button.dataset.tab === tabName;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.hidden = panel.id !== `${tabName}-panel`;
  });
  if (tabName === 'data' && db) renderDataGrid();
  if (tabName === 'relationships' && db) renderRelationships();
  if (tabName === 'query-design' && db) renderQueryDesigner();
  if (tabName === 'report-design' && db) window.refreshReportDesignSources?.();
}

function addDesignerField(initial = {}) {
  const template = document.querySelector('#designer-field-template');
  const fragment = template.content.cloneNode(true);
  const row = fragment.querySelector('.designer-field-row');
  row.querySelector('[data-field="name"]').value = initial.name || '';
  const typeSelect = row.querySelector('[data-field="type"]');
  const fieldType = initial.type || 'TEXT';
  if (![...typeSelect.options].some((option) => option.value.toUpperCase() === fieldType.toUpperCase())) {
    const customType = document.createElement('option');
    customType.value = fieldType;
    customType.textContent = fieldType;
    typeSelect.append(customType);
  }
  typeSelect.value = fieldType;
  row.querySelector('[data-field="primary-key"]').checked = Boolean(initial.primaryKey);
  row.querySelector('[data-field="not-null"]').checked = Boolean(initial.notNull);
  row.querySelector('[data-field="unique"]').checked = Boolean(initial.unique);
  row.querySelector('[data-field="autoincrement"]').checked = Boolean(initial.autoincrement);
  row.querySelector('[data-field="default"]').value = initial.defaultValue || '';
  row.querySelector('.remove-field').addEventListener('click', () => row.remove());
  const primaryKey = row.querySelector('[data-field="primary-key"]');
  const autoIncrement = row.querySelector('[data-field="autoincrement"]');
  const syncAuto = () => {
    const enabled = primaryKey.checked && typeSelect.value.toUpperCase() === 'INTEGER';
    autoIncrement.disabled = !enabled;
    if (!enabled) autoIncrement.checked = false;
  };
  typeSelect.addEventListener('change', syncAuto);
  primaryKey.addEventListener('change', syncAuto);
  syncAuto();
  document.querySelector('#designer-fields').append(fragment);
}

function openFieldDesigner(tableName, fieldName) {
  const feedback = document.querySelector('#designer-feedback');
  feedback.textContent = '';
  feedback.classList.remove('is-error');
  const schema = getDesignerSchema(tableName);
  designerEditingTable = tableName;
  document.querySelector('#designer-heading').textContent = `Design ${tableName}`;
  document.querySelector('#designer-description').textContent = `Review the table structure and edit ${fieldName}.`;
  document.querySelector('#designer-table-name').value = tableName;
  document.querySelector('#designer-table-name').disabled = true;
  document.querySelector('#add-designer-field').disabled = false;
  document.querySelector('#designer-new-table').hidden = false;
  document.querySelector('#designer-cancel').hidden = false;
  document.querySelector('#designer-submit').textContent = 'Save changes';
  document.querySelector('#designer-footer-note').textContent = 'Existing records are retained when the updated structure is compatible.';
  const fields = document.querySelector('#designer-fields');
  fields.replaceChildren();
  for (const field of schema.columns) addDesignerField(field);
  if (schema.unsupportedUniqueIndex || schema.unsupportedPrimaryKey || /\b(CHECK|COLLATE|GENERATED|WITHOUT\s+ROWID|STRICT)\b/i.test(schema.ddl)) {
    feedback.textContent = 'This table uses a constraint or table option that the designer cannot safely preserve yet.';
    feedback.classList.add('is-error');
    document.querySelector('#designer-submit').disabled = true;
  } else {
    document.querySelector('#designer-submit').disabled = false;
  }
  activateTab('designer');
  requestAnimationFrame(() => {
    const row = [...fields.querySelectorAll('.designer-field-row')]
      .find((item) => item.querySelector('[data-field="name"]').value === fieldName);
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row?.classList.add('is-focused-field');
    row?.querySelector('[data-field="name"]')?.focus({ preventScroll: true });
  });
}

function resetDesignerCreateMode() {
  designerEditingTable = null;
  document.querySelector('#designer-heading').textContent = 'Create a table';
  document.querySelector('#designer-description').textContent = 'Define the columns and SQLite properties for a new table.';
  document.querySelector('#designer-table-name').disabled = false;
  document.querySelector('#designer-new-table').hidden = true;
  document.querySelector('#designer-cancel').hidden = true;
  document.querySelector('#designer-submit').textContent = 'Create table';
  document.querySelector('#designer-submit').disabled = false;
  document.querySelector('#designer-footer-note').textContent = 'Changes are saved to this browser after the table is created.';
}

function cancelTableDesign() {
  if (!designerEditingTable) return;
  document.querySelector('#designer-fields').replaceChildren();
  document.querySelector('#designer-table-name').value = '';
  const feedback = document.querySelector('#designer-feedback');
  feedback.textContent = '';
  feedback.classList.remove('is-error');
  resetDesignerCreateMode();
  addDesignerField({ name: 'id', type: 'INTEGER', primaryKey: true, autoincrement: true });
  addDesignerField({ name: 'name', type: 'TEXT' });
  activateTab('data');
}

async function deleteSelectedTable(storage) {
  const tableName = activeTable;
  if (!tableName) return;
  const feedback = elements.dataFeedback;
  feedback.textContent = '';
  feedback.classList.remove('is-error');
  const inboundRelationships = getRelationships().filter((relationship) => relationship.targetTable === tableName && relationship.childTable !== tableName);
  if (inboundRelationships.length) {
    const childTables = [...new Set(inboundRelationships.map((relationship) => relationship.childTable))];
    feedback.textContent = `Remove the relationship${childTables.length === 1 ? '' : 's'} from ${childTables.map((name) => `“${name}”`).join(', ')} before deleting this table.`;
    feedback.classList.add('is-error');
    return;
  }
  const confirmed = await askForAppConfirmation(
    'Delete table?',
    `Delete “${tableName}” and all of its records? This cannot be undone.`,
    'Delete table',
  );
  if (!confirmed || activeTable !== tableName || !listTables().includes(tableName)) return;
  try {
    db.run(`DROP TABLE ${quoteIdentifier(tableName)};`);
    const tables = listTables();
    activeTable = tables.includes('students') ? 'students' : tables[0] || null;
    queryDesignTables = queryDesignTables.filter((table) => table !== tableName);
    queryDesignFields = queryDesignFields.filter((field) => field.table !== tableName);
    delete queryDesignPositions[tableName];
    delete relationshipPositions[tableName];
    selectedRelationship = null;
    renderSchema();
    renderDataGrid();
    renderQueryDesigner();
    window.refreshReportDesignSources?.();
    window.invalidateReportDesignPreview?.();
    renderRelationships();
    await persistRelationshipPositions(storage);
    await saveDatabase(storage);
    activateTab('data');
  } catch (error) {
    feedback.textContent = error.message || `Could not delete “${tableName}”.`;
    feedback.classList.add('is-error');
  }
}

function readDesignerFields(rows) {
  const fields = rows.map((row) => ({
    name: row.querySelector('[data-field="name"]').value.trim(),
    type: row.querySelector('[data-field="type"]').value.trim(),
    primaryKey: row.querySelector('[data-field="primary-key"]').checked,
    notNull: row.querySelector('[data-field="not-null"]').checked,
    unique: row.querySelector('[data-field="unique"]').checked,
    autoincrement: row.querySelector('[data-field="autoincrement"]').checked,
    defaultValue: row.querySelector('[data-field="default"]').value.trim(),
  }));
  if (!fields.length) throw new Error('Add at least one field.');
  if (fields.some((field) => !field.name)) throw new Error('Every field needs a name.');
  if (fields.some((field) => !field.type)) throw new Error('Every field needs a data type.');
  if (new Set(fields.map((field) => field.name.toLocaleLowerCase())).size !== fields.length) throw new Error('Field names must be unique.');
  if (fields.filter((field) => field.primaryKey).length > 1) throw new Error('Choose one primary key field.');
  if (fields.some((field) => field.autoincrement && (!field.primaryKey || field.type.toUpperCase() !== 'INTEGER'))) {
    throw new Error('Auto increment requires an INTEGER primary key.');
  }
  return fields;
}

function makeFieldDefinitions(fields) {
  return fields.map((field) => {
    let definition = `${quoteIdentifier(field.name)} ${field.type}`;
    if (field.primaryKey) definition += ' PRIMARY KEY';
    if (field.autoincrement) definition += ' AUTOINCREMENT';
    if (field.notNull) definition += ' NOT NULL';
    if (field.unique) definition += ' UNIQUE';
    if (field.defaultValue) definition += ` DEFAULT ${field.defaultValue}`;
    return definition;
  });
}

function foreignKeyGroups(tableName) {
  const rows = db.exec(`PRAGMA foreign_key_list(${quoteIdentifier(tableName)});`)[0]?.values || [];
  const groups = new Map();
  for (const [id, sequence, targetTable, from, to, onUpdate, onDelete] of rows) {
    if (!groups.has(id)) groups.set(id, { id, childTable: tableName, targetTable, from: [], to: [], onUpdate, onDelete });
    groups.get(id).from[sequence] = from;
    groups.get(id).to[sequence] = to;
  }
  return [...groups.values()].map((key) => {
    if (key.to.some((column) => column === null)) {
      const primaryKey = getTableSchema(key.targetTable).filter((field) => field.primaryKey).sort((a, b) => a.primaryKey - b.primaryKey);
      key.to = key.to.map((column, index) => column === null ? primaryKey[index]?.name ?? null : column);
    }
    return key;
  });
}

function foreignKeyDefinition(key) {
    const target = key.to.every((column) => column === null) ? '' : ` (${key.to.map(quoteIdentifier).join(', ')})`;
    let definition = `FOREIGN KEY (${key.from.map(quoteIdentifier).join(', ')}) REFERENCES ${quoteIdentifier(key.targetTable)}${target}`;
    if (key.onUpdate !== 'NO ACTION') definition += ` ON UPDATE ${key.onUpdate}`;
    if (key.onDelete !== 'NO ACTION') definition += ` ON DELETE ${key.onDelete}`;
    return definition;
}

function readForeignKeyDefinitions(tableName) {
  return foreignKeyGroups(tableName).map(foreignKeyDefinition);
}

async function saveTableDesign(storage, tableName, fields, foreignKeyDefinitions = readForeignKeyDefinitions(tableName)) {
  const sourceSchema = getDesignerSchema(tableName);
  if (sourceSchema.unsupportedUniqueIndex || sourceSchema.unsupportedPrimaryKey
    || /\b(CHECK|COLLATE|GENERATED|WITHOUT\s+ROWID|STRICT)\b/i.test(sourceSchema.ddl)) {
    throw new Error('This table uses a constraint or table option the designer cannot safely preserve.');
  }
  const schemaObjects = [];
  const objectQuery = db.prepare(`SELECT sql FROM sqlite_master WHERE tbl_name = ? AND type IN ('index', 'trigger') AND sql IS NOT NULL ORDER BY type;`);
  try {
    objectQuery.bind([tableName]);
    while (objectQuery.step()) schemaObjects.push(objectQuery.get()[0]);
  } finally { objectQuery.free(); }
  let oldSequence = null;
  try {
    const sequenceQuery = db.prepare('SELECT seq FROM sqlite_sequence WHERE name = ?;');
    try { sequenceQuery.bind([tableName]); oldSequence = sequenceQuery.step() ? sequenceQuery.get()[0] : null; }
    finally { sequenceQuery.free(); }
  } catch (_) { /* sqlite_sequence is present only for AUTOINCREMENT tables. */ }

  const oldNames = new Map(sourceSchema.columns.map((field) => [field.name.toLocaleLowerCase(), field.name]));
  const retained = fields.filter((field) => oldNames.has(field.name.toLocaleLowerCase()));
  const hasIntegerPrimaryKey = sourceSchema.columns.some((field) => field.primaryKey && String(field.type).toUpperCase() === 'INTEGER');
  const newNames = new Set(fields.map((field) => field.name.toLocaleLowerCase()));
  const compositeUniqueDefinitions = (sourceSchema.compositeUniqueConstraints || []).map((columns) => {
    if (!columns.every((name) => newNames.has(name.toLocaleLowerCase()))) {
      throw new Error('Keep every field used by an existing composite UNIQUE constraint when changing this table.');
    }
    return `UNIQUE (${columns.map(quoteIdentifier).join(', ')})`;
  });
  const rowidAlias = hasIntegerPrimaryKey ? null : ['rowid', '_rowid_', 'oid']
    .find((name) => !oldNames.has(name) && !newNames.has(name));
  const count = db.exec(`SELECT COUNT(*) FROM ${quoteIdentifier(tableName)};`)[0].values[0][0];
  if (count && !retained.length) throw new Error('Keep at least one existing field so records can be retained.');
  let temporaryName = '__app_design_table__';
  while (listTables().some((name) => name.toLocaleLowerCase() === temporaryName.toLocaleLowerCase())) temporaryName += '_';
  const definitions = [...makeFieldDefinitions(fields), ...compositeUniqueDefinitions, ...foreignKeyDefinitions];
  const foreignKeysEnabled = db.exec('PRAGMA foreign_keys;')[0]?.values[0]?.[0] === 1;
  if (foreignKeysEnabled) db.run('PRAGMA foreign_keys = OFF;');
  db.run('SAVEPOINT table_design;');
  try {
    db.run(`CREATE TABLE ${quoteIdentifier(temporaryName)} (${definitions.join(', ')});`);
    if (count && retained.length) {
      const targetColumns = [...(rowidAlias ? [quoteIdentifier(rowidAlias)] : []), ...retained.map((field) => quoteIdentifier(field.name))].join(', ');
      const sourceColumns = [...(rowidAlias ? [quoteIdentifier(rowidAlias)] : []), ...retained.map((field) => quoteIdentifier(oldNames.get(field.name.toLocaleLowerCase())))].join(', ');
      db.run(`INSERT INTO ${quoteIdentifier(temporaryName)} (${targetColumns}) SELECT ${sourceColumns} FROM ${quoteIdentifier(tableName)};`);
    }
    db.run(`DROP TABLE ${quoteIdentifier(tableName)};`);
    db.run(`ALTER TABLE ${quoteIdentifier(temporaryName)} RENAME TO ${quoteIdentifier(tableName)};`);
    for (const sql of schemaObjects) db.run(sql);
    if (oldSequence !== null) {
      const sequenceUpdate = db.prepare('UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name = ?;');
      try { sequenceUpdate.run([oldSequence, tableName]); }
      finally { sequenceUpdate.free(); }
    }
    db.run('RELEASE table_design;');
  } catch (error) {
    db.run('ROLLBACK TO table_design;');
    db.run('RELEASE table_design;');
    throw error;
  } finally {
    if (foreignKeysEnabled) db.run('PRAGMA foreign_keys = ON;');
  }
  await saveDatabase(storage);
  window.invalidateReportDesignPreview?.();
}

async function createTable(storage, event) {
  event.preventDefault();
  const feedback = document.querySelector('#designer-feedback');
  feedback.textContent = '';
  feedback.classList.remove('is-error');
  const tableName = document.querySelector('#designer-table-name').value.trim();
  const rows = [...document.querySelectorAll('.designer-field-row')];
  try {
    if (designerEditingTable) {
      if (tableName !== designerEditingTable) throw new Error('The table name cannot be changed here.');
      const fields = readDesignerFields(rows);
      await saveTableDesign(storage, tableName, fields);
      feedback.textContent = 'Table design saved. Existing records were retained.';
      activeTable = tableName;
      renderSchema();
      renderDataGrid();
      document.querySelector('#designer-fields').replaceChildren();
      document.querySelector('#designer-table-name').value = '';
      resetDesignerCreateMode();
      addDesignerField({ name: 'id', type: 'INTEGER', primaryKey: true, autoincrement: true });
      addDesignerField({ name: 'name', type: 'TEXT' });
      activateTab('data');
      return;
    }
    if (!tableName) throw new Error('Enter a table name.');
    if (/^sqlite_/i.test(tableName)) throw new Error('Table names cannot start with sqlite_.');
    if (!rows.length) throw new Error('Add at least one field.');
    const duplicate = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND lower(name) = lower(?) LIMIT 1;`);
    duplicate.bind([tableName]);
    const exists = duplicate.step();
    duplicate.free();
    if (exists) throw new Error(`A table named “${tableName}” already exists.`);

    const fields = readDesignerFields(rows);
    const definitions = makeFieldDefinitions(fields);
    db.run(`CREATE TABLE ${quoteIdentifier(tableName)} (${definitions.join(', ')});`);
    activeTable = tableName;
    renderSchema();
    renderDataGrid();
    await saveDatabase(storage);
    document.querySelector('#designer-table-name').value = '';
    document.querySelector('#designer-fields').replaceChildren();
    addDesignerField({ name: 'id', type: 'INTEGER', primaryKey: true, autoincrement: true });
    addDesignerField({ name: 'name', type: 'TEXT' });
    activateTab('data');
  } catch (error) {
    feedback.textContent = error.message || (designerEditingTable ? 'The table design could not be saved.' : 'The table could not be created.');
    feedback.classList.add('is-error');
  }
}

function openImportDialog() {
  importState = null;
  document.querySelector('#import-form').reset();
  document.querySelector('#csv-preview').replaceChildren();
  document.querySelector('#import-feedback').textContent = '';
  document.querySelector('#import-feedback').classList.remove('is-error');
  refreshCsvPreview();
  document.querySelector('#import-dialog').showModal();
}

async function loadCsvFile(file) {
  importState = null;
  const feedback = document.querySelector('#import-feedback');
  feedback.textContent = '';
  feedback.classList.remove('is-error');
  if (!file) {
    refreshCsvPreview();
    return;
  }
  try {
    const text = await file.text();
    importState = { fileName: file.name, text };
    const tableName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_') || 'imported_data';
    document.querySelector('#csv-table-name').value = tableName;
    refreshCsvPreview();
  } catch (error) {
    feedback.textContent = error.message || 'The CSV file could not be read.';
    feedback.classList.add('is-error');
  }
}

async function importCsv(storage) {
  const feedback = document.querySelector('#import-feedback');
  const submit = document.querySelector('#import-submit');
  feedback.textContent = '';
  feedback.classList.remove('is-error');
  submit.disabled = true;
  try {
    if (!importState) throw new Error('Choose a CSV file first.');
    const tableName = document.querySelector('#csv-table-name').value.trim();
    if (!tableName) throw new Error('Enter a table name.');
    if (/^sqlite_/i.test(tableName)) throw new Error('Table names cannot start with sqlite_.');
    const duplicate = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND lower(name) = lower(?) LIMIT 1;`);
    duplicate.bind([tableName]);
    const exists = duplicate.step();
    duplicate.free();
    if (exists) throw new Error(`A table named “${tableName}” already exists. Choose another name; existing tables are not replaced.`);

    const { columns, rows } = csvTableData();
    const columnSql = columns.map((column) => `${quoteIdentifier(column)} TEXT`).join(', ');
    const placeholders = columns.map(() => '?').join(', ');
    const insertSql = `INSERT INTO ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(', ')}) VALUES (${placeholders});`;
    db.run('SAVEPOINT csv_import;');
    try {
      db.run(`CREATE TABLE ${quoteIdentifier(tableName)} (${columnSql});`);
      const statement = db.prepare(insertSql);
      try {
        for (const row of rows) statement.run(row);
      } finally {
        statement.free();
      }
      db.run('RELEASE csv_import;');
    } catch (error) {
      db.run('ROLLBACK TO csv_import;');
      db.run('RELEASE csv_import;');
      throw error;
    }

    renderSchema();
    elements.sqlInput.value = `SELECT * FROM ${quoteIdentifier(tableName)};`;
    updateJoinDiagram();
    renderResults([{ columns, values: rows.slice(0, 100) }]);
    elements.resultCount.textContent = `${rows.length} imported`;
    elements.resultTime.textContent = rows.length > 100 ? 'Showing first 100 rows' : '';
    activeTable = tableName;
    renderDataGrid();
    activateTab('data');
    await saveDatabase(storage);
    document.querySelector('#import-dialog').close();
  } catch (error) {
    feedback.textContent = error.message || 'The CSV could not be imported.';
    feedback.classList.add('is-error');
  } finally {
    submit.disabled = !importState;
  }
}

function renderResults(resultSets) {
  elements.results.replaceChildren();
  const reportButton = document.querySelector('#use-results-in-report-design');
  if (reportButton) reportButton.hidden = !lastQueryResultSet;
  const totalRows = resultSets.reduce((sum, result) => sum + result.values.length, 0);
  const totalColumns = resultSets.reduce((sum, result) => sum + result.columns.length, 0);
  elements.resultCount.textContent = resultSets.length
    ? `${totalRows} row${totalRows === 1 ? '' : 's'}`
    : 'Complete';

  if (resultSets.length === 0) {
    const message = document.createElement('div');
    message.className = 'message-state';
    message.textContent = 'Statement completed successfully.';
    elements.results.append(message);
    return;
  }

  for (const result of resultSets) {
    const table = document.createElement('table');
    table.className = 'result-table';
    const head = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const column of result.columns) {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = column;
      headerRow.append(cell);
    }
    head.append(headerRow);
    const body = document.createElement('tbody');
    for (const row of result.values) {
      const rowElement = document.createElement('tr');
      for (const value of row) {
        const cell = document.createElement('td');
        if (value === null) {
          cell.className = 'null-value';
          cell.textContent = 'NULL';
        } else {
          cell.textContent = String(value);
        }
        rowElement.append(cell);
      }
      body.append(rowElement);
    }
    table.append(head, body);
    elements.results.append(table);
  }

  if (totalRows === 0 && totalColumns > 0) {
    const note = document.createElement('div');
    note.className = 'message-state';
    note.textContent = 'Query returned no rows.';
    elements.results.append(note);
  }
}

function sqlQuoteState(text) {
  let quote = null;
  let inLineComment = false;
  let inBlockComment = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (inLineComment) {
      if (character === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (character === '*' && next === '/') { inBlockComment = false; index += 1; }
      continue;
    }
    if (quote) {
      const closing = quote === '[' ? ']' : quote;
      if (character === closing && next === closing) { index += 1; continue; }
      if (character === closing) quote = null;
      continue;
    }
    if (character === '-' && next === '-') { inLineComment = true; index += 1; }
    else if (character === '/' && next === '*') { inBlockComment = true; index += 1; }
    else if (character === "'" || character === '"' || character === '`' || character === '[') quote = character;
  }
  return { quote, inComment: inLineComment || inBlockComment };
}

function hideSqlSuggestions() {
  const list = document.querySelector('#sql-suggestions');
  list.hidden = true;
  list.replaceChildren();
  sqlSuggestionItems = [];
  sqlSuggestionRange = null;
  elements.sqlInput.removeAttribute('aria-activedescendant');
}

function positionSqlSuggestions() {
  const input = elements.sqlInput;
  const list = document.querySelector('#sql-suggestions');
  const area = input.parentElement;
  const style = getComputedStyle(input);
  const mirror = document.createElement('div');
  Object.assign(mirror.style, {
    position: 'fixed', left: '-10000px', top: '0', visibility: 'hidden',
    boxSizing: 'border-box', width: `${input.clientWidth}px`, height: 'auto',
    whiteSpace: 'pre-wrap', overflowWrap: 'break-word', wordBreak: 'break-word',
    font: style.font, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing,
    padding: style.padding, border: style.border, tabSize: style.tabSize,
  });
  const cursor = document.createElement('span');
  cursor.textContent = '\u200b';
  mirror.append(document.createTextNode(input.value.slice(0, input.selectionStart)), cursor);
  document.body.append(mirror);
  const mirrorRect = mirror.getBoundingClientRect();
  const cursorRect = cursor.getBoundingClientRect();
  const inputRect = input.getBoundingClientRect();
  const areaRect = area.getBoundingClientRect();
  const lineHeight = Number.parseFloat(style.lineHeight) || 20;
  let left = inputRect.left - areaRect.left + cursorRect.left - mirrorRect.left - input.scrollLeft;
  let top = inputRect.top - areaRect.top + cursorRect.top - mirrorRect.top - input.scrollTop + lineHeight;
  mirror.remove();
  const maxLeft = Math.max(8, area.clientWidth - list.offsetWidth - 8);
  left = Math.min(Math.max(44, left), maxLeft);
  if (top + list.offsetHeight > area.clientHeight) top = Math.max(0, top - list.offsetHeight - lineHeight);
  list.style.left = `${left}px`;
  list.style.top = `${top}px`;
}

function renderSqlSuggestions(items, range) {
  const list = document.querySelector('#sql-suggestions');
  sqlSuggestionItems = items;
  sqlSuggestionIndex = 0;
  sqlSuggestionRange = range;
  list.replaceChildren();
  for (const [index, item] of items.entries()) {
    const option = document.createElement('button');
    option.type = 'button';
    option.id = `sql-suggestion-${index}`;
    option.className = 'sql-suggestion';
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(index === 0));
    const name = document.createElement('span');
    name.className = 'sql-suggestion-name';
    name.textContent = item.name;
    const kind = document.createElement('span');
    kind.className = 'sql-suggestion-kind';
    kind.textContent = item.kind;
    option.append(name, kind);
    option.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      applySqlSuggestion(index);
    });
    list.append(option);
  }
  list.hidden = !items.length;
  if (items.length) {
    elements.sqlInput.setAttribute('aria-activedescendant', 'sql-suggestion-0');
    positionSqlSuggestions();
  }
}

function refreshSqlSuggestions(force = false) {
  const input = elements.sqlInput;
  const caret = input.selectionStart;
  const prefix = input.value.slice(0, caret);
  const { quote, inComment } = sqlQuoteState(prefix);
  if (inComment || quote === "'") { hideSqlSuggestions(); return; }
  const wordMatch = prefix.match(/[A-Za-z0-9_$]+$/);
  const word = wordMatch?.[0] || '';
  if (!force && word.length === 0) { hideSqlSuggestions(); return; }
  const wordStart = caret - word.length;
  const context = prefix.slice(0, wordStart).replace(/["`\[]$/, '');
  const tableContext = /\b(FROM|JOIN|INTO|UPDATE|TABLE)\s*$/i.test(context);
  const tables = listTables();
  const candidates = [];
  const add = (name, kind, priority) => candidates.push({ name, kind, priority });
  if (tableContext) {
    for (const name of tables) add(name, 'Table', 0);
  } else {
    for (const name of SQL_KEYWORDS) add(name, 'Keyword', 4);
    for (const name of SQL_FUNCTIONS) add(name, 'Function', 5);
    for (const name of tables) add(name, 'Table', 1);
    for (const tableName of tables) {
      for (const column of getTableSchema(tableName)) add(column.name, 'Field', 2);
    }
  }
  const lowerWord = word.toLocaleLowerCase();
  const seen = new Set();
  const matches = candidates
    .filter((item) => item.name.toLocaleLowerCase().startsWith(lowerWord))
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
    .filter((item) => {
      const key = item.name.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 14)
    .map((item) => {
      if (item.kind === 'Keyword') return { ...item, value: item.name };
      if (item.kind === 'Function') {
        const nextCharacter = input.value.slice(input.selectionEnd, input.selectionEnd + 1);
        return { ...item, value: `${item.name}${nextCharacter === '(' ? '' : '('}` };
      }
      if (quote) {
        const closingQuote = quote === '[' ? ']' : quote;
        const escapedName = quote === '[' ? item.name.replaceAll(']', ']]') : item.name.replaceAll(quote, quote + quote);
        const alreadyClosed = input.value.slice(input.selectionEnd).startsWith(closingQuote);
        return { ...item, value: `${escapedName}${alreadyClosed ? '' : closingQuote}` };
      }
      const simpleIdentifier = /^[A-Za-z_][A-Za-z0-9_$]*$/.test(item.name) && !SQL_KEYWORDS.includes(item.name.toUpperCase());
      return { ...item, value: simpleIdentifier ? item.name : quoteIdentifier(item.name) };
    });
  if (!matches.length) { hideSqlSuggestions(); return; }
  renderSqlSuggestions(matches, { start: wordStart, end: input.selectionEnd });
}

function applySqlSuggestion(index = sqlSuggestionIndex) {
  const item = sqlSuggestionItems[index];
  if (!item || !sqlSuggestionRange) return;
  const input = elements.sqlInput;
  const { start, end } = sqlSuggestionRange;
  input.setRangeText(item.value, start, end, 'end');
  hideSqlSuggestions();
  input.focus();
  suppressSqlSuggestionRefresh = true;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function moveSqlSuggestion(direction) {
  if (!sqlSuggestionItems.length) return;
  sqlSuggestionIndex = (sqlSuggestionIndex + direction + sqlSuggestionItems.length) % sqlSuggestionItems.length;
  document.querySelectorAll('.sql-suggestion').forEach((option, index) => {
    const selected = index === sqlSuggestionIndex;
    option.setAttribute('aria-selected', String(selected));
    if (selected) {
      elements.sqlInput.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({ block: 'nearest' });
    }
  });
}

async function runQuery(storage) {
  const sql = elements.sqlInput.value.trim();
  if (!sql) return;

  elements.runButton.disabled = true;
  const startedAt = performance.now();
  elements.resultTime.textContent = '';
  try {
    await writeStoredValue(storage, QUERY_DRAFT_KEY, elements.sqlInput.value);
    if (sqlWritesToAppManagedTable(sql)) {
      throw new Error('This app-managed table is maintained by DataNook. Use the saved-item controls instead of changing it directly.');
    }
    const resultSets = db.exec(sql);
    lastQueryResultSet = resultSets.filter((result) => result.columns.length > 0).at(-1) || null;
    lastQuerySqlText = sql;
    renderResults(resultSets);
    renderSchema();
    if (document.querySelector('.workspace').dataset.activeTab === 'data') renderDataGrid();
    if (document.querySelector('.workspace').dataset.activeTab === 'relationships') renderRelationships();
    window.reportDesignQueryChanged?.();
    await saveDatabase(storage);
    window.restorePendingReportDesign?.();
    elements.resultTime.textContent = `${Math.round(performance.now() - startedAt)} ms`;
  } catch (error) {
    lastQueryResultSet = null;
    lastQuerySqlText = '';
    reportDesignPendingDefinition = null;
    renderResults([]);
    window.reportDesignQueryChanged?.();
    elements.resultCount.textContent = 'Error';
    const message = document.createElement('div');
    message.className = 'message-state error';
    message.textContent = error.message || 'The query could not be run.';
    elements.results.replaceChildren(message);
    // Save even after a SQL error: earlier statements in a multi-statement query
    // may already have changed the database.
    try { await saveDatabase(storage); } catch (saveError) {
      message.textContent += ` · ${saveError.message}`;
    }
  } finally {
    elements.runButton.disabled = false;
  }
}

function sqlWritesToAppManagedTable(sql) {
  const source = sql.replace(/'(?:''|[^'])*'/g, ' ')
    .replace(/--[^\r\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  return [SAVED_QUERIES_TABLE, SAVED_REPORTS_TABLE, SAVED_REPORT_DESIGNS_TABLE].some((tableName) => {
    const tick = String.fromCharCode(96);
    const name = '(?:"' + tableName + '"|' + tick + tableName + tick + '|\\[' + tableName + '\\]|' + tableName + ')';
    const target = '(?:main\\s*\\.\\s*)?' + name + '(?![\\w])';
    const patterns = [
      new RegExp('\\b(?:INSERT\\s+(?:OR\\s+\\w+\\s+)?INTO|REPLACE\\s+INTO|DELETE\\s+FROM)\\s+' + target, 'i'),
      new RegExp('\\bUPDATE(?:\\s+OR\\s+\\w+)?\\s+' + target, 'i'),
      new RegExp('\\b(?:DROP\\s+TABLE(?:\\s+IF\\s+EXISTS)?|ALTER\\s+TABLE)\\s+' + target, 'i'),
      new RegExp('\\bCREATE\\s+(?:(?:TEMP|TEMPORARY)\\s+)?TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?' + name + '(?![\\w])', 'i'),
      new RegExp('\\bCREATE\\s+(?:(?:TEMP|TEMPORARY)\\s+)?TRIGGER\\b[\\s\\S]*?\\bON\\s+' + target, 'i'),
      new RegExp('\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\b[\\s\\S]*?\\bON\\s+' + target, 'i'),
    ];
    return patterns.some((pattern) => pattern.test(source));
  });
}

async function start() {
  if (!('indexedDB' in window)) throw new Error('This browser does not support IndexedDB storage.');
  const storage = await openStorage();
  SQLModule = await initSqlJs({
    locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/${SQLJS_VERSION}/${file}`,
  });
  const savedBytes = await readSavedDatabase(storage);
  db = savedBytes ? new SQLModule.Database(savedBytes) : await loadDefaultDatabase(SQLModule);
  removeLegacyInternalTables(db);
  db.run('PRAGMA foreign_keys = ON;');
  ensureSavedQueriesTable(db);
  ensureSavedReportDesignsTable(db);
  refreshSavedQueries();
  const savedRelationshipPositions = await readStoredValue(storage, RELATIONSHIP_LAYOUT_KEY);
  relationshipPositions = savedRelationshipPositions && typeof savedRelationshipPositions === 'object' ? savedRelationshipPositions : {};
  currentFileName = await readStoredValue(storage, DATABASE_FILENAME_KEY) || 'school-demo.sqlite';
  setDatabaseFileName(currentFileName);
  const savedQueryDraft = await readStoredValue(storage, QUERY_DRAFT_KEY);
  if (savedQueryDraft !== null) elements.sqlInput.value = savedQueryDraft;
  updateJoinDiagram();
  elements.engineVersion.textContent = `v${SQLJS_VERSION}`;
  renderSchema();
  window.refreshReportDesignSources?.();
  const availableTables = listTables();
  activeTable = availableTables.includes('students') ? 'students' : availableTables[0] || null;
  renderDataGrid();
  addDesignerField({ name: 'id', type: 'INTEGER', primaryKey: true, autoincrement: true });
  addDesignerField({ name: 'name', type: 'TEXT' });
  activateTab('data');
  await saveDatabase(storage);

  elements.sqlInput.addEventListener('input', () => {
    scheduleQueryDraftSave(storage);
    updateJoinDiagram();
    if (suppressSqlSuggestionRefresh) {
      suppressSqlSuggestionRefresh = false;
      hideSqlSuggestions();
    } else refreshSqlSuggestions();
  });
  document.querySelector('#saved-query-select').addEventListener('change', (event) => {
    const hasSelection = Boolean(event.target.value);
    document.querySelector('#load-saved-query').disabled = !hasSelection;
    document.querySelector('#delete-saved-query').disabled = !hasSelection;
    const feedback = document.querySelector('#saved-query-feedback');
    feedback.textContent = '';
    feedback.classList.remove('is-error');
  });
  document.querySelector('#load-saved-query').addEventListener('click', () => loadSavedQuery(storage));
  document.querySelector('#save-saved-query').addEventListener('click', () => {
    saveSavedQuery(storage).catch((error) => {
      const feedback = document.querySelector('#saved-query-feedback');
      feedback.textContent = error.message || 'The query could not be saved.';
      feedback.classList.add('is-error');
    });
  });
  document.querySelector('#delete-saved-query').addEventListener('click', () => {
    deleteSavedQuery(storage).catch((error) => {
      const feedback = document.querySelector('#saved-query-feedback');
      feedback.textContent = error.message || 'The query could not be deleted.';
      feedback.classList.add('is-error');
    });
  });
  document.querySelector('#new-database').addEventListener('click', async () => {
    const confirmed = await askForAppConfirmation(
      'Create a new database?',
      'This creates a blank database and replaces the database currently open in the workspace.',
      'Create database',
    );
    if (!confirmed) return;
    createNewDatabase(storage).catch(showDatabaseError);
  });
  document.querySelector('#load-database').addEventListener('click', () => chooseDatabaseToOpen(storage));
  document.querySelector('#save-database-as').addEventListener('click', () => saveDatabaseAs(storage));
  document.querySelector('#database-file-input').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    try {
      await openDatabaseFile(storage, file);
    } catch (error) {
      showDatabaseError(error);
    }
  });
  elements.sqlInput.addEventListener('blur', () => {
    flushQueryDraft(storage);
    window.setTimeout(hideSqlSuggestions, 0);
  });
  elements.runButton.addEventListener('click', () => {
    flushQueryDraft(storage);
    runQuery(storage);
  });
  const querySources = document.querySelector('#query-design-table-sources');
  const queryStage = document.querySelector('#query-design-stage');
  const queryGridDrop = document.querySelector('#query-design-grid-drop');
  document.querySelector('#query-design-add-calculated').addEventListener('click', () => {
    if (!queryDesignTables.length) {
      queryDesignFeedback('Add at least one table before creating a calculated field.', true);
      return;
    }
    const form = document.querySelector('#query-calculated-field-form');
    form.reset();
    document.querySelector('#query-calculated-field-feedback').textContent = '';
    document.querySelector('#query-calculated-field-feedback').classList.remove('is-error');
    const dialog = document.querySelector('#query-calculated-field-dialog');
    dialog.showModal();
    document.querySelector('#query-calculated-field-name').focus();
  });
  document.querySelector('#query-calculated-field-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const feedback = document.querySelector('#query-calculated-field-feedback');
    try {
      addCalculatedQueryField(
        document.querySelector('#query-calculated-field-name').value,
        document.querySelector('#query-calculated-field-expression').value,
      );
      document.querySelector('#query-calculated-field-dialog').close();
    } catch (error) {
      feedback.textContent = error.message || 'The calculated field could not be added.';
      feedback.classList.add('is-error');
    }
  });
  document.querySelector('#query-design-totals').addEventListener('click', (event) => {
    queryDesignTotalsMode = !queryDesignTotalsMode;
    if (queryDesignTotalsMode) {
      queryDesignFields.forEach((item) => { if (!item.total) item.total = 'GROUP BY'; });
      queryDesignFeedback('Totals is on. Group By fields form groups; choose Sum, Avg, Count, Min, or Max for summaries.');
    } else queryDesignFeedback('Totals is off.');
    renderQueryDesignGrid();
  });
  document.querySelector('#query-design-clear').addEventListener('click', () => {
    queryDesignTables = []; queryDesignFields = []; queryDesignPositions = {}; queryDesignTotalsMode = false; renderQueryDesigner(); queryDesignFeedback('Design cleared.');
  });
  document.querySelector('#query-design-open-sql').addEventListener('click', () => {
    try { elements.sqlInput.value = buildQueryDesignSql(); updateJoinDiagram(); scheduleQueryDraftSave(storage); refreshSqlSuggestions(); activateTab('editor'); queryDesignFeedback('SQL opened in SQL Editor.'); }
    catch (error) { queryDesignFeedback(error.message || 'Could not build the query.', true); }
  });
  document.querySelector('#query-design-run').addEventListener('click', async () => {
    try {
      elements.sqlInput.value = buildQueryDesignSql(); updateJoinDiagram(); scheduleQueryDraftSave(storage); activateTab('editor'); flushQueryDraft(storage); await runQuery(storage);
      queryDesignFeedback(elements.resultCount.textContent === 'Error' ? 'Query failed. See SQL Editor results for details.' : 'Query ran in SQL Editor.');
    } catch (error) { queryDesignFeedback(error.message || 'Could not run the query.', true); }
  });
  document.querySelector('#query-design-save').addEventListener('click', async () => {
    try { elements.sqlInput.value = buildQueryDesignSql(); updateJoinDiagram(); activateTab('editor'); await saveSavedQuery(storage); }
    catch (error) { queryDesignFeedback(error.message || 'Could not save the query.', true); }
  });
  querySources.addEventListener('dragstart', (event) => {
    const source = event.target.closest('[data-query-table]'); if (!source) return;
    event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('application/x-query-table', source.dataset.queryTable);
  });
  queryStage.addEventListener('dragover', (event) => { if (event.dataTransfer.types.includes('application/x-query-table')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } });
  queryStage.addEventListener('drop', (event) => {
    const table = event.dataTransfer.getData('application/x-query-table'); if (!table) return;
    event.preventDefault(); const bounds = queryStage.getBoundingClientRect();
    if (!queryDesignTables.includes(table)) queryDesignTables.push(table);
    queryDesignPositions[table] = { x: Math.max(0, event.clientX - bounds.left - 100), y: Math.max(0, event.clientY - bounds.top - 18) };
    renderQueryDesigner();
  });
  queryGridDrop.addEventListener('dragover', (event) => { if (event.dataTransfer.types.includes('application/x-query-field') || event.dataTransfer.types.includes('text/plain')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } });
  queryGridDrop.addEventListener('drop', (event) => {
    const raw = event.dataTransfer.getData('application/x-query-field') || event.dataTransfer.getData('text/plain'); if (!raw) return;
    event.preventDefault(); try { const field = JSON.parse(raw); addQueryDesignField(field.table, field.field); } catch { queryDesignFeedback('Could not add that field to the grid.', true); }
  });
  let pendingQueryField = null;
  document.addEventListener('pointerdown', (event) => {
    const field = event.target.closest?.('[data-query-field-table]');
    if (!field || event.button !== 0) return;
    pendingQueryField = { table: field.dataset.queryFieldTable, field: field.dataset.queryFieldName, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  });
  document.addEventListener('pointermove', (event) => {
    if (!pendingQueryField || event.pointerId !== pendingQueryField.pointerId) return;
    if (Math.hypot(event.clientX - pendingQueryField.x, event.clientY - pendingQueryField.y) > 8) pendingQueryField.moved = true;
  });
  document.addEventListener('pointerup', (event) => {
    if (!pendingQueryField || event.pointerId !== pendingQueryField.pointerId) return;
    const field = pendingQueryField; pendingQueryField = null;
    const dropTarget = document.elementFromPoint(event.clientX, event.clientY);
    if (field.moved && dropTarget?.closest('#query-design-grid-drop')) addQueryDesignField(field.table, field.field);
  });
  document.addEventListener('pointercancel', () => { pendingQueryField = null; });
  let movingQueryTable = null;
  queryStage.addEventListener('pointerdown', (event) => {
    const heading = event.target.closest('[data-move-query-table]'); if (!heading || event.button !== 0) return;
    const card = heading.closest('.query-table-card'); const table = heading.dataset.moveQueryTable; if (!card || !table) return;
    movingQueryTable = { card, table, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: Number.parseFloat(card.style.left) || 0, top: Number.parseFloat(card.style.top) || 0 };
    heading.classList.add('is-moving'); heading.setPointerCapture(event.pointerId);
  });
  queryStage.addEventListener('pointermove', (event) => {
    if (!movingQueryTable || event.pointerId !== movingQueryTable.pointerId) return;
    const left = Math.max(0, movingQueryTable.left + event.clientX - movingQueryTable.startX); const top = Math.max(0, movingQueryTable.top + event.clientY - movingQueryTable.startY);
    movingQueryTable.card.style.left = `${left}px`; movingQueryTable.card.style.top = `${top}px`; queryDesignPositions[movingQueryTable.table] = { x: left, y: top };
    queryStage.style.width = `${Math.max(queryStage.clientWidth, left + 260)}px`; queryStage.style.height = `${Math.max(queryStage.clientHeight, top + movingQueryTable.card.offsetHeight + 30)}px`; renderQueryDesignLines();
  });
  const finishQueryTableMove = (event) => { if (!movingQueryTable || event.pointerId !== movingQueryTable.pointerId) return; movingQueryTable.card.querySelector('.query-table-card-heading')?.classList.remove('is-moving'); movingQueryTable = null; };
  queryStage.addEventListener('pointerup', finishQueryTableMove); queryStage.addEventListener('pointercancel', finishQueryTableMove);
  elements.sqlInput.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      flushQueryDraft(storage);
      runQuery(storage);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.code === 'Space') {
      event.preventDefault();
      refreshSqlSuggestions(true);
      return;
    }
    if (sqlSuggestionItems.length && event.key === 'ArrowDown') {
      event.preventDefault();
      moveSqlSuggestion(1);
      return;
    }
    if (sqlSuggestionItems.length && event.key === 'ArrowUp') {
      event.preventDefault();
      moveSqlSuggestion(-1);
      return;
    }
    if (sqlSuggestionItems.length && (event.key === 'Tab' || event.key === 'Enter')) {
      event.preventDefault();
      applySqlSuggestion();
      return;
    }
    if (sqlSuggestionItems.length && event.key === 'Escape') {
      event.preventDefault();
      hideSqlSuggestions();
      return;
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushQueryDraft(storage);
  });
  window.addEventListener('pagehide', () => flushQueryDraft(storage));
  document.querySelectorAll('.workspace-tab').forEach((button) => {
    button.addEventListener('click', () => activateTab(button.dataset.tab));
  });
  document.querySelector('[role="tablist"]').addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const tabs = [...document.querySelectorAll('.workspace-tab')];
    const current = tabs.indexOf(document.activeElement);
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const next = tabs[(current + direction + tabs.length) % tabs.length];
    next.focus();
    next.click();
  });
  document.querySelector('#refresh-schema').addEventListener('click', () => {
    renderSchema();
    renderDataGrid();
  });
  document.querySelector('#data-table-select').addEventListener('change', (event) => {
    activeTable = event.target.value;
    datasheetFilters.clear();
    document.querySelector('#datasheet-search').value = '';
    document.querySelector('#datasheet-sort-field').value = '';
    document.querySelector('#datasheet-sort-direction').value = 'ASC';
    renderDataGrid();
  });
  document.querySelector('#datasheet-search').addEventListener('input', () => renderDataGrid());
  document.querySelector('#datasheet-sort-field').addEventListener('change', () => renderDataGrid());
  document.querySelector('#datasheet-sort-direction').addEventListener('change', () => renderDataGrid());
  document.querySelector('#datasheet-clear-view').addEventListener('click', () => {
    datasheetFilters.clear();
    openDatasheetFilterField = null;
    datasheetFilterDraft = null;
    document.querySelector('#datasheet-search').value = '';
    document.querySelector('#datasheet-sort-field').value = '';
    document.querySelector('#datasheet-sort-direction').value = 'ASC';
    renderDataGrid();
    document.querySelector('#datasheet-search').focus();
  });
  document.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('.field-heading-layout, .datasheet-filter-menu')) return;
    closeDatasheetFilterMenu();
  });
  elements.dataGrid.addEventListener('scroll', positionDatasheetFilterMenu, { passive: true });
  window.addEventListener('resize', positionDatasheetFilterMenu);
  const relationshipStage = document.querySelector('#relationships-stage');
  let movingTable = null;
  relationshipStage.addEventListener('pointerdown', (event) => {
    const heading = event.target.closest('.relationship-table-heading');
    if (!heading || event.button !== 0) return;
    const card = heading.closest('.relationship-table');
    const table = heading.dataset.moveTable;
    if (!card || !table) return;
    event.preventDefault();
    movingTable = {
      card,
      table,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: Number.parseFloat(card.style.left) || 0,
      top: Number.parseFloat(card.style.top) || 0,
    };
    heading.classList.add('is-moving');
    heading.setPointerCapture(event.pointerId);
  });
  relationshipStage.addEventListener('pointermove', (event) => {
    if (!movingTable || event.pointerId !== movingTable.pointerId) return;
    const left = Math.max(0, movingTable.left + event.clientX - movingTable.startX);
    const top = Math.max(0, movingTable.top + event.clientY - movingTable.startY);
    movingTable.card.style.left = `${left}px`;
    movingTable.card.style.top = `${top}px`;
    relationshipPositions[movingTable.table] = { x: left, y: top };
    const stageBounds = relationshipStage.getBoundingClientRect();
    relationshipStage.style.width = `${Math.max(relationshipStage.clientWidth, left + 310, event.clientX - stageBounds.left + 24)}px`;
    relationshipStage.style.height = `${Math.max(relationshipStage.clientHeight, top + movingTable.card.offsetHeight + 24, event.clientY - stageBounds.top + 24)}px`;
    renderRelationshipLines(getRelationships());
  });
  const finishTableMove = (event) => {
    if (!movingTable || event.pointerId !== movingTable.pointerId) return;
    movingTable.card.querySelector('.relationship-table-heading')?.classList.remove('is-moving');
    movingTable = null;
    persistRelationshipPositions(storage);
  };
  relationshipStage.addEventListener('pointerup', finishTableMove);
  relationshipStage.addEventListener('pointercancel', finishTableMove);
  relationshipStage.addEventListener('dragstart', (event) => {
    const field = event.target.closest('.relationship-field');
    if (!field) return;
    event.dataTransfer.effectAllowed = 'link';
    event.dataTransfer.setData('application/x-sqlite-field', JSON.stringify({ table: field.dataset.relTable, field: field.dataset.relField }));
    field.classList.add('is-dragging');
  });
  relationshipStage.addEventListener('dragend', (event) => event.target.closest('.relationship-field')?.classList.remove('is-dragging'));
  relationshipStage.addEventListener('dragover', (event) => {
    const target = event.target.closest('.relationship-field');
    if (!target) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'link';
    target.classList.add('is-drop-target');
  });
  relationshipStage.addEventListener('dragleave', (event) => {
    event.target.closest?.('.relationship-field')?.classList.remove('is-drop-target');
  });
  relationshipStage.addEventListener('drop', (event) => {
    const targetField = event.target.closest('.relationship-field');
    if (!targetField) return;
    event.preventDefault();
    targetField.classList.remove('is-drop-target');
    try {
      const source = JSON.parse(event.dataTransfer.getData('application/x-sqlite-field'));
      createRelationship(storage, source, { table: targetField.dataset.relTable, field: targetField.dataset.relField });
    } catch (error) {
      relationshipFeedback(error.message || 'Drop a field onto a field in another table.', true);
    }
  });
  document.querySelector('#remove-relationship').addEventListener('click', () => removeSelectedRelationship(storage));
  document.querySelector('#use-results-in-report-design').addEventListener('click', () => {
    if (!lastQueryResultSet) return;
    const sourceMode = document.querySelector('#report-design-source-mode');
    sourceMode.value = 'query';
    sourceMode.dispatchEvent(new Event('change', { bubbles: true }));
    activateTab('report-design');
  });
  document.querySelector('#report-design-export-excel').addEventListener('click', exportReportToExcel);
  document.querySelector('#report-design-export-word').addEventListener('click', exportReportToWord);
  window.addEventListener('resize', () => {
    if (document.querySelector('#relationships-panel').hidden) return;
    renderRelationships();
  });
  document.querySelector('#designer-import-csv').addEventListener('click', openImportDialog);
  elements.dataGrid.addEventListener('input', cellInput);
  elements.dataGrid.addEventListener('focusout', (event) => cellBlur(event, storage));
  elements.dataGrid.addEventListener('paste', (event) => cellPaste(event, storage));
  document.querySelector('#add-designer-field').addEventListener('click', () => addDesignerField());
  document.querySelector('#designer-new-table').addEventListener('click', () => {
    document.querySelector('#designer-fields').replaceChildren();
    document.querySelector('#designer-table-name').value = '';
    document.querySelector('#designer-feedback').textContent = '';
    document.querySelector('#designer-feedback').classList.remove('is-error');
    resetDesignerCreateMode();
    addDesignerField({ name: 'id', type: 'INTEGER', primaryKey: true, autoincrement: true });
    addDesignerField({ name: 'name', type: 'TEXT' });
  });
  document.querySelector('#designer-cancel').addEventListener('click', cancelTableDesign);
  document.querySelector('#datasheet-delete-table').addEventListener('click', () => deleteSelectedTable(storage));
  document.querySelector('#table-designer-form').addEventListener('submit', (event) => createTable(storage, event));
  document.querySelector('#csv-file').addEventListener('change', (event) => loadCsvFile(event.target.files[0]));
  document.querySelector('#csv-delimiter').addEventListener('change', refreshCsvPreview);
  document.querySelector('#csv-has-header').addEventListener('change', refreshCsvPreview);
  document.querySelector('#csv-table-name').addEventListener('input', () => {
    const feedback = document.querySelector('#import-feedback');
    feedback.textContent = '';
    feedback.classList.remove('is-error');
  });
  document.querySelector('#import-form').addEventListener('submit', (event) => {
    event.preventDefault();
    importCsv(storage);
  });
  document.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog).close());
  });
  document.querySelector('#clear-results').addEventListener('click', () => {
    lastQueryResultSet = null;
    lastQuerySqlText = '';
    window.reportDesignQueryChanged?.();
    document.querySelector('#use-results-in-report-design').hidden = true;
    elements.results.innerHTML = '<div class="welcome-state"><span class="welcome-icon" aria-hidden="true">⌁</span><strong>Run a query to see results</strong><span>Try editing the sample query above.</span></div>';
    elements.resultCount.textContent = 'Ready';
    elements.resultTime.textContent = '';
  });
  await window.initializeReportDesign(storage);
}

start().catch((error) => {
  console.error(error);
  setSaveStatus('error', 'Database unavailable');
  elements.results.replaceChildren();
  const message = document.createElement('div');
  message.className = 'message-state error';
  message.textContent = `${error.message || 'The database could not be started.'} Check your connection and reload this page.`;
  elements.results.append(message);
});
