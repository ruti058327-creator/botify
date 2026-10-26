// קוראים את אסימון ההתחברות ואת רכיבי העמוד פעם אחת כדי להשתמש בהם בניהול הבוטים.
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
// תאריך זה קובע את החודש שמוצג בלוח; מציבים אותו ביום הראשון כדי למנוע גלישה בין חודשים.
const currentMonth = new Date();
currentMonth.setDate(1);

// הבוט שנבחר וגרסת בקשת התורים נשמרים כדי לשמור על עקביות בין פעולות אסינכרוניות.
let selectedBot = null;
let appointmentsRequestId = 0;

/**
 * מציג הודעת מצב ברכיב ומחליף את מחלקות העיצוב בהתאם לסוג ההודעה.
 * @param {HTMLElement} element הרכיב שבו תוצג ההודעה.
 * @param {string} message תוכן ההודעה למשתמש.
 * @param {string} [type=''] סוג מצב אופציונלי כגון error או success.
 * @returns {void} מעדכן את הטקסט ואת המחלקות ברכיב.
 */
function setStatus(element, message, type = '') {
  // textContent מציג את ההודעה כטקסט בטוח, והמחלקה מאפשרת לעצב אותה לפי מצבה.
  element.textContent = message;
  element.className = `status-message${type ? ` status-${type}` : ''}`;
}

/**
 * שולח בקשה ומפענח את תשובת השרת כ-JSON, תוך הוספת כותרות אימות ותוכן.
 * @param {string} url נתיב הבקשה לשרת.
 * @param {RequestInit} [options={}] שיטת הבקשה, גוף ופרטי fetch נוספים.
 * @returns {Promise<object>} נתוני התשובה לאחר בדיקת הצלחה.
 * @throws {Error} כאשר השרת מחזיר כשל HTTP או מסמן את הפעולה ככושלת.
 */
async function requestJson(url, options = {}) {
  // מוסיפים ברירות מחדל לכותרות, אך משאירים לכותרות שקיבלנו קדימות בסוף המיזוג.
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  });
  // כל נקודות הקצה של הממשק מחזירות JSON, שאותו מפענחים לפני בדיקת התוצאה.
  const data = await response.json();
  if (!response.ok || !data.success) {
    // סטטוס HTTP או שדה הצלחה שלילי הופכים לדחייה עם ההודעה המתאימה למשתמש.
    throw new Error(data.message || 'הבקשה נכשלה');
  }
  // מחזירים את גוף התשובה למי שקרא לפונקציה כדי להמשיך לעדכן את הממשק.
  return data;
}

/**
 * בונה כרטיסי בוטים ומעדכן את קישור היצירה בהתאם למכסת החשבון.
 * @param {Array<object>} bots רשימת בוטי המזכירה של המשתמש.
 * @param {object} [quota] מספר הבוטים, המכסה והמסלול הפעיל.
 * @returns {void} מחליף את הרשימה ומציג את מצב המכסה.
 */
