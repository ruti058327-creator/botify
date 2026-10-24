document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const botUrlKey = urlParams.get('bot');

  // State לשמירת נתוני הלקוח והבחירה
  let clientData = {};
  let selectedDate = null;
  let selectedTime = null;
  const currentDisplayDate = new Date();
  currentDisplayDate.setDate(1);
  let calendarRequestId = 0;
  let slotsRequestId = 0;

  // האלמנטים בדף
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const clientDetailsForm = document.getElementById('clientDetailsForm');
  const backToStep1 = document.getElementById('backToStep1');
  const calendarGrid = document.getElementById('calendarGrid');
  const calendarMonthTitle = document.getElementById('calendarMonthTitle');
  const slotsContainer = document.getElementById('slotsContainer');
  const confirmBookingBtn = document.getElementById('confirmBookingBtn');
  const displayPrice = document.getElementById('displayPrice');
  const messageDiv = document.getElementById('bookingMessage');

  // מעבר משלב 1 לשלב 2
  clientDetailsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    clientData = {
      idNumber: document.getElementById('clientIdNumber').value.trim(),
      clientName: document.getElementById('clientName').value.trim(),
      phone: document.getElementById('clientPhone').value.trim(),
      email: document.getElementById('clientEmail').value.trim()
    };

    step1.style.display = 'none';
    step2.style.display = 'block';
    renderCalendar();
  });

  // חזרה לשלב 1
  backToStep1.addEventListener('click', () => {
    step2.style.display = 'none';
    step1.style.display = 'block';
  });

  // בניית לוח השנה החודשי ויזואלית
  async function renderCalendar() {
    calendarGrid.innerHTML = `
      <div class="day-name">א'</div><div class="day-name">ב'</div><div class="day-name">ג'</div>
      <div class="day-name">ד'</div><div class="day-name">ה'</div><div class="day-name">ו'</div><div class="day-name">ש'</div>
    `;

    const year = currentDisplayDate.getFullYear();
    const month = currentDisplayDate.getMonth() + 1;

    const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
    calendarMonthTitle.textContent = `${monthNames[month - 1]} ${year}`;
    const requestId = ++calendarRequestId;

    try {
      const response = await fetch(`/api/secretary/${botUrlKey}/calendar-month?year=${year}&month=${month}`);
      const data = await response.json();

      if (requestId !== calendarRequestId) return;
      if (!response.ok || !data.success || !Array.isArray(data.calendarDays) || data.calendarDays.length === 0) {
        throw new Error(data.message || 'לא ניתן לטעון את לוח השנה');
      }

      const firstDayIndex = new Date(year, month - 1, 1).getDay();

      // רווחים לימים שקודמים ל-1 בחודש
      for (let i = 0; i < firstDayIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        calendarGrid.appendChild(emptyCell);
      }

      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      data.calendarDays.forEach(dayInfo => {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        const dayNumber = document.createElement('span');
        dayNumber.className = 'greg-day';
        dayNumber.textContent = dayInfo.dayNumber;
        dayCell.appendChild(dayNumber);

        // אם עבר, שבת או חג -> חסימה באפור
        if (dayInfo.dateString < todayStr || dayInfo.isBlocked) {
          dayCell.classList.add('disabled');
        } else {
          dayCell.addEventListener('click', () => {
            document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
            dayCell.classList.add('selected');
            selectedDate = dayInfo.dateString;
            fetchSlotsForDate(selectedDate);
          });
        }

        calendarGrid.appendChild(dayCell);
      });
    } catch (err) {
      console.error('Error rendering calendar:', err);
      if (requestId === calendarRequestId) {
        const errorCell = document.createElement('div');
        errorCell.className = 'calendar-error';
        errorCell.textContent = 'לא ניתן לטעון את התאריכים. נא לנסות שוב.';
        calendarGrid.appendChild(errorCell);
      }
    }
  }

  // שליפת שעות פנויות מהשרת עבור התאריך שנבחר
  async function fetchSlotsForDate(dateStr) {
    const requestId = ++slotsRequestId;
    slotsContainer.innerHTML = '<span class="placeholder-text">טוען שעות פנויות...</span>';
    selectedTime = null;
    confirmBookingBtn.disabled = true;

    try {
      const response = await fetch(`/api/secretary/${botUrlKey}/slots?date=${dateStr}`);
      const data = await response.json();
      if (requestId !== slotsRequestId || dateStr !== selectedDate) return;

      if (response.ok && data.success) {
        slotsContainer.innerHTML = '';
        if (!data.availableSlots || data.availableSlots.length === 0) {
          slotsContainer.innerHTML = '<span class="placeholder-text">אין תורים פנויים ביום זה (סגור / חג / מלא)</span>';
        } else {
          data.availableSlots.forEach(slot => {
            const slotBtn = document.createElement('button');
            slotBtn.type = 'button';
            slotBtn.className = 'time-slot-btn';
            slotBtn.textContent = slot;

            slotBtn.addEventListener('click', () => {
              document.querySelectorAll('.time-slot-btn').forEach(b => b.classList.remove('active'));
              slotBtn.classList.add('active');
              selectedTime = slot;
              confirmBookingBtn.disabled = false;
            });

            slotsContainer.appendChild(slotBtn);
          });
        }

        if (data.price) {
          displayPrice.textContent = `${data.price} ₪`;
        }
      } else {
        slotsContainer.innerHTML = `<span class="placeholder-text">${data.message || 'העסק סגור בתאריך זה'}</span>`;
      }
    } catch (err) {
      if (requestId === slotsRequestId) {
        slotsContainer.innerHTML = '<span class="placeholder-text">שגיאת תקשורת מול השרת</span>';
      }
    }
  }

  function changeMonth(offset) {
    currentDisplayDate.setMonth(currentDisplayDate.getMonth() + offset);
    selectedDate = null;
    selectedTime = null;
    slotsRequestId++;
    slotsContainer.innerHTML = '<span class="placeholder-text">בחר תאריך מלוח השנה מימין...</span>';
    confirmBookingBtn.disabled = true;
    renderCalendar();
  }

  // כפתורי מעבר חודשים בלוח השנה
  document.getElementById('prevMonth').addEventListener('click', () => {
    changeMonth(-1);
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    changeMonth(1);
  });

  // אישור סופי וקביעת התור
  confirmBookingBtn.addEventListener('click', async () => {
    if (!selectedDate || !selectedTime) return;

    const payload = {
      ...clientData,
      date: selectedDate,
      time: selectedTime
    };

    try {
      const response = await fetch(`/api/secretary/${botUrlKey}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        messageDiv.textContent = `התור נקבע בהצלחה ל-${selectedDate} בשעה ${selectedTime}! אישור נשלח למייל.`;
        messageDiv.className = 'success';
        step2.style.display = 'none';
      } else {
        messageDiv.textContent = data.message || 'שגיאה בקביעת התור';
        messageDiv.className = 'error';
      }
    } catch (err) {
      messageDiv.textContent = 'שגיאת תקשורת מול השרת';
      messageDiv.className = 'error';
    }
  });
});