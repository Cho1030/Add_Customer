const STORAGE_KEY = "alba-scheduler-state-v4";
const TODAY = "2026-06-23";
const DATE_WINDOW_DAYS = 90;
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

const state = {
  applicants: [],
  assignments: {},
  ui: {
    formCollapsed: false,
  },
  selectedApplicantId: "all",
  selectedDate: TODAY,
  currentMonth: TODAY.slice(0, 7),
  draftDates: [],
  editingId: null,
};

const elements = {
  layout: document.querySelector(".layout"),
  formPanel: document.querySelector("#formPanel"),
  formPanelBody: document.querySelector("#formPanelBody"),
  toggleFormButton: document.querySelector("#toggleFormButton"),
  applicantForm: document.querySelector("#applicantForm"),
  applicantId: document.querySelector("#applicantId"),
  name: document.querySelector("#name"),
  phone: document.querySelector("#phone"),
  age: document.querySelector("#age"),
  gender: document.querySelector("#gender"),
  region: document.querySelector("#region"),
  notes: document.querySelector("#notes"),
  dateInput: document.querySelector("#dateInput"),
  draftDates: document.querySelector("#draftDates"),
  applicantList: document.querySelector("#applicantList"),
  applicantFilter: document.querySelector("#applicantFilter"),
  calendar: document.querySelector("#calendar"),
  calendarTitle: document.querySelector("#calendarTitle"),
  selectedDateTitle: document.querySelector("#selectedDateTitle"),
  selectedDateHint: document.querySelector("#selectedDateHint"),
  selectedDateApplicants: document.querySelector("#selectedDateApplicants"),
  prevMonthButton: document.querySelector("#prevMonthButton"),
  nextMonthButton: document.querySelector("#nextMonthButton"),
  addDateButton: document.querySelector("#addDateButton"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  resetDataButton: document.querySelector("#resetDataButton"),
};

const defaultApplicants = createDefaultApplicants();

init();

function init() {
  loadState();
  bindEvents();
  render();
}

function bindEvents() {
  elements.applicantForm.addEventListener("submit", handleApplicantSubmit);
  elements.addDateButton.addEventListener("click", handleDraftDateAdd);
  elements.cancelEditButton.addEventListener("click", resetForm);
  elements.toggleFormButton.addEventListener("click", toggleFormPanel);
  elements.applicantFilter.addEventListener("change", (event) => {
    state.selectedApplicantId = event.target.value;
    render();
  });
  elements.prevMonthButton.addEventListener("click", () => {
    state.currentMonth = shiftMonth(state.currentMonth, -1);
    renderCalendar();
  });
  elements.nextMonthButton.addEventListener("click", () => {
    state.currentMonth = shiftMonth(state.currentMonth, 1);
    renderCalendar();
  });
  elements.resetDataButton.addEventListener("click", () => {
    const confirmReset = window.confirm("초기 데이터로 되돌릴까요? 저장된 선택 상태와 수정 내용이 함께 초기화됩니다.");
    if (!confirmReset) {
      return;
    }

    state.applicants = structuredClone(defaultApplicants);
    state.assignments = {};
    state.ui.formCollapsed = false;
    state.selectedApplicantId = "all";
    state.selectedDate = TODAY;
    state.currentMonth = TODAY.slice(0, 7);
    state.draftDates = [];
    state.editingId = null;
    saveState();
    resetForm();
    render();
  });
}

function loadState() {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    state.applicants = structuredClone(defaultApplicants);
    state.assignments = {};
    state.ui.formCollapsed = false;
    saveState();
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    state.applicants = Array.isArray(parsed.applicants) ? parsed.applicants : structuredClone(defaultApplicants);
    state.assignments = parsed.assignments && typeof parsed.assignments === "object" ? parsed.assignments : {};
    state.ui = {
      formCollapsed: Boolean(parsed.ui?.formCollapsed),
    };
    cleanupAssignments();
  } catch (error) {
    state.applicants = structuredClone(defaultApplicants);
    state.assignments = {};
    state.ui.formCollapsed = false;
  }
}

