const setupScreen = document.querySelector("#setupScreen");
const counterScreen = document.querySelector("#counterScreen");
const setupForm = document.querySelector("#setupForm");
const fieldList = document.querySelector("#fieldList");
const setupMessage = document.querySelector("#setupMessage");
const buttonGrid = document.querySelector("#buttonGrid");
const totalCount = document.querySelector("#totalCount");
const counterMessage = document.querySelector("#counterMessage");
const stopButton = document.querySelector("#stopButton");
const resumeButton = document.querySelector("#resumeButton");
const summary = document.querySelector("#summary");
const sessionStatus = document.querySelector("#sessionStatus");
const counterTitle = document.querySelector("#counterTitle");
const counterIntro = document.querySelector("#counterIntro");

let fields = [];
let collecting = false;
const colours = ["coral", "blue", "gold", "green", "purple", "pink"];

function addField(value = "") {
  const row = document.createElement("div");
  row.className = "field-row";
  row.innerHTML = `
    <span class="field-number"></span>
    <input type="text" maxlength="30" placeholder="Another category" required>
    <button class="remove-button" type="button" aria-label="Remove field">×</button>
  `;
  row.querySelector("input").value = value;
  row.querySelector(".remove-button").addEventListener("click", () => {
    if (fieldList.children.length > 2) {
      row.remove();
      updateFieldRows();
    }
  });
  fieldList.append(row);
  updateFieldRows();
}

function updateFieldRows() {
  [...fieldList.children].forEach((row, index) => {
    row.querySelector(".field-number").textContent = String(index + 1).padStart(2, "0");
    row.querySelector("input").setAttribute("aria-label", `Field ${index + 1} name`);
    row.querySelector(".remove-button").classList.toggle("hidden", fieldList.children.length <= 2);
    row.querySelector("input").placeholder = index === 0 ? "e.g. Cars" : index === 1 ? "e.g. Buses" : "Another category";
  });
}

function getTotal() {
  return fields.reduce((sum, field) => sum + field.count, 0);
}

function renderButtons() {
  buttonGrid.innerHTML = "";
  fields.forEach((field, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `count-button ${colours[index % colours.length]}`;
    button.disabled = !collecting;
    button.innerHTML = `
      <span class="count-name"></span>
      <strong>${field.count}</strong>
      <span class="tap-label">${collecting ? 'TAP TO ADD <b>＋</b>' : `${getTotal() ? Math.round(field.count / getTotal() * 100) : 0}% OF TOTAL`}</span>
    `;
    button.querySelector(".count-name").textContent = field.name;
    button.setAttribute("aria-label", `${field.name}: ${field.count} observations${collecting ? ", click to add one" : ""}`);
    button.addEventListener("click", () => {
      if (!collecting) return;
      field.count += 1;
      renderButtons();
      updateTotal();
    });
    buttonGrid.append(button);
  });
}

function updateTotal() {
  totalCount.textContent = getTotal();
}

function showSummary() {
  const total = getTotal();
  if (total === 0) {
    summary.classList.add("hidden");
    return;
  }
  summary.classList.remove("hidden");
  summary.innerHTML = "<h2>Frequency snapshot</h2>";
  fields.forEach((field, index) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `<span></span><div class="bar-track"><i class="${colours[index % colours.length]}" style="width:${field.count / total * 100}%"></i></div><strong>${field.count}</strong>`;
    row.querySelector("span").textContent = field.name;
    summary.append(row);
  });
}

function setCollecting(value) {
  collecting = value;
  stopButton.classList.toggle("hidden", !collecting);
  resumeButton.classList.toggle("hidden", collecting);
  sessionStatus.innerHTML = collecting
    ? '<span class="live-dot"></span> COLLECTION IN PROGRESS'
    : '<span class="stopped-dot"></span> COLLECTION STOPPED';
  counterTitle.textContent = collecting ? "Record an observation" : "Your results";
  counterIntro.textContent = collecting ? "Tap the matching category each time you see it." : "Review the frequency and share of each category.";
  counterMessage.textContent = collecting ? "Buttons are live — each tap adds one." : "Counting is paused. Your results are safe.";
  summary.classList.toggle("hidden", collecting);
  renderButtons();
  if (!collecting) showSummary();
}

setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const names = [...fieldList.querySelectorAll("input")].map((input) => input.value.trim()).filter(Boolean);
  const unique = new Set(names.map((name) => name.toLowerCase()));
  if (names.length < 2) {
    setupMessage.textContent = "Add at least two field names to compare.";
    return;
  }
  if (unique.size !== names.length) {
    setupMessage.textContent = "Each field needs a different name.";
    return;
  }
  fields = names.map((name) => ({ name, count: 0 }));
  setupScreen.classList.add("hidden");
  counterScreen.classList.remove("hidden");
  setupMessage.textContent = "";
  updateTotal();
  setCollecting(true);
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.querySelector("#addFieldButton").addEventListener("click", () => {
  addField();
  fieldList.lastElementChild.querySelector("input").focus();
});

stopButton.addEventListener("click", () => {
  const confirmed = window.confirm("Are you sure you want to stop collecting data?");
  if (confirmed) setCollecting(false);
});
resumeButton.addEventListener("click", () => setCollecting(true));

document.querySelector("#clearButton").addEventListener("click", () => {
  const confirmed = window.confirm("Are you sure you want to clear all values? This cannot be undone.");
  if (!confirmed) return;
  fields.forEach((field) => { field.count = 0; });
  updateTotal();
  renderButtons();
  if (!collecting) showSummary();
  counterMessage.textContent = "All values have been cleared.";
});

document.querySelector("#newFieldsButton").addEventListener("click", () => {
  const confirmed = window.confirm("Are you sure you want to enter new fields? Your current fields and values will be removed.");
  if (!confirmed) return;
  fields = [];
  collecting = false;
  fieldList.innerHTML = "";
  addField();
  addField();
  counterScreen.classList.add("hidden");
  setupScreen.classList.remove("hidden");
  setupMessage.textContent = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
});

addField();
addField();