function renderBotList(bots, quota = { canCreate: false, botCount: 0, botLimit: 1 }) {
  // מוחקים כרטיסים ישנים כדי שרענון הרשימה לא ייצור כפילויות.
  botsList.replaceChildren();
  // מפנים ליצירה אם המכסה מאפשרת זאת, ואחרת לעמוד שדרוג המסלול.
  addSecretaryBotLink.href = quota.canCreate
    ? 'secretary-dashboard.html'
    : 'pricing.html?required=secretary-bot';
  addSecretaryBotLink.textContent = quota.canCreate
    ? 'הוספת בוט מזכירה'
    : 'שדרוג מסלול להוספת בוט';
  // כשאין בוטים מציגים את המכסה הנוכחית ומסיימים ללא יצירת כרטיסים.
  if (!bots.length) {
    setStatus(botsStatus, `עדיין לא יצרת בוט מזכירה פעיל. המכסה הנוכחית: ${quota.botCount}/${quota.botLimit}.`);
    return;
  }

  // מציגים מכסה מספרית או ניסוח מפורש אם החשבון אינו מוגבל במספר הבוטים.
  const limitText = Number.isFinite(quota.botLimit) ? quota.botLimit : 'ללא הגבלה';
  setStatus(botsStatus, `בוטי מזכירה: ${quota.botCount} מתוך ${limitText} במסלול ${quota.planId}.`);
  // בונים כרטיס עצמאי לכל בוט עם פרטי הפעילות וכפתורי העריכה והמחיקה שלו.
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
    selectButton.textContent = 'עריכה';
    // בחירה בכפתור העריכה פותחת את ההגדרות ואת לוח התורים של הבוט הזה.
    selectButton.addEventListener('click', () => selectBot(bot));
    const deleteButton = document.createElement('button');
    deleteButton.className = 'secondary-button bot-delete-button';
    deleteButton.type = 'button';
    deleteButton.textContent = 'מחיקה';
    // מחיקה דורשת אישור משתמש, ובמהלכה הכפתור מושבת כדי למנוע בקשות כפולות.
    deleteButton.addEventListener('click', async () => {
      if (!window.confirm(`למחוק את בוט המזכירה "${bot.botUrlKey}" ואת יומן התורים שלו?`)) return;
      deleteButton.disabled = true;
      try {
        // מקודדים את מזהה הבוט כחלק מהנתיב ושולחים לשרת בקשת DELETE.
        await requestJson(`/api/secretary/${encodeURIComponent(bot.botUrlKey)}`, { method: 'DELETE' });
        // אם הבוט שנמחק נבחר כרגע, מאפסים את בחירתו ומסתירים את אזור הניהול.
        if (selectedBot?.botUrlKey === bot.botUrlKey) {
          selectedBot = null;
          managementPanel.hidden = true;
        }
        // מרעננים את הרשימה כדי להסיר את הכרטיס ולעדכן את נתוני המכסה.
        await loadBots();
      } catch (error) {
        // מציגים את הודעת הכשל ומחזירים את הכפתור לפעולה כדי לאפשר ניסיון חוזר.
        setStatus(botsStatus, error.message || 'שגיאה במחיקת הבוט.', 'error');
        deleteButton.disabled = false;
      }
    });
    // מרכיבים את הכרטיס ומצרפים אותו לרשימה לאחר שכל רכיביו הוכנו.
    description.append(title, hours);
    card.append(description, selectButton, deleteButton);
    botsList.appendChild(card);
  }
}

/**
 * טוען את הבוטים והמכסה של המשתמש, ומציג בוט שנבחר בפרמטר של כתובת הדף.
 * @returns {Promise<void>} מעדכן את הרשימה ואת אזור הניהול לפי התשובה.
 */
async function loadBots() {
  // ללא אסימון התחברות אין הרשאה לטעון או לנהל את רשימת הבוטים.
  if (!token) {
    setStatus(botsStatus, 'יש להתחבר כדי לנהל את הבוטים.', 'error');
    return;
  }

  try {
    // מבקשים מהשרת את הבוטים והמכסה שמשויכים לחשבון הנוכחי.
    const data = await requestJson('/api/secretary/mine');
    renderBotList(data.bots || [], data.quota);
    // קישור המכיל פרמטר bot יכול לפתוח ישירות בוט מסוים לעריכה.
    const requestedBotUrlKey = new URLSearchParams(window.location.search).get('bot');
    const requestedBot = data.bots?.find(bot => bot.botUrlKey === requestedBotUrlKey);
    // בוחרים בבוט רק אם המפתח שבכתובת נמצא ברשימה שהשרת החזיר.
    if (requestedBot) await selectBot(requestedBot);
  } catch (error) {
    // כשל טעינה מוצג ליד הרשימה כדי שהמשתמש יקבל הסבר במקום תוכן ריק.
    setStatus(botsStatus, error.message || 'שגיאה בטעינת הבוטים.', 'error');
  }
}

/**
 * ממלא את שדות ההגדרות בפרטי הבוט, עם ברירות מחדל לשדות חסרים.
 * @param {object} bot בוט המזכירה שנבחר לעריכה.
 * @returns {void} מעדכן את הערכים בטופס ההגדרות.
 */
