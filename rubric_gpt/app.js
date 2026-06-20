(function () {
  "use strict";

  var STORAGE_KEY = "rubric-gpt-state-v1";
  var GRADES = ["A", "B", "C", "D", "E"];
  var LENGTH_LABELS = {
    "under-50": "under 50 words",
    "under-100": "under 100 words",
    "under-150": "under 150 words",
    "under-200": "under 200 words"
  };
  var LENGTH_ALIASES = {
    brief: "under-50",
    standard: "under-100",
    detailed: "under-150"
  };
  var TONE_LABELS = {
    "where-now-next": "where are they now and where to next",
    professional: "professional",
    warm: "warm",
    encouraging: "encouraging",
    formal: "formal"
  };
  var saveTimer = null;
  var state = loadState();

  var els = {
    subjectInput: document.getElementById("subjectInput"),
    taskInput: document.getElementById("taskInput"),
    lengthInput: document.getElementById("lengthInput"),
    toneInput: document.getElementById("toneInput"),
    useDescriptorsInput: document.getElementById("useDescriptorsInput"),
    instructionsInput: document.getElementById("instructionsInput"),
    sheetMount: document.getElementById("sheetMount"),
    descriptorMount: document.getElementById("descriptorMount"),
    selectedCriterionName: document.getElementById("selectedCriterionName"),
    addCriterionButton: document.getElementById("addCriterionButton"),
    addStudentButton: document.getElementById("addStudentButton"),
    deleteCriterionButton: document.getElementById("deleteCriterionButton"),
    resetButton: document.getElementById("resetButton"),
    saveJsonButton: document.getElementById("saveJsonButton"),
    loadJsonButton: document.getElementById("loadJsonButton"),
    loadJsonInput: document.getElementById("loadJsonInput"),
    copyButton: document.getElementById("copyButton"),
    promptOutput: document.getElementById("promptOutput"),
    saveStatus: document.getElementById("saveStatus")
  };

  initialise();

  function initialise() {
    bindStaticEvents();
    render();
  }

  function bindStaticEvents() {
    els.subjectInput.addEventListener("input", function (event) {
      state.context.subject = event.target.value;
      persistAndRenderPrompt();
    });

    els.taskInput.addEventListener("input", function (event) {
      state.context.task = event.target.value;
      persistAndRenderPrompt();
    });

    els.lengthInput.addEventListener("change", function (event) {
      state.context.length = event.target.value;
      persistAndRenderPrompt();
    });

    els.toneInput.addEventListener("change", function (event) {
      state.context.tone = event.target.value;
      persistAndRenderPrompt();
    });

    els.useDescriptorsInput.addEventListener("change", function (event) {
      state.context.useDescriptors = event.target.checked;
      renderDescriptors();
      persistAndRenderPrompt();
    });

    els.instructionsInput.addEventListener("input", function (event) {
      state.context.instructions = event.target.value;
      persistAndRenderPrompt();
    });

    els.addCriterionButton.addEventListener("click", addCriterion);
    els.addStudentButton.addEventListener("click", addStudent);
    els.deleteCriterionButton.addEventListener("click", deleteSelectedCriterion);
    els.resetButton.addEventListener("click", resetState);
    els.saveJsonButton.addEventListener("click", saveJsonFile);
    els.loadJsonButton.addEventListener("click", function () {
      els.loadJsonInput.value = "";
      els.loadJsonInput.click();
    });
    els.loadJsonInput.addEventListener("change", loadJsonFile);
    els.copyButton.addEventListener("click", copyPrompt);
  }

  function defaultState() {
    return {
      context: {
        subject: "Year X Science",
        task: "Practical report",
        length: "under-100",
        tone: "where-now-next",
        useDescriptors: true,
        instructions: "Write each comment in one paragraph. Include one strength and one next step."
      },
      selectedCriterionId: "criterion-ideas",
      criteria: [
        {
          id: "criterion-ideas",
          name: "Ideas and Content",
          descriptors: {
            A: "Develops insightful, original ideas with clear supporting detail.",
            B: "Develops strong ideas with relevant supporting detail.",
            C: "Develops suitable ideas with some supporting detail.",
            D: "Includes basic ideas with limited supporting detail.",
            E: "Needs support to develop clear ideas and relevant detail."
          }
        },
        {
          id: "criterion-structure",
          name: "Structure",
          descriptors: {
            A: "Organises writing with a confident introduction, logical sequence and effective conclusion.",
            B: "Organises writing clearly with a suitable introduction, sequence and conclusion.",
            C: "Uses a basic structure with mostly clear sequencing.",
            D: "Shows some structure, though sequencing may be uneven.",
            E: "Needs support to organise ideas into a clear structure."
          }
        },
        {
          id: "criterion-language",
          name: "Language Choices",
          descriptors: {
            A: "Uses precise vocabulary and varied sentences to engage the reader.",
            B: "Uses appropriate vocabulary and sentence variety for the task.",
            C: "Uses generally suitable vocabulary and sentence structures.",
            D: "Uses simple vocabulary and sentence structures with limited control.",
            E: "Needs support to choose vocabulary and sentence structures for the task."
          }
        }
      ],
      students: [
        {
          id: "student-1",
          name: "Student 1",
          grades: {
            "criterion-ideas": "B",
            "criterion-structure": "C",
            "criterion-language": "B"
          }
        },
        {
          id: "student-2",
          name: "Student 2",
          grades: {
            "criterion-ideas": "C",
            "criterion-structure": "C",
            "criterion-language": "D"
          }
        },
        {
          id: "student-3",
          name: "Student 3",
          grades: {
            "criterion-ideas": "A",
            "criterion-structure": "B",
            "criterion-language": "A"
          }
        }
      ]
    };
  }

  function loadState() {
    var fallback = defaultState();
    var saved = null;

    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      saved = null;
    }

    if (!saved || typeof saved !== "object") {
      return fallback;
    }

    return normaliseState(saved, fallback);
  }

  function normaliseState(saved, fallback) {
    var criteria = Array.isArray(saved.criteria) && saved.criteria.length ? saved.criteria : fallback.criteria;
    var students = Array.isArray(saved.students) && saved.students.length ? saved.students : fallback.students;
    var selectedCriterionId = criteria.some(function (criterion) {
      return criterion.id === saved.selectedCriterionId;
    })
      ? saved.selectedCriterionId
      : criteria[0].id;

    return {
      context: normaliseContext(saved.context || {}, fallback.context),
      selectedCriterionId: selectedCriterionId,
      criteria: criteria.map(function (criterion, index) {
        return {
          id: criterion.id || createId("criterion"),
          name: criterion.name || "Criterion " + (index + 1),
          descriptors: normaliseDescriptors(criterion.descriptors)
        };
      }),
      students: students.map(function (student, index) {
        return {
          id: student.id || createId("student"),
          name: student.name || "Student " + (index + 1),
          grades: student.grades || {}
        };
      })
    };
  }

  function normaliseContext(savedContext, fallbackContext) {
    var context = Object.assign({}, fallbackContext, savedContext);

    if (hasKey(LENGTH_ALIASES, context.length)) {
      context.length = LENGTH_ALIASES[context.length];
    }

    if (!hasKey(LENGTH_LABELS, context.length)) {
      context.length = fallbackContext.length;
    }

    if (!hasKey(TONE_LABELS, context.tone)) {
      context.tone = fallbackContext.tone;
    }

    context.useDescriptors = context.useDescriptors !== false;
    return context;
  }

  function normaliseDescriptors(source) {
    return GRADES.reduce(function (descriptors, grade) {
      descriptors[grade] = source && typeof source[grade] === "string" ? source[grade] : "";
      return descriptors;
    }, {});
  }

  function render() {
    renderContext();
    renderSheet();
    renderDescriptors();
    renderPrompt();
    saveNow();
  }

  function renderContext() {
    els.subjectInput.value = state.context.subject;
    els.taskInput.value = state.context.task;
    els.lengthInput.value = state.context.length;
    els.toneInput.value = state.context.tone;
    els.useDescriptorsInput.checked = state.context.useDescriptors !== false;
    els.instructionsInput.value = state.context.instructions;
  }

  function renderSheet() {
    var table = document.createElement("table");
    var thead = document.createElement("thead");
    var tbody = document.createElement("tbody");

    table.className = "rubric-table";
    table.style.setProperty("--criteria-count", String(Math.max(state.criteria.length, 1)));
    table.appendChild(thead);
    table.appendChild(tbody);

    var headerRow = document.createElement("tr");
    var corner = document.createElement("th");
    corner.className = "corner-cell";
    corner.scope = "col";
    corner.textContent = "Student";
    headerRow.appendChild(corner);

    state.criteria.forEach(function (criterion) {
      var th = document.createElement("th");
      var wrapper = document.createElement("div");
      var displayButton = document.createElement("button");
      var displayText = document.createElement("span");
      var input = document.createElement("input");
      var selectButton = document.createElement("button");

      th.scope = "col";
      wrapper.className = "criterion-header";
      if (criterion.id === state.selectedCriterionId) {
        wrapper.classList.add("selected");
      }

      displayButton.type = "button";
      displayButton.className = "criterion-display";
      displayButton.title = "Edit " + criterion.name;
      displayButton.setAttribute("aria-label", "Edit criterion name: " + criterion.name);
      displayText.className = "criterion-display-text";
      displayText.textContent = criterion.name;
      displayButton.appendChild(displayText);
      displayButton.addEventListener("click", function () {
        selectCriterion(criterion.id);
        wrapper.classList.add("editing");
        input.focus();
        input.select();
      });

      input.type = "text";
      input.className = "criterion-name-input";
      input.value = criterion.name;
      input.setAttribute("aria-label", "Criterion name");
      input.addEventListener("focus", function () {
        wrapper.classList.add("editing");
        selectCriterion(criterion.id);
      });
      input.addEventListener("blur", function () {
        wrapper.classList.remove("editing");
      });
      input.addEventListener("input", function (event) {
        criterion.name = event.target.value;
        displayText.textContent = criterion.name || "Untitled criterion";
        displayButton.title = "Edit " + (criterion.name || "Untitled criterion");
        displayButton.setAttribute("aria-label", "Edit criterion name: " + (criterion.name || "Untitled criterion"));
        state.selectedCriterionId = criterion.id;
        persistAndRenderDescriptors();
      });

      selectButton.type = "button";
      selectButton.className = "select-criterion-button";
      selectButton.title = "Edit descriptors for " + criterion.name;
      selectButton.setAttribute("aria-label", "Edit descriptors for " + criterion.name);
      selectButton.textContent = ">";
      selectButton.addEventListener("click", function () {
        selectCriterion(criterion.id);
      });

      wrapper.appendChild(displayButton);
      wrapper.appendChild(input);
      wrapper.appendChild(selectButton);
      th.appendChild(wrapper);
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);

    state.students.forEach(function (student) {
      var row = document.createElement("tr");
      var nameCell = document.createElement("td");
      var nameWrap = document.createElement("div");
      var nameInput = document.createElement("input");
      var deleteButton = document.createElement("button");

      nameCell.className = "student-name-cell";
      nameWrap.className = "student-name-wrap";
      nameInput.className = "student-name-input";
      nameInput.type = "text";
      nameInput.value = student.name;
      nameInput.setAttribute("aria-label", "Student name");
      nameInput.addEventListener("input", function (event) {
        student.name = event.target.value;
        persistAndRenderPrompt();
      });
      deleteButton.className = "delete-student-button";
      deleteButton.type = "button";
      deleteButton.title = "Delete " + student.name;
      deleteButton.setAttribute("aria-label", "Delete " + student.name);
      deleteButton.textContent = "X";
      deleteButton.addEventListener("click", function () {
        deleteStudent(student.id);
      });
      nameWrap.appendChild(nameInput);
      nameWrap.appendChild(deleteButton);
      nameCell.appendChild(nameWrap);
      row.appendChild(nameCell);

      state.criteria.forEach(function (criterion) {
        var cell = document.createElement("td");
        var select = document.createElement("select");

        cell.className = "grade-cell";
        select.className = "grade-select";
        select.setAttribute("aria-label", student.name + " grade for " + criterion.name);

        GRADES.forEach(function (grade) {
          var option = document.createElement("option");
          option.value = grade;
          option.textContent = grade;
          select.appendChild(option);
        });

        if (!GRADES.includes(student.grades[criterion.id])) {
          student.grades[criterion.id] = "C";
        }

        select.value = student.grades[criterion.id];
        select.addEventListener("change", function (event) {
          student.grades[criterion.id] = event.target.value;
          persistAndRenderPrompt();
        });

        cell.appendChild(select);
        row.appendChild(cell);
      });

      tbody.appendChild(row);
    });

    els.sheetMount.replaceChildren(table);
  }

  function renderDescriptors() {
    var criterion = getSelectedCriterion();
    els.descriptorMount.replaceChildren();

    if (state.context.useDescriptors === false) {
      els.selectedCriterionName.textContent = "Descriptors disabled";
      els.deleteCriterionButton.disabled = state.criteria.length <= 1;
      els.descriptorMount.appendChild(emptyMessage("Descriptor text is saved, but it is not included in the prompt while this option is off."));
      return;
    }

    if (!criterion) {
      els.selectedCriterionName.textContent = "No criterion selected";
      els.deleteCriterionButton.disabled = true;
      els.descriptorMount.appendChild(emptyMessage("Add a criterion to edit grade descriptors."));
      return;
    }

    els.selectedCriterionName.textContent = criterion.name || "Untitled criterion";
    els.deleteCriterionButton.disabled = state.criteria.length <= 1;

    GRADES.forEach(function (grade) {
      var row = document.createElement("label");
      var badge = document.createElement("span");
      var textarea = document.createElement("textarea");

      row.className = "descriptor-row";
      badge.className = "grade-badge";
      badge.textContent = grade;
      textarea.value = criterion.descriptors[grade] || "";
      textarea.rows = 3;
      textarea.setAttribute("aria-label", "Descriptor for grade " + grade);
      textarea.addEventListener("input", function (event) {
        criterion.descriptors[grade] = event.target.value;
        persistAndRenderPrompt();
      });

      row.appendChild(badge);
      row.appendChild(textarea);
      els.descriptorMount.appendChild(row);
    });
  }

  function renderPrompt() {
    els.promptOutput.value = buildPrompt();
  }

  function buildPrompt() {
    var subject = cleanText(state.context.subject) || "[Subject / year level not entered]";
    var task = cleanText(state.context.task) || "[Assessment task not entered]";
    var instructions = cleanText(state.context.instructions);
    var length = state.context.length || "standard";
    var tone = state.context.tone || "professional";
    var useDescriptors = state.context.useDescriptors !== false;
    var lines = [];

    lines.push("You are helping a teacher write report comments.");
    lines.push("");
    lines.push("Write " + describeLength(length) + " report comments using Australian spelling.");
    lines.push("Use this tone/structure: " + describeTone(tone) + ".");
    lines.push("For each student, write one clear paragraph that mentions strengths and next steps.");
    lines.push("Use only the evidence in the rubric data. Do not invent extra achievements, behaviour, assessment scores or personal details.");
    lines.push("Do not mention the grade given for each criterion in the comment; use descriptive language that reflects the grade instead.");
    if (instructions) {
      lines.push("Additional teacher instructions: " + instructions);
    }
    lines.push("");
    lines.push("Class context:");
    lines.push("- Subject / year level: " + subject);
    lines.push("- Assessment task: " + task);
    lines.push("");

    if (useDescriptors) {
      lines.push("Rubric criteria and grade descriptors:");

      state.criteria.forEach(function (criterion) {
        lines.push("");
        lines.push(criterion.name + ":");
        GRADES.forEach(function (grade) {
          lines.push("- " + grade + ": " + (cleanText(criterion.descriptors[grade]) || "[No descriptor entered]"));
        });
      });
    } else {
      lines.push("Rubric criteria used for grading:");
      state.criteria.forEach(function (criterion) {
        lines.push("- " + criterion.name);
      });
      lines.push("");
      lines.push("Use only the criterion names and selected A-E grades as evidence.");
    }

    lines.push("");
    lines.push("Student grade selections:");

    state.students.forEach(function (student) {
      lines.push("");
      lines.push(student.name + ":");
      state.criteria.forEach(function (criterion) {
        var grade = student.grades[criterion.id] || "C";
        if (useDescriptors) {
          lines.push("- " + criterion.name + ": " + grade + " - " + (cleanText(criterion.descriptors[grade]) || "[No descriptor entered]"));
        } else {
          lines.push("- " + criterion.name + ": " + grade);
        }
      });
    });

    lines.push("");
    lines.push("Return the comments as a list with each student's name, an estimated overall grade, and their comment.");

    return lines.join("\n");
  }

  function describeLength(length) {
    return LENGTH_LABELS[length] || LENGTH_LABELS["under-100"];
  }

  function describeTone(tone) {
    return TONE_LABELS[tone] || TONE_LABELS.professional;
  }

  function addCriterion() {
    var criterionNumber = state.criteria.length + 1;
    var criterion = {
      id: createId("criterion"),
      name: "Criterion " + criterionNumber,
      descriptors: normaliseDescriptors()
    };

    state.criteria.push(criterion);
    state.students.forEach(function (student) {
      student.grades[criterion.id] = "C";
    });
    state.selectedCriterionId = criterion.id;
    render();
    focusNewCriterion(criterion.id);
  }

  function addStudent() {
    var student = {
      id: createId("student"),
      name: "Student " + (state.students.length + 1),
      grades: {}
    };

    state.criteria.forEach(function (criterion) {
      student.grades[criterion.id] = "C";
    });

    state.students.push(student);
    render();
    focusNewStudent(student.id);
  }

  function deleteStudent(studentId) {
    if (state.students.length <= 1) {
      window.alert("Keep at least one student in the table.");
      return;
    }

    var student = state.students.find(function (item) {
      return item.id === studentId;
    });
    var confirmed = window.confirm("Delete " + (student ? student.name : "this student") + "?");
    if (!confirmed) {
      return;
    }

    state.students = state.students.filter(function (item) {
      return item.id !== studentId;
    });
    render();
  }

  function deleteSelectedCriterion() {
    var criterion = getSelectedCriterion();
    if (!criterion || state.criteria.length <= 1) {
      return;
    }

    var confirmed = window.confirm("Delete the selected criterion and its student grades?");
    if (!confirmed) {
      return;
    }

    state.criteria = state.criteria.filter(function (item) {
      return item.id !== criterion.id;
    });
    state.students.forEach(function (student) {
      delete student.grades[criterion.id];
    });
    state.selectedCriterionId = state.criteria[0].id;
    render();
  }

  function resetState() {
    var confirmed = window.confirm("Reset the rubric and clear saved browser data?");
    if (!confirmed) {
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    render();
    setSaveStatus("Reset complete");
  }

  function saveJsonFile() {
    var payload = JSON.stringify(state, null, 2);
    var blob = new Blob([payload], { type: "application/json" });
    var link = document.createElement("a");
    var fileName = createJsonFileName();
    var objectUrl = URL.createObjectURL(blob);

    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    setSaveStatus("JSON saved");
  }

  function loadJsonFile(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    var reader = new FileReader();
    reader.addEventListener("load", function () {
      try {
        state = normaliseState(JSON.parse(reader.result), defaultState());
        render();
        setSaveStatus("JSON loaded");
      } catch (error) {
        window.alert("That JSON file could not be loaded.");
        setSaveStatus("JSON load failed");
      }
    });
    reader.readAsText(file);
  }

  function createJsonFileName() {
    var task = cleanText(state.context.task).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return (task || "rubric-gpt") + ".json";
  }

  function selectCriterion(criterionId) {
    if (state.selectedCriterionId === criterionId) {
      return;
    }

    state.selectedCriterionId = criterionId;
    renderSheet();
    renderDescriptors();
    renderPrompt();
    scheduleSave();
  }

  function getSelectedCriterion() {
    return state.criteria.find(function (criterion) {
      return criterion.id === state.selectedCriterionId;
    });
  }

  function persistAndRenderPrompt() {
    renderPrompt();
    scheduleSave();
  }

  function persistAndRenderDescriptors() {
    renderDescriptors();
    renderPrompt();
    scheduleSave();
  }

  function scheduleSave() {
    setSaveStatus("Saving...");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 200);
  }

  function saveNow() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSaveStatus("Autosaved");
    } catch (error) {
      setSaveStatus("Unable to save locally");
    }
  }

  function setSaveStatus(message) {
    els.saveStatus.textContent = message;
  }

  function copyPrompt() {
    var text = els.promptOutput.value;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          flashCopySuccess();
        },
        function () {
          fallbackCopy(text);
        }
      );
      return;
    }

    fallbackCopy(text);
  }

  function fallbackCopy(text) {
    els.promptOutput.focus();
    els.promptOutput.select();

    try {
      document.execCommand("copy");
      flashCopySuccess();
    } catch (error) {
      setSaveStatus("Select the prompt and copy manually");
    }
  }

  function flashCopySuccess() {
    var original = els.copyButton.innerHTML;
    els.copyButton.innerHTML = "<span aria-hidden=\"true\">OK</span><span>Copied</span>";
    setTimeout(function () {
      els.copyButton.innerHTML = original;
    }, 1400);
  }

  function focusNewCriterion(criterionId) {
    window.requestAnimationFrame(function () {
      var headers = Array.prototype.slice.call(document.querySelectorAll(".criterion-header input"));
      var index = state.criteria.findIndex(function (criterion) {
        return criterion.id === criterionId;
      });
      if (headers[index]) {
        if (headers[index].parentElement) {
          headers[index].parentElement.classList.add("editing");
        }
        headers[index].focus();
        headers[index].select();
      }
    });
  }

  function focusNewStudent(studentId) {
    window.requestAnimationFrame(function () {
      var rowIndex = state.students.findIndex(function (student) {
        return student.id === studentId;
      });
      var inputs = Array.prototype.slice.call(document.querySelectorAll(".student-name-input"));
      if (inputs[rowIndex]) {
        inputs[rowIndex].focus();
        inputs[rowIndex].select();
      }
    });
  }

  function emptyMessage(text) {
    var message = document.createElement("p");
    message.className = "empty-message";
    message.textContent = text;
    return message;
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function hasKey(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function createId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }
})();
