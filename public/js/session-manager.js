/**
 * מפעיל ניטור חוסר פעילות למשתמש מחובר ומציג אזהרת התנתקות.
 * @returns {void} מתקין מאזינים, טיימר ואפשרויות להישאר מחובר או להתנתק.
 */
// מתחילים ניטור רק לאחר שרכיבי הדף נטענו.
document.addEventListener('DOMContentLoaded', () => {
    // בודקים אם נשמרו אסימון או פרטי משתמש, כסימן לכך שהמשתמש מחובר.
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    // אם אין התחברות כלל, לא מפעילים את הטיימר
    // משתמש לא מחובר אינו צריך טיימר אזהרה או חלון התנתקות.
    if (!token && !user) {
        return;
    }

    // מונה הזמן מתעדכן כל שנייה; משך האזהרה מוגדר לשתי דקות.
    let idleTime = 0;
    const WARNING_TIME_MS = 2 * 60 * 1000; // התראה אחרי 2 דקות

    // שומרים הפניות לחלון ולספירה כדי שניתן יהיה להסירם בעת איפוס.
    let warningModal = null;
    let countdownInterval = null;

    /**
     * מאפס את משך חוסר הפעילות וסוגר אזהרה קיימת.
     * @returns {void} מאפס מונה ומסיר את חלון האזהרה, אם קיים.
     */
    const resetTimer = () => {
        // כל פעילות מתחילה מחדש את תקופת חוסר הפעילות.
        idleTime = 0;
        if (warningModal) {
            // אם אזהרה פתוחה, מסירים אותה וגם עוצרים את ספירת ההתנתקות.
            warningModal.remove();
            warningModal = null;
            clearInterval(countdownInterval);
        }
    };

    // תנועות ועזרים נפוצים של משתמש נחשבים לפעילות ומאפסים את המונה.
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keypress', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);

    /**
     * בודק מדי שנייה את משך חוסר הפעילות ומציג אזהרה במידת הצורך.
     * @returns {void} מעדכן את מונה חוסר הפעילות.
     */
    setInterval(() => {
        // מפסיקים לספור אם המשתמש התנתק מאז טעינת הדף.
        if (!localStorage.getItem('user') && !localStorage.getItem('token')) return;

        // מוסיפים שנייה אחת לזמן חוסר הפעילות שנצבר.
        idleTime += 1000;

        // מציגים אזהרה פעם אחת כשהסף נחצה, כל עוד אין אזהרה פתוחה.
        if (idleTime >= WARNING_TIME_MS && !warningModal) {
            showBankStyleWarning();
        }
    }, 1000);

    /**
     * יוצר חלון אזהרה עם ספירה לאחור עד להתנתקות אוטומטית.
     * @returns {void} מציג למשתמש אפשרות להישאר מחובר או להתנתק.
     */
    function showBankStyleWarning() {
        // קובעים דקה למשתמש להגיב לפני ביצוע התנתקות אוטומטית.
        let secondsLeft = 60;

        // יוצרים שכבת מסך מלאה ומעצבים אותה כדי שתופיע מעל תוכן האתר.
        warningModal = document.createElement('div');
        warningModal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.6); display: flex; justify-content: center;
            align-items: center; z-index: 9999; font-family: 'Segoe UI', Tahoma, sans-serif; direction: rtl;
        `;

        // בונים את תוכן האזהרה ואת שני הכפתורים בתוך השכבה החדשה.
        warningModal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 12px; width: 400px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
                <h2 style="color: #d9534f; margin-top: 0; font-size: 22px;">הודעת אבטחה</h2>
                <p style="color: #555; font-size: 15px; line-height: 1.5;">
                    עקב חוסר פעילות, המערכת תתנתק בעוד <span id="countdown-timer" style="font-weight: bold; color: #d9534f; font-size: 18px;">60</span> שניות.
                </p>
                <div style="display: flex; gap: 15px; margin-top: 25px;">
                    <button id="stay-connected-btn" style="flex: 1; background: #2e7d32; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 15px;">השאר מחובר</button>
                    <button id="force-logout-btn" style="flex: 1; background: #d9534f; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 15px;">התנתק</button>
                </div>
            </div>
        `;

        // מצרפים את חלון האזהרה לגוף הדף כדי שיוצג למשתמש.
        document.body.appendChild(warningModal);

        /**
         * מבטל את אזהרת ההתנתקות ומאפס את מונה חוסר הפעילות.
         * @returns {void} סוגר את האזהרה ומחדש את זמן הפעילות.
         */
        document.getElementById('stay-connected-btn').addEventListener('click', () => {
            // לחיצה על הישאר מחובר מסירה את האזהרה ומאפסת את זמן חוסר הפעילות.
            resetTimer();
        });

        /**
         * מנתק את המשתמש מיד בעקבות בחירתו.
         * @returns {void} מפעיל את פעולת ההתנתקות.
         */
        document.getElementById('force-logout-btn').addEventListener('click', () => {
            // בחירת התנתקות מפעילה מיד את ניקוי פרטי המשתמש והניווט.
            performLogout();
        });

        /**
         * מעדכן את הספירה לאחור ומנתק כשהיא מגיעה לאפס.
         * @returns {void} מרענן את התצוגה או מבצע התנתקות.
         */
        countdownInterval = setInterval(() => {
            // מעדכנים את הזמן המוצג ומבצעים התנתקות כשהספירה מסתיימת.
            secondsLeft--;
            const timerEl = document.getElementById('countdown-timer');
            if (timerEl) timerEl.textContent = secondsLeft;

            if (secondsLeft <= 0) {
                clearInterval(countdownInterval);
                performLogout();
            }
        }, 1000);
    }

    /**
     * מסיר את נתוני המשתמש והאסימון ומעביר למסך ההתחברות.
     * @returns {void} מנקה אחסון מקומי ומנווט לעמוד ההתחברות.
     */
    function performLogout() {
        // מסירים את פרטי ההזדהות המאוחסנים לפני המעבר לעמוד הכניסה.
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // מעבירים למסך ההתחברות לאחר ניקוי מצב המשתמש המקומי.
        window.location.href = 'login.html';
    }
});