function saveState() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    applicants: state.applicants,
    assignments: state.assignments,
    ui: state.ui,
  }));
}

function toggleFormPanel() {
  state.ui.formCollapsed = !state.ui.formCollapsed;
  saveState();
  renderFormPanel();
}

function renderFormPanel() {
  const collapsed = state.ui.formCollapsed;
  elements.layout.classList.toggle("form-collapsed", collapsed);
  elements.formPanel.classList.toggle("is-collapsed", collapsed);
  elements.formPanel.classList.toggle("hidden", collapsed);
  elements.toggleFormButton.textContent = collapsed ? "등록란 펼치기" : "등록란 접기";
  elements.toggleFormButton.setAttribute("aria-expanded", String(!collapsed));
}

function cleanupAssignments() {
  for (const [date, assignment] of Object.entries(state.assignments)) {
    const availableIds = new Set(
      state.applicants
        .filter((applicant) => applicant.availableDates.includes(date))
        .map((applicant) => applicant.id),
    );

    if (!availableIds.size) {
      delete state.assignments[date];
      continue;
    }

    const selectedApplicantIds = Array.isArray(assignment?.selectedApplicantIds)
      ? assignment.selectedApplicantIds.filter((id) => availableIds.has(id))
      : [];

    const removedApplicantIds = Array.isArray(assignment?.removedApplicantIds)
      ? assignment.removedApplicantIds.filter((id) => availableIds.has(id) && !selectedApplicantIds.includes(id))
      : [];

    const normalizedRemovedIds = [...availableIds].filter((id) => !selectedApplicantIds.includes(id));

    if (!selectedApplicantIds.length && !normalizedRemovedIds.length) {
      delete state.assignments[date];
      continue;
    }

    state.assignments[date] = {
      selectedApplicantIds,
      removedApplicantIds: selectedApplicantIds.length ? normalizedRemovedIds : removedApplicantIds,
    };
  }
}

function handleDraftDateAdd() {
  const value = elements.dateInput.value;
  if (!value) {
    return;
  }

  if (!state.draftDates.includes(value)) {
    state.draftDates.push(value);
    state.draftDates.sort();
  }

  elements.dateInput.value = "";
  renderDraftDates();
}

function handleApplicantSubmit(event) {
  event.preventDefault();

  const payload = {
    id: state.editingId ?? createId(),
    name: elements.name.value.trim(),
    phone: normalizePhone(elements.phone.value),
    age: Number(elements.age.value),
    gender: elements.gender.value,
    region: elements.region.value.trim(),
    notes: elements.notes.value.trim(),
    availableDates: [...new Set(state.draftDates)].sort(),
  };

  if (!payload.name || !payload.phone || !payload.region || Number.isNaN(payload.age)) {
    return;
  }

  if (state.editingId) {
    state.applicants = state.applicants.map((applicant) => applicant.id === state.editingId ? payload : applicant);
  } else {
    state.applicants.unshift(payload);
  }

  cleanupAssignments();
  state.selectedApplicantId = payload.id;
  state.selectedDate = payload.availableDates[0] ?? state.selectedDate;
  saveState();
  resetForm();
  render();
}

function resetForm() {
  state.draftDates = [];
  state.editingId = null;
  elements.applicantForm.reset();
  elements.applicantId.value = "";
  elements.gender.value = "여성";
  renderDraftDates();
  elements.cancelEditButton.classList.add("hidden");
}

function render() {
  renderFormPanel();
  renderFilter();
  renderDraftDates();
  renderApplicantList();
  renderCalendar();
  renderSelectedDatePanel();
}

function renderDraftDates() {
  if (!state.draftDates.length) {
    elements.draftDates.innerHTML = "";
    return;
  }

  elements.draftDates.innerHTML = state.draftDates.map((date) => `
    <span class="pill">
      ${formatDateLong(date)}
      <button type="button" data-action="remove-draft-date" data-date="${date}">x</button>
    </span>
  `).join("");

  elements.draftDates.querySelectorAll("[data-action='remove-draft-date']").forEach((button) => {
    button.addEventListener("click", () => {
      state.draftDates = state.draftDates.filter((date) => date !== button.dataset.date);
      renderDraftDates();
    });
  });
}

