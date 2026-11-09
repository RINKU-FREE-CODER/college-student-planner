const STORAGE_KEY = "campus-planner-entries-v1";
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function createStarterEntries() {
  return [
    { id: "sample-class-biology", type: "class", title: "Biology 101", course: "Foundations of Biology", day: 1, time: "09:00", location: "Science Hall 204" },
    { id: "sample-class-writing", type: "class", title: "Academic Writing", course: "Writing Seminar", day: 3, time: "11:30", location: "Arts Building 18" },
    { id: "sample-class-psychology", type: "class", title: "Introduction to Psychology", course: "Psychology 110", day: 5, time: "10:00", location: "North Hall 12" },
    { id: "sample-assignment-lab", type: "assignment", title: "Cell structure lab report", course: "Foundations of Biology", dueDate: dateOffset(2), completed: false },
    { id: "sample-assignment-reading", type: "assignment", title: "Reading response #4", course: "Writing Seminar", dueDate: dateOffset(5), completed: false },
    { id: "sample-exam-psychology", type: "exam", title: "Midterm review", course: "Psychology 110", dueDate: dateOffset(9), completed: false },
  ];
}

function loadEntries() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === null) {
    const starterEntries = createStarterEntries();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(starterEntries));
    return starterEntries;
  }

  const parsed = JSON.parse(saved);
  if (!Array.isArray(parsed)) {
    throw new Error("Saved planner data is not in the expected format.");
  }
  return parsed;
}

let entries;
let activeView = "overview";
let toastTimer;

const $ = (selector) => document.querySelector(selector);
const entryForm = $("#entryForm");
const entryType = $("#entryType");
const taskFields = $("#taskFields");
const classFields = $("#classFields");
const toast = $("#toast");

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(date);
}

function formatDueDate(value) {
  if (!value) return "No date";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `${shortMonths[date.getMonth()]} ${date.getDate()}`;
}

function formatTime(value) {
  if (!value) return "Time not set";
  const [hour, minute] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function currentDateString() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

function saveEntries() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch (error) {
    console.error("Could not save planner entries.", error);
    showToast("Couldn't save changes in this browser. Check your storage settings.", true);
    return false;
  }
}

function getTaskEntries(type) {
  return entries.filter((entry) => entry.type === type);
}

function renderDate() {
  const now = new Date();
  $("#todayLabel").textContent = formatLongDate(now);
  $("#weekdayChip").textContent = weekdays[now.getDay()];
}

function renderStats() {
  const todayClasses = entries.filter((entry) => entry.type === "class" && Number(entry.day) === new Date().getDay());
  const assignments = getTaskEntries("assignment");
  const exams = getTaskEntries("exam");
  const activeAssignments = assignments.filter((entry) => !entry.completed).length;
  const completedAssignments = assignments.length - activeAssignments;
  const progress = assignments.length ? Math.round((completedAssignments / assignments.length) * 100) : 0;

  $("#classesTodayCount").textContent = String(todayClasses.length);
  $("#tasksLeftCount").textContent = String(activeAssignments);
  $("#upcomingExamsCount").textContent = String(exams.filter((entry) => !entry.completed && entry.dueDate >= currentDateString()).length);
  $("#classNavCount").textContent = String(getTaskEntries("class").length);
  $("#assignmentNavCount").textContent = String(activeAssignments);
  $("#examNavCount").textContent = String(exams.length);
  $("#progressLabel").textContent = `${progress}%`;
  $("#progressBar").style.width = `${progress}%`;
  $("#progressDetail").textContent = assignments.length
    ? `${completedAssignments} of ${assignments.length} assignments completed`
    : "Add an assignment to start tracking your progress";
}

