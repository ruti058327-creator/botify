const token = localStorage.getItem('token') || localStorage.getItem('jwtToken');
const botsList = document.getElementById('secretaryBotsList');
const botsStatus = document.getElementById('botsStatus');
const addSecretaryBotLink = document.getElementById('addSecretaryBot');
const managementPanel = document.getElementById('managementPanel');
const settingsForm = document.getElementById('settingsForm');
const settingsStatus = document.getElementById('settingsStatus');
const calendarStatus = document.getElementById('calendarStatus');
const calendarGrid = document.getElementById('appointmentsCalendar');
const calendarMonthTitle = document.getElementById('calendarMonth');
const appointmentDetails = document.getElementById('appointmentDetails');
const appointmentDetailsList = document.getElementById('appointmentDetailsList');
const vacationForm = document.getElementById('vacationForm');
const vacationStatus = document.getElementById('vacationStatus');
const vacationDateInput = document.getElementById('vacationDate');
const vacationMessageInput = document.getElementById('vacationMessage');
const confirmVacationButton = document.getElementById('confirmVacation');
const currentMonth = new Date();
currentMonth.setDate(1);

let selectedBot = null;
let appointmentsRequestId = 0;

function setStatus(element, message, type = '') {
  element.textContent = message;
  element.className = `status-message${type ? ` status-${type}` : ''}`;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'הבקשה נכשלה');
  }
  return data;
}

function renderBotList(bots, quota = { canCreate: false, botCount: 0, botLimit: 1 }) {
  botsList.replaceChildren();
  addSecretaryBotLink.href = quota.canCreate
    ? 'secretary-dashboard.html'
    : 'pricing.html?required=secretary-bot';
  addSecretaryBotLink.textContent = quota.canCreate
    ? 'הוספת בוט מזכירה'
    : 'שדרוג מסלול להוספת בוט';
  if (!bots.length) {
    setStatus(botsStatus, `עדיין לא יצרת בוט מזכירה פעיל. המכסה הנוכחית: ${quota.botCount}/${quota.botLimit}.`);
    return;
  }

  const limitText = Number.isFinite(quota.botLimit) ? quota.botLimit : 'ללא הגבלה';
  setStatus(botsStatus, `בוטי מזכירה: ${quota.botCount} מתוך ${limitText} במסלול ${quota.planId}.`);
  for (const bot of bots) {
    const card = document.createElement('article');
    card.className = 'secretary-bot-card';
    const description = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = bot.botUrlKey;
    const hours = document.createElement('p');
    hours.textContent = `${bot.openTime}–${bot.closeTime} · יום חופש: ${bot.dayOff}`;
    const selectButton = document.createElement('button');
    selectButton.className = 'bot-select-button';
    selectButton.type = 'button';
    selectButton.textContent = 'עריכה ויומן';
    selectButton.addEventListener('click', () => selectBot(bot));
    const deleteButton = document.createElement('button');
    deleteButton.className = 'secondary-button';
    deleteButton.type = 'button';
    deleteButton.textContent = 'מחיקת בוט';
    deleteButton.addEventListener('click', async () => {
      if (!window.confirm(`למחוק את בוט המזכירה "${bot.botUrlKey}" ואת יומן התורים שלו?`)) return;
      deleteButton.disabled = true;
      try {
        await requestJson(`/api/secretary/${encodeURIComponent(bot.botUrlKey)}`, { method: 'DELETE' });
        if (selectedBot?.botUrlKey === bot.botUrlKey) {
          selectedBot = null;
          managementPanel.hidden = true;
        }
        await loadBots();
      } catch (error) {
        setStatus(botsStatus, error.message || 'שגיאה במחיקת הבוט.', 'error');
        deleteButton.disabled = false;
      }
    });
    description.append(title, hours);
    card.append(description, selectButton, deleteButton);
    botsList.appendChild(card);
  }
}