function renderFilter() {
  const options = [
    `<option value="all">전체 지원자 보기</option>`,
    ...state.applicants
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "ko"))
      .map((applicant) => `<option value="${applicant.id}">${escapeHtml(applicant.name)}</option>`),
  ];

  elements.applicantFilter.innerHTML = options.join("");
  elements.applicantFilter.value = state.selectedApplicantId;
}

function renderApplicantList() {
  if (!state.applicants.length) {
    elements.applicantList.innerHTML = `<div class="empty-state">등록된 지원자가 없습니다.</div>`;
    return;
  }

  const sortedApplicants = state.applicants.slice().sort((a, b) => a.name.localeCompare(b.name, "ko"));

  elements.applicantList.innerHTML = sortedApplicants.map((applicant) => {
    const selectedCount = countSelectedDatesForApplicant(applicant.id);

    return `
      <article class="applicant-card">
        <div class="card-top">
          <div>
            <h3>${escapeHtml(applicant.name)}</h3>
            <p class="meta-line">${escapeHtml(applicant.gender)} · ${applicant.age}세 · ${escapeHtml(applicant.region)}</p>
          </div>
          <span class="tag">${applicant.availableDates.length}일 등록</span>
        </div>
        <div class="card-tags">
          <span class="tag">${escapeHtml(applicant.phone)}</span>
          <span class="tag">${escapeHtml(getAvailabilitySummary(applicant))}</span>
          <span class="tag ${selectedCount ? "tag-confirmed" : ""}">선택 ${selectedCount}건</span>
        </div>
        <p>${escapeHtml(applicant.notes || "메모 없음")}</p>
        <div class="card-actions">
          <button class="secondary-button" type="button" data-action="focus-applicant" data-id="${applicant.id}">달력에서 보기</button>
          <button class="ghost-button" type="button" data-action="edit-applicant" data-id="${applicant.id}">수정</button>
          <button class="ghost-button" type="button" data-action="delete-applicant" data-id="${applicant.id}">삭제</button>
        </div>
      </article>
    `;
  }).join("");

  elements.applicantList.querySelectorAll("[data-action]").forEach((button) => {
    const { action, id } = button.dataset;

    if (action === "focus-applicant") {
      button.addEventListener("click", () => {
        state.selectedApplicantId = id;
        render();
      });
    }

    if (action === "edit-applicant") {
      button.addEventListener("click", () => {
        state.ui.formCollapsed = false;
        startEditApplicant(id);
        saveState();
        renderFormPanel();
      });
    }

    if (action === "delete-applicant") {
      button.addEventListener("click", () => deleteApplicant(id));
    }
  });
}

function renderCalendar() {
  const monthDate = new Date(`${state.currentMonth}-01T00:00:00`);
  elements.calendarTitle.textContent = `${monthDate.getFullYear()}년 ${monthDate.getMonth() + 1}월`;

  const weekdayHeader = WEEKDAY_LABELS.map((label) => `<div class="weekday">${label}</div>`).join("");
  const cells = buildCalendarCells(monthDate).map((date) => renderCalendarCell(date)).join("");
  elements.calendar.innerHTML = weekdayHeader + cells;

  elements.calendar.querySelectorAll(".calendar-cell").forEach((cell) => {
    cell.addEventListener("click", () => {
      state.selectedDate = cell.dataset.date;
      const selectedApplicant = getSelectedApplicant();
      if (selectedApplicant) {
        toggleApplicantDate(selectedApplicant.id, cell.dataset.date);
      }
      render();
    });
  });
}