function renderUpcoming() {
  const items = entries
    .filter((entry) => entry.type !== "class" && !entry.completed)
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))
    .slice(0, 4);
  const container = $("#upcomingList");

  if (!items.length) {
    container.innerHTML = '<div class="empty-state"><strong>Nothing on the horizon.</strong>Add an assignment or exam whenever you are ready.</div>';
    return;
  }

  container.innerHTML = items.map((entry) => {
    const overdue = entry.dueDate && entry.dueDate < currentDateString();
    return `
      <article class="upcoming-item">
        <div class="date-tile"><strong>${escapeHTML(entry.dueDate ? formatDueDate(entry.dueDate).split(" ")[1] : "—")}</strong><span>${escapeHTML(entry.dueDate ? formatDueDate(entry.dueDate).split(" ")[0] : "TBD")}</span></div>
        <div>
          <p class="item-title">${escapeHTML(entry.title)}</p>
          <p class="item-subtitle">${escapeHTML(entry.course || "Personal")}</p>
          ${overdue ? '<span class="overdue-label">Past due</span>' : ""}
        </div>
        <span class="type-badge ${escapeHTML(entry.type)}">${entry.type === "exam" ? "Exam" : "Task"}</span>
      </article>`;
  }).join("");
}

function renderTodayClasses() {
  const today = new Date().getDay();
  const classes = entries
    .filter((entry) => entry.type === "class" && Number(entry.day) === today)
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  const container = $("#todayClassesList");

  if (!classes.length) {
    container.innerHTML = '<div class="empty-state"><strong>A little breathing room.</strong>No classes scheduled today. Add your weekly classes in Quick add.</div>';
    return;
  }

  container.innerHTML = classes.map((entry) => `
    <article class="class-row">
      <span class="class-time">${escapeHTML(formatTime(entry.time))}</span>
      <span class="class-marker" aria-hidden="true"></span>
      <div class="class-info">
        <p class="item-title">${escapeHTML(entry.title)}</p>
        <p class="item-subtitle">${escapeHTML(entry.course || "Course not set")}${entry.location ? ` · ${escapeHTML(entry.location)}` : ""}</p>
      </div>
    </article>`).join("");
}

const viewDetails = {
  classes: {
    title: "My classes",
    eyebrow: "YOUR WEEKLY SCHEDULE",
    description: "A quick look at the classes on your weekly timetable.",
  },
  assignments: {
    title: "Assignments",
    eyebrow: "SMALL STEPS ADD UP",
    description: "Keep track of what's due and celebrate what you've finished.",
  },
  exams: {
    title: "Exams",
    eyebrow: "YOU'VE GOT THIS",
    description: "Keep important exam dates where you can see them.",
  },
};

function formatEntryDetails(entry) {
  if (entry.type === "class") {
    return [weekdays[Number(entry.day)], formatTime(entry.time), entry.location].filter(Boolean).join(" · ");
  }
  return [entry.dueDate ? `Due ${formatDueDate(entry.dueDate)}` : "No due date", entry.course].filter(Boolean).join(" · ");
}

function renderManageList() {
  const search = $("#searchInput").value.trim().toLocaleLowerCase();
  const entryTypeForView = {
    classes: "class",
    assignments: "assignment",
    exams: "exam",
  }[activeView];
  const filtered = entries
    .filter((entry) => entry.type === entryTypeForView)
    .filter((entry) => `${entry.title} ${entry.course || ""}`.toLocaleLowerCase().includes(search))
    .sort((a, b) => {
      if (activeView === "classes") return Number(a.day) - Number(b.day) || (a.time || "").localeCompare(b.time || "");
      return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
    });

  $("#resultCount").textContent = `${filtered.length} ${filtered.length === 1 ? "item" : "items"}`;
  if (!filtered.length) {
    $("#entriesList").innerHTML = `<div class="panel empty-state"><strong>${search ? "No matches found." : `No ${escapeHTML(activeView)} added yet.`}</strong>${search ? "Try another search." : "Use Quick add to put something on your planner."}</div>`;
    return;
  }

  $("#entriesList").innerHTML = filtered.map((entry) => {
    const isComplete = Boolean(entry.completed);
    const symbol = entry.type === "class" ? "▦" : entry.type === "exam" ? "✦" : "☷";
    return `
      <article class="entry-card${isComplete ? " is-complete" : ""}">
        <div class="entry-symbol ${escapeHTML(entry.type)}" aria-hidden="true">${symbol}</div>
        <div class="entry-main">
          <p class="entry-main-title">${escapeHTML(entry.title)}</p>
          <div class="entry-meta"><span>${escapeHTML(formatEntryDetails(entry))}</span></div>
        </div>
        <div class="entry-actions">
          ${entry.type !== "class" ? `<button class="action-button" type="button" data-action="toggle" data-id="${escapeHTML(entry.id)}" aria-label="${isComplete ? "Mark incomplete" : "Mark complete"}">${isComplete ? "Undo" : "Done"}</button>` : ""}
          <button class="action-button delete" type="button" data-action="delete" data-id="${escapeHTML(entry.id)}" aria-label="Delete ${escapeHTML(entry.title)}">Delete</button>
        </div>
      </article>`;
  }).join("");
}