function populateSettings(bot) {
  // מציבים פרטי זיהוי, יום ושעות פעילות; ערכי ברירת מחדל מסייעים לבוטים ישנים.
  document.getElementById('botUrlKey').value = bot.botUrlKey || '';
  document.getElementById('dayOff').value = bot.dayOff || 'שישי';
  document.getElementById('openTime').value = bot.openTime || '09:00';
  document.getElementById('closeTime').value = bot.closeTime || '18:00';
  // משך והפסקה מקבלים ערכי גיבוי רק כאשר הערכים חסרים או אינם מוגדרים.
  document.getElementById('appointmentDurationMinutes').value = bot.appointmentDurationMinutes || 30;
  document.getElementById('breakDurationMinutes').value = bot.breakDurationMinutes ?? 10;
  document.getElementById('defaultPrice').value = bot.defaultPrice ?? 150;
}

/**
 * בוחר בוט ומציג את ההגדרות, היומן ואזור הניהול שלו.
 * @param {object} bot הבוט שבו המשתמש בחר.
 * @returns {Promise<void>} טוען את התורים ומגלגל את אזור הניהול לתצוגה.
 */
async function selectBot(bot) {
  // שומרים את הבחירה כדי שבקשות עריכה וטעינת תורים יתייחסו לאותו בוט.
  selectedBot = bot;
  managementPanel.hidden = false;
  document.getElementById('selectedBotTitle').textContent = `ניהול הבוט: ${bot.botUrlKey}`;
  populateSettings(bot);
  // מסתירים פרטי תור קודם עד לבחירת תור מתוך היומן של הבוט החדש.
  appointmentDetails.hidden = true;
  await loadAppointments();
  managementPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * מעצב חודש ושנה בעברית לפי הלוח הגרגוריאני, שבו נשמרים תאריכי המערכת.
 * @param {Date} date תאריך בחודש שאותו יש להציג.
 * @returns {string} שם החודש והשנה בפורמט מקומי.
 */
function formatGregorianMonth(date) {
  // מגדירים לוח גרגוריאני וספרות לטיניות כדי להתאים לפורמט תאריכי השרת.
  return new Intl.DateTimeFormat('he-IL', {
    month: 'long',
    year: 'numeric',
    calendar: 'gregory',
    numberingSystem: 'latn'
  }).format(date);
}

/**
 * מציג את פרטי התור שנבחר כרשימת תוויות וערכים.
 * @param {object} appointment תור שאושר עבור לקוח.
 * @returns {void} ממלא ומציג את אזור פרטי התור.
 */
function showAppointmentDetails(appointment) {
  // מרכזים את פרטי התור להצגה ומוסיפים נוסח חלופי אם לא נמסרה תעודת זהות.
  const fields = [
    ['שם מלא', appointment.clientName],
    ['תעודת זהות', appointment.idNumber || 'לא נמסרה'],
    ['טלפון', appointment.phone],
    ['דוא״ל', appointment.email],
    ['תאריך', appointment.date],
    ['שעה', appointment.time]
  ];

  // מסירים פרטים קודמים ובונים לכל שדה תווית וערך נפרדים.
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

/**
 * מבקש תורים לחודש הנבחר ומצייר את לוח השנה ואת התורים שאושרו בו.
 * @returns {Promise<void>} מעדכן את הכותרת, היומן והודעות הטעינה.
 */
async function loadAppointments() {
  // בלי בוט נבחר אין מזהה שאפשר לבקש עבורו את התורים.
  if (!selectedBot) return;

  // מזהה עולה מונע מתשובת בקשה קודמת לדרוס יומן של חודש או בוט שנבחרו לאחר מכן.
  const requestId = ++appointmentsRequestId;
  // מרכיבים את פרמטרי החודש לפי לוח השנה המקומי, תוך התאמת חודש למניין 1–12.
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1;
  calendarMonthTitle.textContent = formatGregorianMonth(currentMonth);
  // מנקים את היומן הישן ומודיעים למשתמש שהנתונים נטענים.
  calendarGrid.replaceChildren();
  setStatus(calendarStatus, 'טוען תורים...');

  try {
    // מבקשים תורים לפי מפתח הבוט והשנה והחודש שמוצגים כרגע בלוח.
    const data = await requestJson(
      `/api/secretary/${encodeURIComponent(selectedBot.botUrlKey)}/appointments?year=${year}&month=${month}`
    );
    // מתעלמים מתשובה מאוחרת אם בינתיים נשלחה בקשה עדכנית יותר.
    if (requestId !== appointmentsRequestId) return;

    // מציגים כותרות של שבעת ימי השבוע בסדר התואם ללוח.
    const weekdays = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
    for (const weekday of weekdays) {
      const heading = document.createElement('div');
      heading.className = 'calendar-weekday';
      heading.textContent = weekday;
      calendarGrid.appendChild(heading);
    }

    // מחשבים את היום בשבוע שבו מתחיל החודש ואת מספר הימים שיש בו.
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    // מציגים רק תורים שאושרו ומקבצים אותם לפי מחרוזת התאריך של כל תור.
    const confirmedAppointments = (data.appointments || []).filter(appointment => appointment.status === 'confirmed');
    const appointmentsByDate = new Map();
    for (const appointment of confirmedAppointments) {
      const dayAppointments = appointmentsByDate.get(appointment.date) || [];
      dayAppointments.push(appointment);
      appointmentsByDate.set(appointment.date, dayAppointments);
    }

    // מוסיפים תאים ריקים לפני היום הראשון כדי ליישר אותו תחת יום השבוע הנכון.
    for (let emptyDay = 0; emptyDay < firstDay; emptyDay++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'calendar-day-empty';
      calendarGrid.appendChild(emptyCell);
    }

    // יוצרים תא לכל יום בחודש ומשתמשים בתאריך אחיד כמפתח לאיתור תורים.
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const cell = document.createElement('div');
      cell.className = 'calendar-day-cell';
      const dayNumber = document.createElement('span');
      dayNumber.className = 'calendar-day-number';
      dayNumber.textContent = day;
      cell.appendChild(dayNumber);

      // מוסיפים לתא של אותו יום כפתור לכל תור מאושר, לפתיחת פרטי הלקוח.
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
    // מסכמים את מספר התורים בלוח או מודיעים שלא נמצאו תורים בחודש המבוקש.
    setStatus(calendarStatus, confirmedAppointments.length ? `${confirmedAppointments.length} תורים בחודש זה.` : 'אין תורים בחודש זה.');
  } catch (error) {
    // מציגים שגיאה רק עבור הבקשה העדכנית, כדי לא להחליף הודעה חדשה בכשל ישן.
    if (requestId === appointmentsRequestId) {
      setStatus(calendarStatus, error.message || 'שגיאה בטעינת התורים.', 'error');
    }
  }
}

// מאזינים לשמירת הגדרות כדי לעדכן את הבוט הקיים בלי לרענן את הדף.
settingsForm.addEventListener('submit', async event => {
  // מונעים שליחת טופס רגילה ומוודאים שיש בוט נבחר שאליו ניתן לשייך את השינויים.
  event.preventDefault();
  if (!selectedBot) return;

  // מציגים מצב טעינה ואוספים את ערכי הטופס לגוף JSON עבור בקשת העדכון.
  setStatus(settingsStatus, 'שומר הגדרות...');
  const payload = {
    // מפתח הבוט נחתך מרווחים, שדות שעות ויום נשמרים כמחרוזות, ומידות ומחיר כמספרים.
    botUrlKey: document.getElementById('botUrlKey').value.trim(),
    dayOff: document.getElementById('dayOff').value,
    openTime: document.getElementById('openTime').value,
    closeTime: document.getElementById('closeTime').value,
    appointmentDurationMinutes: Number(document.getElementById('appointmentDurationMinutes').value),
    breakDurationMinutes: Number(document.getElementById('breakDurationMinutes').value),
    defaultPrice: Number(document.getElementById('defaultPrice').value)
  };

  try {
    // מעדכנים רק את הגדרות הבוט שנבחר באמצעות בקשת PATCH.
    const data = await requestJson(`/api/secretary/${encodeURIComponent(selectedBot.botUrlKey)}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    // מחליפים את פרטי הבוט המקומיים בגרסה המעודכנת שהשרת החזיר.
    selectedBot = data.bot;
    document.getElementById('selectedBotTitle').textContent = `ניהול הבוט: ${selectedBot.botUrlKey}`;
    populateSettings(selectedBot);
    setStatus(settingsStatus, 'ההגדרות נשמרו בהצלחה.', 'success');
    // מרעננים גם את פרטי הרשימה והמכסה כדי לשקף שינוי אפשרי במפתח הבוט.
    const botsData = await requestJson('/api/secretary/mine');
    renderBotList(botsData.bots || [], botsData.quota);
    await loadAppointments();
  } catch (error) {
    // שגיאת שמירה נשארת באזור הסטטוס של טופס ההגדרות.
    setStatus(settingsStatus, error.message || 'שגיאה בשמירת ההגדרות.', 'error');
  }
});

// כפתור הסגירה מסתיר את חלונית הניהול ומבטל את הבוט שנבחר.
document.getElementById('closeManagement').addEventListener('click', () => {
  managementPanel.hidden = true;
  selectedBot = null;
});

// כפתור החופשה פותח או סוגר את הטופס, מעדכן נגישות וממקם בו את הסמן.
document.getElementById('toggleVacationForm').addEventListener('click', event => {
  // קוראים את מצב ההרחבה הנוכחי כדי להפוך אותו ולקבוע את תצוגת הטופס.
  const isExpanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
  event.currentTarget.setAttribute('aria-expanded', String(!isExpanded));
  vacationForm.hidden = isExpanded;
  if (!isExpanded) vacationDateInput.focus();
});

// שולחים בקשת חופשה חריגה לאחר אימות שדות ואישור מפורש של ביטול תורים.
vacationForm.addEventListener('submit', async event => {
  // מונעים רענון דף ומוודאים שיש בוט נבחר שהחופשה תוגדר עבורו.
  event.preventDefault();
  if (!selectedBot) return;

  // קוראים את התאריך ואת הודעת הלקוחות ומסירים רווחים מיותרים מההודעה.
  const vacationDate = vacationDateInput.value;
  const customMessage = vacationMessageInput.value.trim();
  // לא שולחים חופשה ללא תאריך או הודעה ברורה שתועבר ללקוחות.
  if (!vacationDate || !customMessage) {
    setStatus(vacationStatus, 'נא לבחור תאריך ולכתוב הודעה ללקוחות.', 'error');
    return;
  }

  // מפרטים שהאישור יבטל תורים פעילים וישלח הודעה, ומכבדים ביטול של המשתמש.
  const confirmed = window.confirm(
    `לאשר חופשה בתאריך ${vacationDate}? כל התורים הפעילים בתאריך זה יבוטלו, והלקוחות יקבלו את ההודעה במייל.`
  );
  if (!confirmed) return;

  // משביתים אישור נוסף בזמן שליחת הבקשה ומציגים את הפעולה שמתבצעת כעת.
  confirmVacationButton.disabled = true;
  setStatus(vacationStatus, 'שולח מיילים ומעדכן את התורים...');
  try {
    // שולחים לשרת את התאריך והנוסח, כדי שיבטל תורים וישלח הודעות ללקוחות.
    const data = await requestJson(
      `/api/secretary/${encodeURIComponent(selectedBot.botUrlKey)}/emergency-vacation`,
      {
        method: 'POST',
        body: JSON.stringify({ vacationDate, customMessage })
      }
    );
    // לאחר הצלחה מנקים את ההודעה ומציגים תוצאה; כשלי דוא"ל מסומנים כשגיאה.
    vacationMessageInput.value = '';
    setStatus(vacationStatus, data.message, data.emailFailures ? 'error' : 'success');
    await loadAppointments();
  } catch (error) {
    // מציגים כשל בשליחת החופשה ומרעננים את היומן לקבלת המצב העדכני מהשרת.
    setStatus(vacationStatus, error.message || 'שגיאה בעדכון החופשה ושליחת המיילים.', 'error');
    await loadAppointments();
  } finally {
    // בכל תוצאה מפעילים מחדש את כפתור האישור לפעולה הבאה.
    confirmVacationButton.disabled = false;
  }
});

// כפתור החודש הקודם משנה את תאריך התצוגה, מסתיר פרטי תור ומבקש יומן חדש.
document.getElementById('previousMonth').addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  appointmentDetails.hidden = true;
  loadAppointments();
});

// כפתור החודש הבא מבצע את אותו רענון בכיוון קדימה בלוח השנה.
document.getElementById('nextMonth').addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  appointmentDetails.hidden = true;
  loadAppointments();
});

// טוענים את רשימת הבוטים מיד עם הרצת הסקריפט כדי לאתחל את מסך הניהול.
loadBots();