function renderCalendarCell(date) {
  const dateKey = toDateKey(date);
  const visibleMatches = getVisibleApplicantsForDate(dateKey);
  const assignment = state.assignments[dateKey];
  const selectedApplicant = getSelectedApplicant();
  const isSelected = state.selectedDate === dateKey;
  const isCurrentMonth = dateKey.startsWith(state.currentMonth);
  const selectedApplicantIds = assignment?.selectedApplicantIds ?? [];
  const selectedApplicants = selectedApplicantIds
    .map((id) => state.applicants.find((applicant) => applicant.id === id))
    .filter(Boolean);
  const isFocusedMatch = Boolean(selectedApplicant && selectedApplicant.availableDates.includes(dateKey));

  const labels = (selectedApplicants.length ? selectedApplicants : visibleMatches).slice(0, 2).map((applicant) => {
    const isChosen = selectedApplicantIds.includes(applicant.id);
    return `
      <span class="match-name ${selectedApplicant?.id === applicant.id ? "focused" : ""} ${isChosen ? "confirmed" : ""}">
        ${escapeHtml(applicant.name)}
      </span>
    `;
  }).join("");

  const baseCount = selectedApplicants.length ? selectedApplicants.length : visibleMatches.length;
  const extraCount = baseCount > 2 ? `<span class="match-name">+${baseCount - 2}명</span>` : "";

  return `
    <button
      class="calendar-cell ${isCurrentMonth ? "" : "muted"} ${isSelected ? "selected" : ""} ${visibleMatches.length ? "has-match" : ""} ${selectedApplicants.length ? "is-confirmed" : ""}"
      data-date="${dateKey}"
      type="button"
    >
      <header>
        <span>${date.getDate()}</span>
        <span class="availability-count">${selectedApplicants.length ? `선택 ${selectedApplicants.length}` : selectedApplicant ? (isFocusedMatch ? "선택" : "0") : visibleMatches.length}</span>
      </header>
      <div class="match-list">
        ${labels}
        ${selectedApplicant || baseCount <= 2 ? "" : extraCount}
      </div>
    </button>
  `;
}

function renderSelectedDatePanel() {
  elements.selectedDateTitle.textContent = `${formatDateLong(state.selectedDate)} 지원 상태`;

  const matches = getApplicantsForDate(state.selectedDate);
  const assignment = state.assignments[state.selectedDate];
  const selectedIds = new Set(assignment?.selectedApplicantIds ?? []);
  const removedIds = new Set(assignment?.removedApplicantIds ?? []);

  if (!matches.length) {
    const selectedApplicant = getSelectedApplicant();
    elements.selectedDateHint.textContent = selectedApplicant
      ? "선택한 지원자가 없으면 이 날짜를 눌러 가능일을 추가할 수 있습니다."
      : "현재 이 날짜에 등록된 지원자가 없습니다.";
    elements.selectedDateApplicants.innerHTML = `<div class="empty-state">표시할 지원자가 없습니다.</div>`;
    return;
  }

  elements.selectedDateHint.textContent = selectedIds.size
    ? "여러 명을 동시에 선택할 수 있습니다. 선택된 지원자는 강조되고, 나머지 지원자는 자동으로 삭제표시됩니다. 변경 내용은 바로 저장됩니다."
    : "아래에서 원하는 지원자를 여러 명 선택할 수 있습니다.";

  elements.selectedDateApplicants.innerHTML = matches.map((applicant) => {
    const isSelectedApplicant = selectedIds.has(applicant.id);
    const isRemovedApplicant = removedIds.has(applicant.id);
    const cardClass = isSelectedApplicant ? "status-confirmed" : isRemovedApplicant ? "status-removed" : "status-pending";
    const badgeLabel = isSelectedApplicant ? "선택됨" : isRemovedApplicant ? "삭제표시" : "대기";
    const actionButton = isSelectedApplicant
      ? `<button class="ghost-button" type="button" data-action="toggle-selection" data-applicant-id="${applicant.id}" data-date="${state.selectedDate}">선택 해제</button>`
      : `<button class="primary-button" type="button" data-action="toggle-selection" data-applicant-id="${applicant.id}" data-date="${state.selectedDate}">이 날짜에 선택</button>`;

    return `
      <article class="date-applicant-card ${cardClass}">
        <div class="date-card-top">
          <div>
            <h4>${escapeHtml(applicant.name)}</h4>
            <p>${escapeHtml(applicant.phone)} · ${escapeHtml(applicant.region)}</p>
          </div>
          <span class="status-badge ${cardClass}">${badgeLabel}</span>
        </div>
        <p>${escapeHtml(applicant.notes || "메모 없음")}</p>
        <div class="date-card-actions">
          ${actionButton}
        </div>
      </article>
    `;
  }).join("");

  elements.selectedDateApplicants.querySelectorAll("[data-action='toggle-selection']").forEach((button) => {
    button.addEventListener("click", () => {
      toggleSelectedApplicantForDate(button.dataset.date, button.dataset.applicantId);
      render();
    });
  });
}