function renderNavigation() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    const selected = button.dataset.view === activeView;
    if (button.classList.contains("nav-link")) {
      button.classList.toggle("is-active", selected);
      if (selected) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
  });
  $("#breadcrumbCurrent").textContent = activeView === "overview" ? "Overview" : viewDetails[activeView].title;
  $("#overviewView").hidden = activeView !== "overview";
  $("#manageView").hidden = activeView === "overview";
  if (activeView !== "overview") {
    const details = viewDetails[activeView];
    $("#manageTitle").textContent = details.title;
    $("#manageEyebrow").textContent = details.eyebrow;
    $("#manageDescription").textContent = details.description;
    $("#searchInput").value = "";
    renderManageList();
  }
}

function render() {
  renderDate();
  renderStats();
  renderUpcoming();
  renderTodayClasses();
  renderNavigation();
}

function updateFormFields() {
  const isClass = entryType.value === "class";
  taskFields.hidden = isClass;
  classFields.hidden = !isClass;
  $("#entryDueDate").required = !isClass;
  $("#entryDay").required = isClass;
  $("#entryTime").required = isClass;
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    activeView = button.dataset.view;
    renderNavigation();
  });
});

entryType.addEventListener("change", updateFormFields);
$("#searchInput").addEventListener("input", renderManageList);

entryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(entryForm);
  const type = String(formData.get("type"));
  const newEntry = {
    id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title: String(formData.get("title")).trim(),
    course: String(formData.get("course")).trim(),
  };

  if (type === "class") {
    newEntry.day = Number(formData.get("day"));
    newEntry.time = String(formData.get("time"));
    newEntry.location = String(formData.get("location")).trim();
  } else {
    newEntry.dueDate = String(formData.get("dueDate"));
    newEntry.completed = false;
  }

  entries.push(newEntry);
  if (!saveEntries()) {
    entries.pop();
    return;
  }
  entryForm.reset();
  updateFormFields();
  render();
  showToast(`${type === "class" ? "Class" : type === "exam" ? "Exam" : "Assignment"} added to your planner.`);
});

$("#entriesList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const index = entries.findIndex((entry) => entry.id === button.dataset.id);
  if (index < 0) return;

  if (button.dataset.action === "delete") {
    const [removed] = entries.splice(index, 1);
    if (!saveEntries()) {
      entries.splice(index, 0, removed);
      return;
    }
    render();
    showToast("Removed from your planner.");
    return;
  }

  if (button.dataset.action === "toggle") {
    entries[index].completed = !entries[index].completed;
    if (!saveEntries()) {
      entries[index].completed = !entries[index].completed;
      return;
    }
    render();
    showToast(entries[index].completed ? "Nice work — marked complete." : "Assignment marked incomplete.");
  }
});

try {
  entries = loadEntries();
  updateFormFields();
  render();
} catch (error) {
  console.error("Could not load planner entries.", error);
  entries = [];
  updateFormFields();
  render();
  showToast("Couldn't load saved planner data. Check browser storage settings.", true);
}
