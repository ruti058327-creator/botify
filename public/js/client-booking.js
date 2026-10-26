// ממתינים עד שהדפדפן יסיים לבנות את ה־HTML, כדי שכל האלמנטים שנחפש בהמשך כבר יהיו זמינים.
document.addEventListener('DOMContentLoaded', () => {
  // מפענחים את הפרמטרים שמופיעים אחרי סימן השאלה בכתובת הדף, למשל ?bot=...
  const urlParams = new URLSearchParams(window.location.search);
  // שולפים מהכתובת את מזהה הבוט, שישמש בבקשות לשרת לקבלת לוח השנה ולקביעת תור.
  const botUrlKey = urlParams.get('bot');

  // אובייקט זה ישמור את הפרטים שהלקוח ימלא בטופס, עד לשליחתם יחד עם בקשת קביעת התור.
  let clientData = {};
  // משתנה זה ישמור את תאריך התור שנבחר; null פירושו שעדיין לא נבחר תאריך.
  let selectedDate = null;
  // משתנה זה ישמור את שעת התור שנבחרה; null פירושו שעדיין לא נבחרה שעה.
  let selectedTime = null;
  // התאריך הזה קובע איזה חודש מוצג בלוח השנה, ומתחיל בחודש הנוכחי.
  const currentDisplayDate = new Date();
  // מעבירים את תאריך העוגן ליום הראשון בחודש כדי ששינוי חודשים לא יגלוש בגלל מספרי ימים שונים.
  currentDisplayDate.setDate(1);
  // מזהה עולה לכל בקשת לוח שנה, כדי שניתן יהיה להתעלם מתשובות ישנות שהגיעו באיחור.
  let calendarRequestId = 0;
  // מזהה עולה לכל בקשת שעות, כדי שתשובה של תאריך קודם לא תחליף את השעות לתאריך החדש.
  let slotsRequestId = 0;

  // שומרים הפניות לאזור השלב הראשון בדף, שבו הלקוח מזין את פרטיו.
  const step1 = document.getElementById('step1');
  // שומרים הפניה לאזור השלב השני, שבו הלקוח בוחר תאריך ושעה.
  const step2 = document.getElementById('step2');
  // שומרים הפניה לטופס פרטי הלקוח כדי להאזין לשליחתו.
  const clientDetailsForm = document.getElementById('clientDetailsForm');
  // שומרים הפניה לכפתור שמחזיר מהשלב השני להזנת פרטי הלקוח.
  const backToStep1 = document.getElementById('backToStep1');
  // שומרים הפניה לרשת התאים שבה יוצגו ימי החודש בלוח השנה.
  const calendarGrid = document.getElementById('calendarGrid');
  // שומרים הפניה לכותרת שבה יוצגו שם החודש והשנה הנוכחיים.
  const calendarMonthTitle = document.getElementById('calendarMonthTitle');
  // שומרים הפניה לאזור שבו יוצגו שעות התור הפנויות.
  const slotsContainer = document.getElementById('slotsContainer');
  // שומרים הפניה לכפתור שישלח לשרת את הבקשה הסופית לקביעת התור.
  const confirmBookingBtn = document.getElementById('confirmBookingBtn');
  // שומרים הפניה לאזור שבו יוצג מחיר התור שחזר מהשרת.
  const displayPrice = document.getElementById('displayPrice');
  // שומרים הפניה לאזור ההודעות, להצגת הצלחה או שגיאה לאחר ניסיון קביעת התור.
  const messageDiv = document.getElementById('bookingMessage');

  // מאזינים לשליחת טופס פרטי הלקוח, כלומר לפעולה שבה הלקוח מבקש לעבור לבחירת תור.
  clientDetailsForm.addEventListener('submit', (e) => {
    // מונעים מהדפדפן לשלוח את הטופס בדרך הרגילה ולרענן את הדף.
    e.preventDefault();
    // קוראים את ערכי השדות, מסירים רווחים מיותרים בקצוות ושומרים אותם לשימוש בהזמנה.
    clientData = {
      // מספר הזהות נשמר כמחרוזת, כדי לא לאבד אפסים בתחילת המספר.
      idNumber: document.getElementById('clientIdNumber').value.trim(),
      // שומרים את שם הלקוח לאחר הסרת רווחים מיותרים מתחילתו ומסופו.
      clientName: document.getElementById('clientName').value.trim(),
      // שומרים את מספר הטלפון שהוזן, ללא רווחים מיותרים בקצוות.
      phone: document.getElementById('clientPhone').value.trim(),
      // שומרים את כתובת הדוא"ל שהוזנה, ללא רווחים מיותרים בקצוות.
      email: document.getElementById('clientEmail').value.trim()
    };

    // מסתירים את טופס הפרטים לאחר שהפרטים נשמרו.
    step1.style.display = 'none';
    // מציגים את האזור שבו בוחרים תאריך ושעה.
    step2.style.display = 'block';
    // טוענים ומציגים את הימים הזמינים בחודש שמוצג כעת.
    renderCalendar();
  });

  // מאזינים ללחיצה על כפתור החזרה, כדי לאפשר ללקוח לעדכן את פרטיו.
  backToStep1.addEventListener('click', () => {
    // מסתירים את שלב בחירת התור.
    step2.style.display = 'none';
    // מחזירים לתצוגה את טופס פרטי הלקוח.
    step1.style.display = 'block';
  });

  // פונקציה אסינכרונית שמבקשת מהשרת את הימים בחודש הנוכחי ומציירת אותם בלוח.
  async function renderCalendar() {
    // מאתחלים את תוכן הלוח עם שמות ימי השבוע, בסדר שבו הם מוצגים בממשק.
    calendarGrid.innerHTML = `
      <div class="day-name">א'</div><div class="day-name">ב'</div><div class="day-name">ג'</div>
      <div class="day-name">ד'</div><div class="day-name">ה'</div><div class="day-name">ו'</div><div class="day-name">ש'</div>
    `;

    // קוראים את השנה מתוך תאריך החודש שמוצג כעת.
    const year = currentDisplayDate.getFullYear();
    // getMonth מחזירה מספר מחודש 0 עד 11, ולכן מוסיפים 1 כדי לשלוח לשרת חודש 1 עד 12.
    const month = currentDisplayDate.getMonth() + 1;

    // מגדירים שמות חודשים בעברית; המערך מתחיל בינואר, שמתאים לחודש מספר 1.
    const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
    // מציגים בכותרת את שם החודש ואת השנה שנבחרו.
    calendarMonthTitle.textContent = `${monthNames[month - 1]} ${year}`;
    // נותנים לבקשה מזהה חדש; אם בקשה קודמת תסתיים אחריה, נוכל לזהות שהיא כבר לא עדכנית.
    const requestId = ++calendarRequestId;

    // מתחילים בקשה לשרת ומטפלים גם בשגיאות שעלולות להתרחש בזמן התקשורת או עיבוד התשובה.
    try {
      // מבקשים את זמינות הימים עבור הבוט, השנה והחודש שמוצגים כעת.
      const response = await fetch(`/api/secretary/${botUrlKey}/calendar-month?year=${year}&month=${month}`);
      // ממירים את גוף התשובה בפורמט JSON לאובייקט JavaScript.
      const data = await response.json();

      // אם כבר נשלחה בקשה חדשה יותר, לא מציירים את תוצאת הבקשה הישנה.
      if (requestId !== calendarRequestId) return;
      // מוודאים שהשרת הצליח, שהתשובה מסומנת כהצלחה ושמערך הימים קיים ואינו ריק.
      if (!response.ok || !data.success || !Array.isArray(data.calendarDays) || data.calendarDays.length === 0) {
        // מעלים שגיאה כדי להעביר את הטיפול למקטע catch ולהציג הודעת כשל למשתמש.
        throw new Error(data.message || 'לא ניתן לטעון את לוח השנה');
      }

      // מחשבים את מיקום היום הראשון בחודש לפי getDay, שמחזירה 0 ליום ראשון ועד 6 לשבת.
      const firstDayIndex = new Date(year, month - 1, 1).getDay();

      // יוצרים תאים ריקים לפני היום הראשון, כך שמספרי הימים יתיישרו תחת ימי השבוע הנכונים.
      for (let i = 0; i < firstDayIndex; i++) {
        // יוצרים תא HTML ריק עבור כל יום בשבוע שלפני תחילת החודש.
        const emptyCell = document.createElement('div');
        // מוסיפים לתא מחלקות עיצוב המציינות שהוא יום ריק בלוח.
        emptyCell.className = 'calendar-day empty';
        // מוסיפים את התא הריק לרשת לוח השנה.
        calendarGrid.appendChild(emptyCell);
      }

      // שומרים את התאריך של היום כדי למנוע בחירת ימים שכבר עברו.
      const today = new Date();
      // יוצרים מחרוזת תאריך בפורמט YYYY-MM-DD, כדי לאפשר השוואה אחידה לתאריך שמגיע מהשרת.
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      // עוברים על כל יום שחזר מהשרת ובונים עבורו תא בלוח השנה.
      data.calendarDays.forEach(dayInfo => {
        // יוצרים אלמנט div שישמש כתא עבור היום הנוכחי.
        const dayCell = document.createElement('div');
        // מוסיפים לתא את מחלקת העיצוב הבסיסית של יום בלוח.
        dayCell.className = 'calendar-day';
        // יוצרים אלמנט span להצגת המספר של היום בחודש.
        const dayNumber = document.createElement('span');
        // מציינים שהמספר הוא יום בלוח השנה הגרגוריאני, לצורכי עיצוב.
        dayNumber.className = 'greg-day';
        // מציגים בתוך האלמנט את מספר היום שסיפק השרת.
        dayNumber.textContent = dayInfo.dayNumber;
        // מוסיפים את מספר היום לתא שלו.
        dayCell.appendChild(dayNumber);

        // משביתים יום שעבר או יום שהשרת סימן כחסום, למשל שבת, חג או יום שאינו זמין.
        if (dayInfo.dateString < todayStr || dayInfo.isBlocked) {
          // מוסיפים מחלקת CSS שמציגה את היום כלא זמין ומונעת את בחירתו דרך ממשק המשתמש.
          dayCell.classList.add('disabled');
        } else {
          // ליום זמין מוסיפים מאזין, כך שלחיצה עליו תבחר אותו ותטען את השעות הפנויות.
          dayCell.addEventListener('click', () => {
            // מסירים סימון בחירה מכל ימי הלוח, כדי שרק היום האחרון שנבחר יישאר מסומן.
            document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
            // מסמנים את התא שעליו לחצו כבחירה הפעילה.
            dayCell.classList.add('selected');
            // שומרים את תאריך היום שנבחר בפורמט שסיפק השרת.
            selectedDate = dayInfo.dateString;
            // מבקשים מהשרת את שעות התור הפנויות בתאריך שנבחר.
            fetchSlotsForDate(selectedDate);
          });
        }

        // מוסיפים את תא היום לרשת שמוצגת בדף.
        calendarGrid.appendChild(dayCell);
      });
    } catch (err) {
      // כותבים למסוף המפתחים את פרטי התקלה, כדי לסייע באבחון בעיה בטעינת הלוח.
      console.error('Error rendering calendar:', err);
      // מציגים הודעת שגיאה רק אם מדובר עדיין בבקשה האחרונה ולא בבקשה שהתיישנה.
      if (requestId === calendarRequestId) {
        // יוצרים תא מיוחד להצגת הודעת שגיאה בתוך אזור לוח השנה.
        const errorCell = document.createElement('div');
        // מוסיפים מחלקת CSS שמאפשרת לעצב את הודעת השגיאה.
        errorCell.className = 'calendar-error';
        // מגדירים הודעה ידידותית שמסבירה שהטעינה נכשלה ומציעה לנסות שוב.
        errorCell.textContent = 'לא ניתן לטעון את התאריכים. נא לנסות שוב.';
        // מוסיפים את הודעת השגיאה ללוח במקום להשאיר את המשתמש ללא הסבר.
        calendarGrid.appendChild(errorCell);
      }
    }
  }

  // פונקציה אסינכרונית שמבקשת מהשרת את השעות הפנויות בתאריך שהלקוח בחר.
  async function fetchSlotsForDate(dateStr) {
    // מקצים מזהה חדש לבקשה כדי לזהות ולבטל מבחינת התצוגה תשובות ישנות.
    const requestId = ++slotsRequestId;
    // מציגים חיווי טעינה בזמן שהשרת מחפש שעות פנויות.
    slotsContainer.innerHTML = '<span class="placeholder-text">טוען שעות פנויות...</span>';
    // מאפסים בחירת שעה קודמת, משום שהשעות שייכות לתאריך אחר.
    selectedTime = null;
    // מונעים אישור הזמנה עד לבחירת שעה תקפה.
    confirmBookingBtn.disabled = true;

    // שולחים בקשה לשרת ומטפלים במקרה של כשל תקשורת.
    try {
      // מבקשים את רשימת השעות לתאריך שנבחר עבור הבוט שמזוהה בכתובת.
      const response = await fetch(`/api/secretary/${botUrlKey}/slots?date=${dateStr}`);
      // ממירים את תשובת השרת מאובייקט JSON למבנה נתונים שניתן לבדוק.
      const data = await response.json();
      // מתעלמים מתשובה אם כבר ביקשנו שעות אחרות או אם התאריך שנבחר השתנה בינתיים.
      if (requestId !== slotsRequestId || dateStr !== selectedDate) return;

      // ממשיכים להצגת התוצאות רק כאשר גם בקשת HTTP וגם הנתון success מצביעים על הצלחה.
      if (response.ok && data.success) {
        // מסירים את הודעת הטעינה ואת התוכן הקודם לפני הצגת התוצאות החדשות.
        slotsContainer.innerHTML = '';
        // אם לא חזרו שעות, מסבירים למשתמש שאין תורים פנויים בתאריך הזה.
        if (!data.availableSlots || data.availableSlots.length === 0) {
          slotsContainer.innerHTML = '<span class="placeholder-text">אין תורים פנויים ביום זה (סגור / חג / מלא)</span>';
        } else {
          // יוצרים כפתור נפרד לכל שעת תור זמינה שחזרה מהשרת.
          data.availableSlots.forEach(slot => {
            // יוצרים אלמנט כפתור כדי שהשעה תהיה אפשרית לבחירה בלחיצה.
            const slotBtn = document.createElement('button');
            // מונעים מהכפתור לשלוח בטעות טופס שבו הוא נמצא.
            slotBtn.type = 'button';
            // נותנים לכפתור מחלקת CSS לעיצוב שעת תור.
            slotBtn.className = 'time-slot-btn';
            // מציגים על הכפתור את השעה הזמינה.
            slotBtn.textContent = slot;

            // מגדירים מה יקרה כשהלקוח יבחר את שעת התור הזאת.
            slotBtn.addEventListener('click', () => {
              // מבטלים את הסימון של כל שאר השעות, כך שתישאר רק בחירה אחת.
              document.querySelectorAll('.time-slot-btn').forEach(b => b.classList.remove('active'));
              // מסמנים את כפתור השעה שנלחץ כבחירה הפעילה.
              slotBtn.classList.add('active');
              // שומרים את השעה שנבחרה, כדי לכלול אותה בבקשת קביעת התור.
              selectedTime = slot;
              // מאפשרים את כפתור האישור כעת שיש גם תאריך וגם שעה לבקשה.
              confirmBookingBtn.disabled = false;
            });

            // מוסיפים את כפתור השעה לאזור השעות הפנויות בדף.
            slotsContainer.appendChild(slotBtn);
          });
        }

        // אם השרת החזיר מחיר שאינו ריק, מציגים אותו עם סימון שקל.
        if (data.price) {
          displayPrice.textContent = `${data.price} ₪`;
        }
      } else {
        // במקרה של כשל עסקי או תשובה לא מוצלחת, מציגים את הודעת השרת או הודעה כללית.
        slotsContainer.innerHTML = `<span class="placeholder-text">${data.message || 'העסק סגור בתאריך זה'}</span>`;
      }
    } catch (err) {
      // מציגים שגיאת תקשורת רק אם הבקשה שנכשלה עדיין רלוונטית לבחירה הנוכחית.
      if (requestId === slotsRequestId) {
        slotsContainer.innerHTML = '<span class="placeholder-text">שגיאת תקשורת מול השרת</span>';
      }
    }
  }

  // משנה את החודש המוצג לפי מספר החודשים שנשלח: ‎-1 לחודש הקודם או ‎1 לחודש הבא.
  function changeMonth(offset) {
    // מעדכנים את תאריך העוגן במספר החודשים המבוקש.
    currentDisplayDate.setMonth(currentDisplayDate.getMonth() + offset);
    // מנקים את התאריך שנבחר כי הבחירה הקודמת שייכת לחודש הקודם.
    selectedDate = null;
    // מנקים את השעה שנבחרה כי היא שייכת לתאריך הקודם.
    selectedTime = null;
    // מבטלים מבחינת התצוגה כל בקשת שעות קודמת, כדי שתשובתה לא תשפיע על החודש החדש.
    slotsRequestId++;
    // מציגים הנחיה לבחור תאריך במקום רשימת השעות הקודמת.
    slotsContainer.innerHTML = '<span class="placeholder-text">בחר תאריך מלוח השנה מימין...</span>';
    // משביתים את אישור התור עד שתיבחר שעה חדשה.
    confirmBookingBtn.disabled = true;
    // טוענים מחדש את הימים עבור החודש המעודכן.
    renderCalendar();
  }

  // מאזינים ללחיצה על כפתור החודש הקודם ומעבירים את הפונקציה ערך שלילי.
  document.getElementById('prevMonth').addEventListener('click', () => {
    // מבקשים להציג את החודש שלפני החודש הנוכחי.
    changeMonth(-1);
  });
  // מאזינים ללחיצה על כפתור החודש הבא ומעבירים את הפונקציה ערך חיובי.
  document.getElementById('nextMonth').addEventListener('click', () => {
    // מבקשים להציג את החודש שאחרי החודש הנוכחי.
    changeMonth(1);
  });

  // מאזינים ללחיצה על אישור ומבצעים בקשת POST לקביעת התור בשרת.
  confirmBookingBtn.addEventListener('click', async () => {
    // עוצרים אם חסרים תאריך או שעה, כדי לא לשלוח בקשת הזמנה לא שלמה.
    if (!selectedDate || !selectedTime) return;

    // בונים את גוף הבקשה: פרטי הלקוח יחד עם תאריך ושעת התור שנבחרו.
    const payload = {
      // מעתיקים לתוך הבקשה את שדות פרטי הלקוח שנשמרו מהטופס.
      ...clientData,
      // מוסיפים את התאריך שנבחר בלוח השנה.
      date: selectedDate,
      // מוסיפים את שעת התור שנבחרה מרשימת השעות.
      time: selectedTime
    };

    // שולחים את הבקשה ומציגים הודעה מתאימה אם התקשורת עם השרת נכשלת.
    try {
      // שולחים לשרת בקשת POST לנתיב קביעת התור של הבוט הנוכחי.
      const response = await fetch(`/api/secretary/${botUrlKey}/book`, {
        // מציינים לשרת ששולחים נתונים בגוף הבקשה בשיטת HTTP מסוג POST.
        method: 'POST',
        // מודיעים שהגוף מקודד בפורמט JSON.
        headers: { 'Content-Type': 'application/json' },
        // ממירים את פרטי ההזמנה ממבנה JavaScript למחרוזת JSON להעברה ברשת.
        body: JSON.stringify(payload)
      });

      // קוראים את תשובת השרת וממירים אותה מא JSON לאובייקט JavaScript.
      const data = await response.json();

      // בודקים את שדה ההצלחה שהשרת החזיר כדי להחליט איזו הודעה להציג.
      if (data.success) {
        // מציגים הודעת הצלחה הכוללת את התאריך והשעה שאושרו.
        messageDiv.textContent = `התור נקבע בהצלחה ל-${selectedDate} בשעה ${selectedTime}! `;
        // מחליפים את מחלקת ההודעה למחלקת הצלחה לצורך עיצוב מתאים.
        messageDiv.className = 'success';
        // מסתירים את אזור בחירת התור לאחר שההזמנה נקבעה.
        step2.style.display = 'none';
      } else {
        // במקרה שהשרת דחה את ההזמנה, מציגים את ההודעה שלו או הודעת שגיאה כללית.
        messageDiv.textContent = data.message || 'שגיאה בקביעת התור';
        // מסמנים את ההודעה כשגיאה כדי שתוצג בעיצוב מתאים.
        messageDiv.className = 'error';
      }
    } catch (err) {
      // אם שליחת הבקשה או קריאת התשובה נכשלו, מודיעים למשתמש על בעיית תקשורת.
      messageDiv.textContent = 'שגיאת תקשורת מול השרת';
      // מסמנים גם את הודעת התקשורת כטקסט שגיאה.
      messageDiv.className = 'error';
    }
  });
});