function startEditApplicant(applicantId) {
  const applicant = state.applicants.find((item) => item.id === applicantId);
  if (!applicant) {
    return;
  }

  state.editingId = applicant.id;
  state.draftDates = [...applicant.availableDates];
  elements.applicantId.value = applicant.id;
  elements.name.value = applicant.name;
  elements.phone.value = applicant.phone;
  elements.age.value = applicant.age;
  elements.gender.value = applicant.gender;
  elements.region.value = applicant.region;
  elements.notes.value = applicant.notes;
  elements.cancelEditButton.classList.remove("hidden");
  renderDraftDates();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteApplicant(applicantId) {
  const applicant = state.applicants.find((item) => item.id === applicantId);
  if (!applicant) {
    return;
  }

  const confirmed = window.confirm(`${applicant.name} 지원자를 삭제할까요? 관련된 날짜 선택 상태도 함께 정리됩니다.`);
  if (!confirmed) {
    return;
  }

  state.applicants = state.applicants.filter((item) => item.id !== applicantId);
  cleanupAssignments();

  if (state.selectedApplicantId === applicantId) {
    state.selectedApplicantId = "all";
  }
  if (state.editingId === applicantId) {
    resetForm();
  }

  saveState();
  render();
}

function toggleApplicantDate(applicantId, date) {
  state.applicants = state.applicants.map((applicant) => {
    if (applicant.id !== applicantId) {
      return applicant;
    }

    const exists = applicant.availableDates.includes(date);
    const nextDates = exists
      ? applicant.availableDates.filter((item) => item !== date)
      : [...applicant.availableDates, date].sort();

    return { ...applicant, availableDates: nextDates };
  });

  cleanupAssignments();
  saveState();
}

function toggleSelectedApplicantForDate(date, applicantId) {
  const availableIds = getApplicantsForDate(date).map((applicant) => applicant.id);
  if (!availableIds.includes(applicantId)) {
    return;
  }

  const currentSelection = new Set(state.assignments[date]?.selectedApplicantIds ?? []);

  if (currentSelection.has(applicantId)) {
    currentSelection.delete(applicantId);
  } else {
    currentSelection.add(applicantId);
  }

  const selectedApplicantIds = availableIds.filter((id) => currentSelection.has(id));

  if (!selectedApplicantIds.length) {
    delete state.assignments[date];
    saveState();
    return;
  }

  state.assignments[date] = {
    selectedApplicantIds,
    removedApplicantIds: availableIds.filter((id) => !currentSelection.has(id)),
  };
  saveState();
}

function countSelectedDatesForApplicant(applicantId) {
  return Object.values(state.assignments).filter(
    (assignment) => Array.isArray(assignment?.selectedApplicantIds) && assignment.selectedApplicantIds.includes(applicantId),
  ).length;
}

function getApplicantsForDate(date) {
  return state.applicants
    .filter((applicant) => applicant.availableDates.includes(date))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

function getVisibleApplicantsForDate(date) {
  const selectedApplicant = getSelectedApplicant();
  if (!selectedApplicant) {
    return getApplicantsForDate(date);
  }
  return selectedApplicant.availableDates.includes(date) ? [selectedApplicant] : [];
}

function getSelectedApplicant() {
  if (state.selectedApplicantId === "all") {
    return null;
  }
  return state.applicants.find((applicant) => applicant.id === state.selectedApplicantId) ?? null;
}

function buildCalendarCells(monthDate) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const nextDate = new Date(startDate);
    nextDate.setDate(startDate.getDate() + index);
    return nextDate;
  });
}