async function loadBots() {
  if (!token) {
    setStatus(botsStatus, 'יש להתחבר כדי לנהל את הבוטים.', 'error');
    return;
  }

  try {
    const data = await requestJson('/api/secretary/mine');
    renderBotList(data.bots || [], data.quota);
  } catch (error) {
    setStatus(botsStatus, error.message || 'שגיאה בטעינת הבוטים.', 'error');
  }
}

function populateSettings(bot) {
  document.getElementById('botUrlKey').value = bot.botUrlKey || '';
  document.getElementById('dayOff').value = bot.dayOff || 'שישי';
  document.getElementById('openTime').value = bot.openTime || '09:00';
  document.getElementById('closeTime').value = bot.closeTime || '18:00';
  document.getElementById('appointmentDurationMinutes').value = bot.appointmentDurationMinutes || 30;
  document.getElementById('breakDurationMinutes').value = bot.breakDurationMinutes ?? 10;
  document.getElementById('defaultPrice').value = bot.defaultPrice ?? 150;
}

async function selectBot(bot) {
  selectedBot = bot;
  managementPanel.hidden = false;
  document.getElementById('selectedBotTitle').textContent = `ניהול הבוט: ${bot.botUrlKey}`;
  document.getElementById('bookingPageLink').href = `client-booking.html?bot=${encodeURIComponent(bot.botUrlKey)}`;
  populateSettings(bot);
  appointmentDetails.hidden = true;
  await loadAppointments();
  managementPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function formatGregorianMonth(date) {
  return new Intl.DateTimeFormat('he-IL', {
    month: 'long',
    year: 'numeric',
    calendar: 'gregory',
    numberingSystem: 'latn'
  }).format(date);
}

function showAppointmentDetails(appointment) {
  const fields = [
    ['שם מלא', appointment.clientName],
    ['תעודת זהות', appointment.idNumber || 'לא נמסרה'],
    ['טלפון', appointment.phone],
    ['דוא״ל', appointment.email],
    ['תאריך', appointment.date],
    ['שעה', appointment.time]
  ];

  appointmentDetailsList.replaceChildren();
  for (const [label, value] of fields) {
    const item = document.createElement('div');
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = value;
    item.append(term, description);
    appointmentDetailsList.appendChild(item);
  }
  appointmentDetails.hidden = false;
}

async function loadAppointments() {
  if (!selectedBot) return;

  const requestId = ++appointmentsRequestId;
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1;
  calendarMonthTitle.textContent = formatGregorianMonth(currentMonth);
  calendarGrid.replaceChildren();
  setStatus(calendarStatus, 'טוען תורים...');

  try {
    const data = await requestJson(
      `/api/secretary/${encodeURIComponent(selectedBot.botUrlKey)}/appointments?year=${year}&month=${month}`
    );
    if (requestId !== appointmentsRequestId) return;

    const weekdays = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
    for (const weekday of weekdays) {
      const heading = document.createElement('div');
      heading.className = 'calendar-weekday';
      heading.textContent = weekday;
      calendarGrid.appendChild(heading);
    }

    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const confirmedAppointments = (data.appointments || []).filter(appointment => appointment.status === 'confirmed');
    const appointmentsByDate = new Map();
    for (const appointment of confirmedAppointments) {
      const dayAppointments = appointmentsByDate.get(appointment.date) || [];
      dayAppointments.push(appointment);
      appointmentsByDate.set(appointment.date, dayAppointments);
    }

    for (let emptyDay = 0; emptyDay < firstDay; emptyDay++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'calendar-day-empty';
      calendarGrid.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const cell = document.createElement('div');
      cell.className = 'calendar-day-cell';
      const dayNumber = document.createElement('span');
      dayNumber.className = 'calendar-day-number';
      dayNumber.textContent = day;
      cell.appendChild(dayNumber);

      for (const appointment of appointmentsByDate.get(date) || []) {
        const appointmentButton = document.createElement('button');
        appointmentButton.type = 'button';
        appointmentButton.className = 'appointment-card';
        appointmentButton.textContent = `${appointment.time} · ${appointment.clientName}`;
        appointmentButton.addEventListener('click', () => showAppointmentDetails(appointment));
        cell.appendChild(appointmentButton);
      }

      calendarGrid.appendChild(cell);
    }
    setStatus(calendarStatus, confirmedAppointments.length ? `${confirmedAppointments.length} תורים בחודש זה.` : 'אין תורים בחודש זה.');
  } catch (error) {
    if (requestId === appointmentsRequestId) {
      setStatus(calendarStatus, error.message || 'שגיאה בטעינת התורים.', 'error');
    }
  }
}

settingsForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!selectedBot) return;

  setStatus(settingsStatus, 'שומר הגדרות...');
  const payload = {
    botUrlKey: document.getElementById('botUrlKey').value.trim(),
    dayOff: document.getElementById('dayOff').value,
    openTime: document.getElementById('openTime').value,
    closeTime: document.getElementById('closeTime').value,
    appointmentDurationMinutes: Number(document.getElementById('appointmentDurationMinutes').value),
    breakDurationMinutes: Number(document.getElementById('breakDurationMinutes').value),
    defaultPrice: Number(document.getElementById('defaultPrice').value)
  };

  try {
    const data = await requestJson(`/api/secretary/${encodeURIComponent(selectedBot.botUrlKey)}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    selectedBot = data.bot;
    document.getElementById('selectedBotTitle').textContent = `ניהול הבוט: ${selectedBot.botUrlKey}`;
    document.getElementById('bookingPageLink').href = `client-booking.html?bot=${encodeURIComponent(selectedBot.botUrlKey)}`;
    populateSettings(selectedBot);
    setStatus(settingsStatus, 'ההגדרות נשמרו בהצלחה.', 'success');
    const botsData = await requestJson('/api/secretary/mine');
    renderBotList(botsData.bots || [], botsData.quota);
    await loadAppointments();
  } catch (error) {
    setStatus(settingsStatus, error.message || 'שגיאה בשמירת ההגדרות.', 'error');
  }
});

document.getElementById('closeManagement').addEventListener('click', () => {
  managementPanel.hidden = true;
  selectedBot = null;
});

document.getElementById('toggleVacationForm').addEventListener('click', event => {
  const isExpanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
  event.currentTarget.setAttribute('aria-expanded', String(!isExpanded));
  vacationForm.hidden = isExpanded;
  if (!isExpanded) vacationDateInput.focus();
});

vacationForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!selectedBot) return;

  const vacationDate = vacationDateInput.value;
  const customMessage = vacationMessageInput.value.trim();
  if (!vacationDate || !customMessage) {
    setStatus(vacationStatus, 'נא לבחור תאריך ולכתוב הודעה ללקוחות.', 'error');
    return;
  }

  const confirmed = window.confirm(
    `לאשר חופשה בתאריך ${vacationDate}? כל התורים הפעילים בתאריך זה יבוטלו, והלקוחות יקבלו את ההודעה במייל.`
  );
  if (!confirmed) return;

  confirmVacationButton.disabled = true;
  setStatus(vacationStatus, 'שולח מיילים ומעדכן את התורים...');
  try {
    const data = await requestJson(
      `/api/secretary/${encodeURIComponent(selectedBot.botUrlKey)}/emergency-vacation`,
      {
        method: 'POST',
        body: JSON.stringify({ vacationDate, customMessage })
      }
    );
    vacationMessageInput.value = '';
    setStatus(vacationStatus, data.message, data.emailFailures ? 'error' : 'success');
    await loadAppointments();
  } catch (error) {
    setStatus(vacationStatus, error.message || 'שגיאה בעדכון החופשה ושליחת המיילים.', 'error');
    await loadAppointments();
  } finally {
    confirmVacationButton.disabled = false;
  }
});

document.getElementById('previousMonth').addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  appointmentDetails.hidden = true;
  loadAppointments();
});

document.getElementById('nextMonth').addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  appointmentDetails.hidden = true;
  loadAppointments();
});

loadBots();