function shiftMonth(monthKey, amount) {
  const [year, month] = monthKey.split("-").map(Number);
  const target = new Date(year, month - 1 + amount, 1);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
}

function toDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDateLong(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAY_LABELS[date.getDay()]}요일`;
}

function normalizePhone(value) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  return value.trim();
}

function createId() {
  return `applicant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getAvailabilitySummary(applicant) {
  if (!applicant.availableDates.length) {
    return "날짜 미등록";
  }

  const first = applicant.availableDates[0];
  const last = applicant.availableDates[applicant.availableDates.length - 1];

  if (first === last) {
    return formatShortDate(first);
  }

  return `${formatShortDate(first)} ~ ${formatShortDate(last)}`;
}

function formatShortDate(dateKey) {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function createDefaultApplicants() {
  return [
    {
      id: createId(),
      name: "박소연",
      phone: "010-5738-7733",
      age: 38,
      gender: "여성",
      region: "서울 금천구",
      notes: "원문: 25일 목요일부터",
      availableDates: enumerateFrom("2026-06-25", "2026-09-21"),
    },
    {
      id: createId(),
      name: "이근영",
      phone: "010-6798-4022",
      age: 34,
      gender: "남성",
      region: "서울 신림",
      notes: "원문: 6.24 25 26 27 28",
      availableDates: ["2026-06-24", "2026-06-25", "2026-06-26", "2026-06-27", "2026-06-28"],
    },
    {
      id: createId(),
      name: "최진",
      phone: "010-3688-6498",
      age: 32,
      gender: "남성",
      region: "인천, 대림",
      notes: "원문: 이번달은 내일부터 26일 말고는 다 가능합니다",
      availableDates: ["2026-06-24", "2026-06-25", "2026-06-27", "2026-06-28", "2026-06-29", "2026-06-30"],
    },
    {
      id: createId(),
      name: "김의진",
      phone: "010-3775-0411",
      age: 21,
      gender: "여성",
      region: "구로구",
      notes: "원문: 다음주까지는 월/화/수 그 이후는 상관없어요",
      availableDates: createKimUiJinDates(),
    },
    {
      id: createId(),
      name: "유태암",
      phone: "010-7467-5820",
      age: 26,
      gender: "남성",
      region: "서울 관악구 신대방역 인근",
      notes: "원문: 모두 가능(고정 스케줄 없음)",
      availableDates: enumerateFrom("2026-06-23", "2026-09-21"),
    },
    {
      id: createId(),
      name: "이서준",
      phone: "010-8279-5417",
      age: 28,
      gender: "남성",
      region: "관악구 (구로디지털단지)",
      notes: "원문: 25일 목요일",
      availableDates: ["2026-06-25"],
    },
  ];
}

function createKimUiJinDates() {
  const start = new Date(`${TODAY}T00:00:00`);
  const endOfNextWeek = new Date(start);
  endOfNextWeek.setDate(start.getDate() + 13);

  const finalDate = new Date(start);
  finalDate.setDate(start.getDate() + DATE_WINDOW_DAYS);

  const result = [];
  const cursor = new Date(start);

  while (cursor <= finalDate) {
    const dateKey = toDateKey(cursor);
    if (cursor <= endOfNextWeek) {
      if ([1, 2, 3].includes(cursor.getDay())) {
        result.push(dateKey);
      }
    } else {
      result.push(dateKey);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

function enumerateFrom(startDateKey, endDateKey) {
  const dates = [];
  const cursor = new Date(`${startDateKey}T00:00:00`);
  const end = new Date(`${endDateKey}T00:00:00`);

  while (cursor <= end) {
    dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
