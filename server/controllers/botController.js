// טוען את הגדרות הסביבה לפני קריאת מפתח Gemini ומודולי השירות.
import '../config/env.js';
// המודלים משמשים לשמירת בוטים, בדיקת משתמשים ורכישות פעילות.
import Bot from '../models/Bot.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
// Axios שולח את בקשת יצירת התשובה לשירות Gemini.
import axios from 'axios';
// Agent HTTPS מוגדר לבקשות החיצוניות של Gemini.
import https from 'node:https';
// Playwright מפעיל דפדפן ללא ממשק לצורך סריקת אתרים.
import __cjsImport0 from 'playwright';
// Fuse משווה מילות שאלה למשפטים באתר גם כשאין התאמה מדויקת.
import Fuse from 'fuse.js';
import __cjsImport1 from '../utils/plans.js';
import httpError from '../utils/httpError.js';

// מוציאים את מנוע Chromium ואת הגדרות המסלולים מתוך המודולים שיובאו.
const { chromium } = __cjsImport0;
const { PLANS, getBotLimit } = __cjsImport1;


// משתמשים ב-Agent לבקשות Gemini דרך סביבת רשת עם תעודת TLS מותאמת.
const geminiHttpsAgent = new https.Agent({ rejectUnauthorized: false });
// הודעת ברירת מחדל למקרה שהסריקה קיימת אך לא נמצאה התאמה לשאלה.
const LOCAL_FALLBACK_REPLY = 'מצאתי תוכן באתר, אבל אין כרגע מספיק מידע מסודר כדי לענות על השאלה.';

/**
 * מחלץ מהכתובת מזהה מוצר ורמזי מחיר המוטמעים בפרמטרים שלה.
 * @param {string} websiteUrl כתובת האתר של הבוט.
 * @returns {string} רמזי מוצר מופרדים בשורות, או מחרוזת ריקה.
 */
function extractProductSignals(websiteUrl) {
  try {
    // מפרקים את הכתובת כדי לקרוא מזהה מוצר ונתונים שהוטמעו בפרמטרים.
    const url = new URL(websiteUrl);
    const signals = [];
    // חלק מאתרי המסחר מקודדים את מזהה הפריט בתוך נתיב item.
    const productId = url.pathname.match(/\/item\/(\d+)/i)?.[1];
    if (productId) signals.push(`מזהה מוצר: ${productId}`);

    // קוראים פרמטר מסחר נפוץ שעשוי להכיל מטבע ומספרי מחיר.
    const encodedPriceData = url.searchParams.get('pdp_npi');
    if (encodedPriceData) {
      // מפענחים את הערך ומנרמלים סימני קריאה כדי להקל על חילוץ השדות.
      const priceData = decodeURIComponent(encodedPriceData).replace(/%21/gi, '!');
      const currency = priceData.match(/!([A-Z]{3})!/i)?.[1];
      // מסננים ערכים מספריים שאינם סבירים ושומרים לכל היותר ארבעה מחירים.
      const values = priceData.split('!').map(value => value.trim()).filter(Boolean)
        .map(value => Number(value)).filter(value => value > 0 && value < 10000)
        .filter(Number.isFinite).slice(0, 4);
      if (currency && values.length) {
        // מוסיפים רמז רק כשנמצאו גם קוד מטבע וגם ערך מחיר אפשרי.
        signals.push(`נתוני מחיר שהגיעו בתוך הקישור: ${currency} ${values.join(', ')}. ייתכן שמדובר במחיר מבצע, מחיר קודם, מחיר לפי וריאציה או מחיר משלוח.`);
      }
    }
    // מחזירים רמזים כשורות כדי לשלבם בהמשך בהנחיות למודל.
    return signals.join('\n');
  } catch {
    // כתובת לא תקינה או פרמטר לא ניתן לפענוח אינם עוצרים את יצירת הצ'אט.
    return '';
  }
}

/**
 * מאתר ומנרמל מחירים גלויים בשקלים או ב-ILS מתוך טקסט.
 * @param {string} text טקסט האתר לסריקה.
 * @returns {number[]} מחירים חיוביים ייחודיים שנמצאו.
 */
function extractVisiblePrices(text) {
  // מזהה סכומים המסומנים בשקל או ב-ILS וממיר פסיק עשרוני לנקודה.
  const matches = [...String(text).matchAll(/(?:₪|ILS\s*)(\d+(?:[.,]\d{1,2})?)/gi)]
    .map(match => Number(match[1].replace(',', '.')))
    .filter(value => Number.isFinite(value) && value > 0 && value < 100000);
  // מסיר מחירים כפולים תוך שמירה על סדר הופעתם בטקסט.
  return [...new Set(matches)];
}

/**
 * מנתח מחירים, משלוח והנחות מתוך תוכן מסחרי.
 * @param {string} text טקסט האתר לסריקה.
 * @returns {{currentPrice: number|null, originalPrice: number|null, shipping: number|null, discountPercent: number|null, beforeTaxes: boolean, prices: number[]}} נתוני התמחור שחולצו.
 */
function extractCommercePricing(text) {
  // שומר עותק טקסט אחיד ומחלץ את כל המחירים הגלויים פעם אחת.
  const normalizedText = String(text);
  const prices = extractVisiblePrices(normalizedText);
  const priceSection = normalizedText.match(/([^.!?]{0,240}המחיר מוצג לפני מסים)/i)?.[1] || normalizedText.slice(0, 500);
  const sectionPrices = extractVisiblePrices(priceSection);
  // מעדיף מחיר מהקטע המסומן, ובהיעדרו משתמש במחיר הראשון בעמוד.
  const currentPrice = sectionPrices[0] || prices[0] || null;
  const originalPrice = sectionPrices[2] || sectionPrices[1] || null;
  const shippingMatch = normalizedText.match(/(?:אספקה(?:\s+מהירה)?|משלוח|shipping|delivery)[^₪]{0,100}₪\s*(\d+(?:[.,]\d{1,2})?)/i);
  // אם לא נמצא מחיר משלוח מפורש, בודק אם העמוד מציין משלוח חינם.
  const shipping = shippingMatch
    ? Number(shippingMatch[1].replace(',', '.'))
    : (/משלוח\s+חינם|free\s+shipping/i.test(normalizedText) ? 0 : null);
  // מחלץ אחוז הנחה אם צוין במפורש בטקסט.
  const discountMatch = normalizedText.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:הנחה|discount)/i);
  const discountPercent = discountMatch ? Number(discountMatch[1].replace(',', '.')) : null;

  // מחזיר מבנה מסודר עם null עבור נתון שלא ניתן היה לזהות בביטחון.
  return {
    currentPrice,
    originalPrice,
    shipping: Number.isFinite(shipping) ? shipping : null,
    discountPercent: Number.isFinite(discountPercent) ? discountPercent : null,
    beforeTaxes: /מחיר מוצג לפני מסים|before taxes|taxes not included/i.test(normalizedText),
    prices
  };
}

/**
 * מזהה שמות של תחומי לימוד מוכרים בתוך תוכן האתר.
 * @param {string} siteContent הטקסט שנסרק מהאתר.
 * @returns {string[]} שמות התחומים שזוהו בעברית.
 */
function extractCourseNames(siteContent) {
  // כל זוג כולל ביטוי חיפוש באתר ותווית קריאה שנחזיר למשתמש בעברית.
  const coursePatterns = [
    [/Full Stack courses?/i, 'קורסי Full Stack'],
    [/Chip\s*&\s*Embedded courses?/i, 'קורסי Chip & Embedded'],
    [/AI\s*&\s*Data courses?/i, 'קורסי AI & Data'],
    [/Bootcamps\s*&\s*Practicum/i, 'Bootcamps והתנסות מעשית'],
    [/Preparation for Job interviews/i, 'הכנה לראיונות עבודה']
  ];
  // בוחרים רק תחומים שהביטוי שלהם הופיע בתוכן שנסרק.
  return coursePatterns.filter(([pattern]) => pattern.test(String(siteContent))).map(([, label]) => label);
}

/**
 * מאתר עד שני משפטים באתר הרלוונטיים למונחי השאלה באמצעות Fuse.
 * @param {string} siteContent תוכן האתר שנסרק.
 * @param {string} question שאלת המשתמש.
 * @returns {string} המשפטים המתאימים או מחרוזת ריקה.
 */
function findRelevantSiteText(siteContent, question) {
  // מנקים רווחים ומפצלים את הטקסט למשפטים או למקטעים קצרים לחיפוש.
  const sentences = String(siteContent)
    .replace(/\s+/g, ' ')
    .split(/[.!?…]+|\s+[|•]\s+/u)
    .flatMap(
      /**
       * מחלק משפטים ארוכים למקטעים קצרים המתאימים לחיפוש.
       * @param {string} sentence משפט מתוך תוכן האתר.
       * @returns {string[]} מקטעים שאינם חורגים מאורך היעד.
       */
      sentence => {
      const parts = [];
      // חותכים משפטים ארוכים סביב רווח כדי לא לפצל מילה באמצע.
      let remaining = sentence.trim();
      while (remaining.length > 360) {
        let splitAt = remaining.lastIndexOf(' ', 360);
        if (splitAt < 180) splitAt = 360;
        parts.push(remaining.slice(0, splitAt).trim());
        remaining = remaining.slice(splitAt).trim();
      }
      if (remaining) parts.push(remaining);
      return parts;
      }
    )
    .filter(sentence => sentence.length >= 20);
  // אין טעם להפעיל חיפוש אם חסרים משפטים או שהשאלה ריקה.
  if (!sentences.length || !String(question).trim()) return '';

  // מחלקים את השאלה למונחים ייחודיים ומשאירים מילים בעלות תוכן.
  const queryTerms = [...new Set(String(question).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [])]
    .filter(term => term.length >= 3);
  if (!queryTerms.length) return '';

  // Fuse מאפשר חיפוש מקורב כדי להתמודד עם ניסוחים לא זהים לגמרי.
  const fuse = new Fuse(sentences, {
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 3,
    threshold: 0.38
  });
  // צוברים לכל משפט את מספר ההתאמות ואת ציון הדמיון של המונחים.
  const scoredSentences = new Map();
  for (const term of queryTerms) {
    for (const result of fuse.search(term)) {
      // מתעלמים מתוצאות חלשות או מתוצאה שאין לה ציון להשוואה.
      if (result.score === undefined || result.score > 0.38) continue;
      const current = scoredSentences.get(result.item) || { matchCount: 0, totalScore: 0 };
      current.matchCount += 1;
      current.totalScore += result.score;
      scoredSentences.set(result.item, current);
    }
  }

  // דורשים התאמה לשני מונחים כשאפשר, או לכל המונחים אם יש פחות משניים.
  const minimumMatches = Math.min(2, queryTerms.length);
  // מדרגים לפי מספר התאמות ואז לפי ציון, ומחזירים לכל היותר שני משפטים.
  return [...scoredSentences.entries()]
    .filter(([, result]) => result.matchCount >= minimumMatches)
    .sort((first, second) => second[1].matchCount - first[1].matchCount || first[1].totalScore - second[1].totalScore)
    .slice(0, 2)
    .map(([sentence]) => sentence)
    .join(' ');
}

/**
 * בונה תשובה מקומית על בסיס תוכן האתר וכללי זיהוי מובנים.
 * @param {string} siteContent תוכן האתר שנסרק.
 * @param {string} question שאלת המשתמש.
 * @param {string} websiteUrl כתובת האתר המשמשת לבניית קישור רלוונטי.
 * @returns {string} תשובה המבוססת על האתר או הודעת ברירת המחדל.
 */
function buildLocalSiteReply(siteContent, question, websiteUrl) {
  // ממירים את הקלט למחרוזת ומזהים תחומי לימוד כדי לבנות תשובה בלי שירות חיצוני.
  const questionText = String(question);
  const courseNames = extractCourseNames(siteContent);
  // שאלות התחברות מקבלות קישור ישיר לעמוד הכניסה של האתר.
  if (/אזור ה?אישי|התחבר|כניסה|חשבון|login|personal area/i.test(questionText)) {
    return `כדי להיכנס לאזור האישי, פתחי את עמוד ההתחברות של האתר: ${new URL('/login/index.php', websiteUrl).href}`;
  }
  // התאמות נושאיות מוכרות נענות ישירות על סמך ביטויים שנמצאו בסריקה.
  if (/ראיון|ראיונות|הכנה.*עבודה/i.test(questionText) && /Preparation for Job interviews/i.test(String(siteContent))) {
    return 'לפי האתר, יש בו מסלול הכנה לראיונות עבודה.';
  }
  if (/(full|דאש|סטאק)/i.test(questionText) && /Full Stack courses?/i.test(String(siteContent))) {
    return 'לפי האתר, יש בו קורס Full Stack.';
  }
  if (/מקצוע|קורס|תחום|חדש|courses?|profession/i.test(questionText) && courseNames.length) {
    return `לפי האתר, הקורסים והתחומים המופיעים בו הם: ${courseNames.join(', ')}.`;
  }
  if (courseNames.length) return `לפי התוכן שנסרק, האתר מציע: ${courseNames.join(', ')}.`;
  // בשאר המקרים מחפשים משפטים תומכים, ואם אין התאמה משתמשים בהודעת הגיבוי.
  const relevantText = findRelevantSiteText(siteContent, questionText);
  return relevantText ? `לפי התוכן שנסרק באתר: ${relevantText}` : LOCAL_FALLBACK_REPLY;
}

/**
 * בוחר תשובת גיבוי מקומית או הודעה מתאימה כאשר שירות Gemini אינו זמין.
 * @param {string} siteContent תוכן האתר שנסרק.
 * @param {string} question שאלת המשתמש.
 * @param {string} websiteUrl כתובת האתר של הבוט.
 * @param {string} reason סיבת הכשל, למשל {@code quota}.
 * @returns {string} תשובת הגיבוי שתוצג למשתמש.
 */
function buildChatFallbackReply(siteContent, question, websiteUrl, reason) {
  // מנסים קודם לענות מהמידע המקומי, ללא תלות בזמינות Gemini.
  const localReply = buildLocalSiteReply(siteContent, question, websiteUrl);
  if (localReply !== LOCAL_FALLBACK_REPLY) return localReply;

  // נוסח ההודעה משתנה לפי השאלה אם המכסה מוצתה או שהשירות אינו זמין.
  if (reason === 'quota') {
    return 'מכסת השימוש ב-Gemini נוצלה כרגע, וגם החיפוש המקומי בתוכן האתר לא מצא תשובה מתאימה לשאלה. אפשר לנסות שוב לאחר איפוס המכסה או לוודא שמוגדרת לשרת מכסת API זמינה.';
  }
  return 'Gemini אינו זמין כרגע, והחיפוש המקומי בתוכן האתר לא מצא תשובה מתאימה. אפשר לנסות שוב בעוד כמה דקות.';
}

/**
 * סורק את כתובת האתר ועד שמונה קישורים פנימיים ומחזיר את הטקסט הקריא.
 * @param {string} websiteUrl כתובת HTTP(S) של האתר.
 * @returns {Promise<string>} טקסט העמודים שנאסף ונורמל.
 * @throws {Error} כאשר פתיחת הדפדפן או טעינת העמוד הראשי נכשלת.
 */
async function scrapeWebsite(websiteUrl) {
  // המשתנה נשמר מחוץ ל-try כדי שנוכל לסגור את הדפדפן גם במקרה של שגיאה.
  let browser;
  try {
    // מפעיל Chromium ללא חלון גרפי לצורך גישה לעמודים וקריאת תוכנם.
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    // ממיר שגיאת התקנה נפוצה להנחיה ברורה, ומשאיר כשלים אחרים ללא שינוי.
    const message = error?.message || 'Playwright failed to launch';
    if (/Executable doesn't exist|Please run the following command to download new browsers|browserType\.launch/i.test(message)) {
      throw new Error('דפדפן הסריקה לא מותקן על השרת. הפעל: node node_modules/playwright/cli.js install chromium');
    }
    throw error;
  }
  try {
    // פותח הקשר דפדפן עם User-Agent נפוץ, כדי לקבל גרסת עמוד רגילה.
    const page = await browser.newPage({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    // מונע סריקה חוזרת של אותו קישור ואוסף את הטקסט מכל עמוד.
    const visitedUrls = new Set();
    const pageTexts = [];
    /**
     * מחלץ מהעמוד הפעיל טקסט גלוי ומטא-נתונים.
     * @returns {Promise<string>} הטקסט המשולב של העמוד.
     */
    /**
     * שולף מהעמוד הפעיל את הטקסט הגלוי ואת המטא-נתונים.
     * @returns {Promise<string>} הטקסט המשולב שנשלף מהעמוד.
     */
    // מריץ בתוך הדפדפן קריאה של הטקסט הגלוי ואלמנטים טקסטואליים מרכזיים.
    const extractPageText = async () => page.evaluate(
      /**
       * קורא מתוך הדפדפן את הטקסט הגלוי ואת מטא-הנתונים של העמוד.
       * @returns {string} תוכן העמוד המשולב.
       */
      () => {
      // לוקח טקסט גלוי וכן כותרות, תיאורים, פסקאות וקישורים.
      const visibleText = document.body?.innerText || '';
      const metadata = [...document.querySelectorAll('title, meta[name="description"], h1, h2, h3, p, a')]
        .map(element => element.getAttribute('content') || element.textContent || '').join(' ');
      return `${visibleText} ${metadata}`;
      }
    );

    // מפרש את כתובת האתר, טוען את העמוד הראשי וממתין לתוכן ראשוני.
    const firstUrl = new URL(websiteUrl);
    await page.goto(firstUrl.href, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    await page.waitForFunction(
      /**
       * בודק אם העמוד מכיל די טקסט קריא להמשך הסריקה.
       * @returns {boolean} האם תוכן הגוף מכיל יותר מחמישים תווים.
       */
      () => document.body && document.body.innerText.trim().length > 50,
      null,
      { timeout: 10000 }
    ).catch(() => {});
    // מסמן את העמוד הראשי כנסרק ושומר את הטקסט שאספנו ממנו.
    visitedUrls.add(page.url());
    pageTexts.push(await extractPageText());

    // אוסף עד שמונה קישורים מאותו מקור, תוך סינון דפים שאינם רלוונטיים.
    const internalUrls = await page.locator('a[href]').evaluateAll(
      /**
       * מסננת קישורים פנימיים שניתן לסרוק ומסירה כפילויות.
       * @param {HTMLAnchorElement[]} links קישורי העמוד.
       * @param {string} origin מקור האתר שממנו נסרקים קישורים.
       * @returns {string[]} עד שמונה כתובות פנימיות ייחודיות.
       */
      (links, origin) => links
      .map(link => {
        // פותר כתובות יחסיות; קישור שאינו ניתן לפענוח יסונן בהמשך.
        try { return new URL(link.href, origin); } catch { return null; }
      })
      .filter(url => url && url.origin === origin)
      .filter(url => !/login|admin|privacy|\.js(?:$|\?)/i.test(url.pathname))
      .map(url => url.href)
      .filter((url, index, urls) => urls.indexOf(url) === index)
      .slice(0, 8),
      firstUrl.origin
    );

    // עובר על הקישורים שנבחרו; תקלה בעמוד פנימי אינה מבטלת סריקה של אחרים.
    for (const internalUrl of internalUrls) {
      if (visitedUrls.has(internalUrl)) continue;
      try {
        // טוען כל עמוד וממתין מעט לתוכן שנוסף מיד לאחר טעינת ה-DOM.
        await page.goto(internalUrl, { timeout: 20000, waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        visitedUrls.add(internalUrl);
        pageTexts.push(await extractPageText());
      } catch (error) {
        console.warn(`Skipping internal page ${internalUrl}: ${error.message}`);
      }
    }
    // מאחד את תוכן הדפים ומנקה רווחים כדי לצמצם טקסט מיותר.
    return pageTexts.join(' ').replace(/\s+/g, ' ').trim();
  } finally {
    // סוגר את Chromium גם כאשר טעינת עמוד או חילוץ התוכן נכשלים.
    await browser.close();
  }
}

/**
 * בודק אם המשתמש הוא מנהל או הבעלים של הבוט.
 * @param {import('mongoose').HydratedDocument<object>} bot מסמך הבוט.
 * @param {{id: string, role: string}} user פרטי המשתמש המאומת.
 * @returns {boolean} האם מותר למשתמש לנהל את הבוט.
 */
function canManageBot(bot, user) {
  // מנהל רשאי לטפל בכל בוט; משתמש רגיל רק בבוט שמזהה בעליו תואם לשלו.
  return user.role === 'admin' || String(bot.userId) === user.id;
}

/**
 * ממיר מסמך בוט לאובייקט המצומצם שנחשף ללקוח.
 * @param {import('mongoose').HydratedDocument<object>} bot מסמך הבוט.
 * @returns {{id: unknown, websiteUrl: string, instructions: string, createdAt: Date}} פרטי הבוט הציבוריים.
 */
function serializeBot(bot) {
  // חושף רק שדות שנדרשים לממשק, ולא את התוכן המלא שנסרק מהאתר.
  return {
    id: bot._id,
    websiteUrl: bot.websiteUrl,
    instructions: bot.instructions,
    createdAt: bot.createdAt
  };
}

/**
 * מחזיר למשתמש את הבוטים שבבעלותו, או את כל הבוטים למנהל.
 * @param {import('express').Request} req בקשה עם משתמש מאומת.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} רשימת בוטים או תשובת שגיאה.
 */
async function list(req, res) {
  // מנהל מקבל מסנן ריק; משתמש רגיל מקבל רק מסמכים ששייכים למזהה שלו.
  const filter = req.user.role === 'admin' ? {} : { userId: req.user.id };
  // ממיין את תוצאות מסד הנתונים מהחדשה לישנה וממיר אותן לתצוגה בטוחה.
  const bots = await Bot.find(filter).sort({ createdAt: -1 });
  return res.json({ success: true, bots: bots.map(serializeBot) });
}

/**
 * מחזיר בוט יחיד לאחר בדיקת הרשאת הבעלות.
 * @param {import('express').Request} req בקשה הכוללת מזהה בוט ומשתמש מאומת.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} פרטי הבוט או תשובת שגיאה.
 */
async function getById(req, res) {
  // מאתר בוט לפי הפרמטר שאומת בנתיב.
  const bot = await Bot.findById(req.params.botId);
  // מסתיר הן בוט חסר והן בוט שאין למשתמש הרשאה לנהל.
  if (!bot || !canManageBot(bot, req.user)) throw httpError(404, 'הבוט לא נמצא');
  return res.json({ success: true, bot: serializeBot(bot) });
}

/**
 * מעדכן את הנחיות הבוט לאחר בדיקת קלט והרשאת בעלות.
 * @param {import('express').Request} req בקשה עם מזהה בוט והנחיות חדשות.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} הבוט המעודכן או תשובת שגיאה.
 */
async function update(req, res) {
  // טוען את הבוט ומוודא הרשאה לפני שינוי נתונים.
  const bot = await Bot.findById(req.params.botId);
  if (!bot || !canManageBot(bot, req.user)) throw httpError(404, 'הבוט לא נמצא');
  // מחליף את הנחיות הבוט בערך שעבר אימות ושומר את המסמך.
  bot.instructions = req.body.instructions;
  await bot.save();
  return res.json({ success: true, bot: serializeBot(bot) });
}

/**
 * מוחק בוט לאחר בדיקת הרשאת בעלות.
 * @param {import('express').Request} req בקשה עם מזהה בוט ומשתמש מאומת.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} תשובת הצלחה או שגיאה.
 */
async function remove(req, res) {
  // נדרשים גם מסמך קיים וגם הרשאת בעלים או מנהל כדי למחוק.
  const bot = await Bot.findById(req.params.botId);
  if (!bot || !canManageBot(bot, req.user)) throw httpError(404, 'הבוט לא נמצא');
  // מוחק את מסמך הבוט ומחזיר אישור לאחר השלמת המחיקה.
  await bot.deleteOne();
  return res.json({ success: true, message: 'הבוט נמחק בהצלחה' });
}

/**
 * מחשב את מכסת הבוטים של משתמש לפי התשלום האחרון שהושלם.
 * @param {string} userId מזהה המשתמש.
 * @returns {Promise<{botCount: number, botLimit: number, planId: string, canCreate: boolean}|null>} נתוני המכסה, או {@code null} אם המשתמש לא נמצא.
 */
async function getBotQuota(userId) {
  // מביא במקביל משתמש, מספר בוטים ותשלום אחרון כדי לצמצם זמן המתנה.
  const [user, botCount, completedPayment] = await Promise.all([
    User.findById(userId).select('_id'),
    Bot.countDocuments({ userId }),
    Payment.findOne({ userId, status: 'completed' }).sort({ createdAt: -1 }).select('planId')
  ]);
  // null מאפשר לנתיב להבחין בין חשבון חסר לבין חשבון עם מכסה אפס.
  if (!user) return null;

  // אם אין תשלום, חלה מכסת הבסיס; אחרת המכסה נגזרת מהמסלול האחרון.
  const botLimit = completedPayment ? getBotLimit(completedPayment.planId) : 1;
  // מחזירים פרטי מכסה שימושיים ל-UI ולא רק את המספר המרבי.
  return {
    botCount,
    botLimit,
    planId: completedPayment?.planId || 'בסיסי',
    canCreate: botCount < botLimit
  };
}

/**
 * מחזיר את מכסת הבוטים הנוכחית ואת המכסה של מסלול מבוקש, אם צוין.
 * @param {import('express').Request} req בקשה מאומתת עם מזהה משתמש ואפשרות {@code planId}.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} נתוני מכסה או תשובת שגיאה.
 */
async function quota(req, res) {
  // מנהל אינו מוגבל לפי מסלול אישי ולכן מקבל אישור מיידי.
  if (req.user.role === 'admin') {
    return res.json({ success: true, canCreate: true, requiresPayment: false });
  }

  // קוראים מסלול מבוקש רק מה-query שעבר אימות בסכמה.
  const requestedPlanId = req.validatedQuery?.planId;
  const userQuota = await getBotQuota(req.user.id);
  if (!userQuota) throw httpError(401, 'יש להתחבר מחדש כדי ליצור בוט');
  // מחשבים את המכסה הנוכחית או את זו של המסלול שהמשתמש בודק.
  const targetBotLimit = requestedPlanId ? getBotLimit(requestedPlanId) : userQuota.botLimit;
  return res.json({
    success: true,
    ...userQuota,
    targetBotLimit,
    botsToDelete: Math.max(0, userQuota.botCount - targetBotLimit),
    requiresPayment: !userQuota.canCreate,
    pricingUrl: '/pages/pricing.html?required=bot'
  });
}

/**
 * סורק אתר ושומר בוט חדש, בכפוף למכסת המשתמש.
 * @param {import('express').Request} req בקשה עם {@code websiteUrl}, הנחיות ומשתמש מאומת.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} מזהה וקישור לבוט שנוצר או תשובת שגיאה.
 */
async function createFromWebsite(req, res) {
  try {
    // משתמש רגיל חייב להישאר מתחת למכסת המסלול שלו לפני יצירת בוט חדש.
    if (req.user.role !== 'admin') {
      const userQuota = await getBotQuota(req.user.id);
      if (!userQuota) throw httpError(401, 'יש להתחבר מחדש כדי ליצור בוט');
      if (!userQuota.canCreate) {
        throw httpError(
          403,
          'הגעת למכסת הבוטים במסלול שלך. יש לבחור מסלול בתשלום כדי ליצור בוטים נוספים.',
          { code: 'BOT_LIMIT_REACHED', pricingUrl: '/pages/pricing.html?required=bot' }
        );
      }
    }

    // שולפים את פרטי יצירת הבוט, ומוסיפים HTTPS אם לא צוין פרוטוקול.
    let { websiteUrl, instructions } = req.body;
    if (!/^[a-z][a-z\d+.-]*:\/\//i.test(websiteUrl)) websiteUrl = `https://${websiteUrl}`;

    // מפרשים את הכתובת ומונעים ניסיון סריקה של יעד שנחסם בסביבת הרשת.
    const requestedUrl = new URL(websiteUrl);
    if (/safepage\.etrog\.net\.il/i.test(requestedUrl.hostname)) {
      throw httpError(403, 'הרשת חסמה את האתר, ולכן לא ניתן לסרוק את תוכנו. יש לבחור אתר שנגיש מהרשת הנוכחית.');
    }

    // סורקים את האתר ואת הקישורים הפנימיים שנבחרו כדי לקבל בסיס ידע לבוט.
    const scrapedText = await scrapeWebsite(websiteUrl);
    if (!scrapedText || scrapedText.length < 20) {
      throw httpError(422, 'לא נמצא באתר מספיק תוכן קריא לסריקה. ייתכן שהאתר נטען באופן דינמי או חסם את הסריקה.');
    }

    // בונים מסמך חדש: תוכן ארוך נחתך, והנחיות ריקות נשמרות כמחרוזת ריקה.
    const newBot = new Bot({
      userId: req.user.role === 'admin' ? null : req.user.id,
      websiteUrl,
      scrapedContent: scrapedText.substring(0, 15000),
      instructions: instructions || ''
    });
    // שומרים את הבוט ורק לאחר הצלחה מחזירים קישור לעמוד הצ'אט.
    await newBot.save();
    return res.status(201).json({
      success: true,
      message: 'הבוט נוצר ונסרק בהצלחה באמצעות Playwright!',
      botId: newBot._id,
      botUrl: `/pages/chat.html?botId=${newBot._id}`
    });
  } catch (error) {
    // מעבירים הלאה שגיאות עסקיות שכבר קיבלו קוד ותגובה מתאימים.
    if (error.statusCode) throw error;
    // מזהים כשלים שנגרמו מכך שדפדפן Chromium חסר בשרת.
    const isBrowserMissing = /דפדפן הסריקה לא מותקן|Executable doesn't exist|download new browsers|browserType\.launch/i.test(error.message || '');
    const message = isBrowserMissing
      ? 'הסקריפט סריקה לא יכול להתחיל בגלל דפדפן חסר. יש להתקין את Chromium של Playwright: node node_modules/playwright/cli.js install chromium'
      : 'שגיאה בסריקת האתר או ביצירת הבוט. ודאי שהכתובת תקינה.';
    throw httpError(isBrowserMissing ? 503 : 500, message);
  }
}

/**
 * משיב לשאלת המשתמש על סמך תוכן האתר, תמחור מקומי ושירות Gemini.
 * @param {import('express').Request} req בקשה עם מזהה בוט והודעת משתמש.
 * @param {import('express').Response} res תגובת השרת.
 * @returns {Promise<import('express').Response>} תשובת הבוט או הודעת שגיאה/גיבוי.
 */
async function chat(req, res) {
  // משתנים מחוץ ל-try נחוצים לטיפול גיבוי שמתרחש ב-catch.
  let bot;
  let userQuestion = '';
  try {
    // מזהה הבוט והשאלה מגיעים מהנתיב ומהגוף שעברו אימות.
    const { botId } = req.params;
    const { message } = req.body;
    userQuestion = String(message || '');
    // טוען את הבוט לפני גישה לתוכן האתר או להנחיות שלו.
    bot = await Bot.findById(botId);
    if (!bot) throw httpError(404, 'הבוט לא נמצא');
    if (!bot.scrapedContent || !bot.scrapedContent.trim()) {
      return res.json({ success: true, reply: 'לא נשמר תוכן מהאתר. נסי ליצור את הבוט מחדש עם קישור ישיר לעמוד ציבורי ונגיש.' });
    }

    // מכינים נתוני קישור ומזהים ברכות ושאלות מחיר שניתן לענות עליהן מקומית.
    const productSignals = extractProductSignals(bot.websiteUrl);
    const questionText = String(message);
    if (/^(הי|היי|שלום|הלו|hello|hi|hey|vh)[!?.\s]*$/i.test(questionText.trim())) {
      return res.json({ success: true, reply: 'היי! אני כאן כדי לענות על שאלות מתוך תוכן האתר. מה תרצי לדעת?' });
    }
    // סיווג השאלה מאפשר להשיב למחירים, משלוח, קופונים ומכסה ללא קריאת AI.
    const isPriceQuestion = /מחיר|עולה|עלות|price|cost|כמה\s+(?:זה|הוא)\s*(?:עולה)?|כמה.*(?:עולה|עלות|מחיר)/i.test(questionText);
    const asksOriginalPrice = /מחיר\s*מקור|מחיר\s*רגיל|מחיר\s*לפני|original|regular/i.test(questionText);
    const asksAllPrices = /כל\s*(ה)?מחירים|מחירים\s*של|all\s*prices/i.test(questionText);
    // מפיקים נתוני מסחר פעם אחת ומשתמשים בהם בכמה מסלולי תשובה.
    const visiblePrices = extractVisiblePrices(bot.scrapedContent);
    const pricing = extractCommercePricing(bot.scrapedContent);
    const asksShipping = /כולל\s*משלוח|משלוח|shipping|delivery|סה["״׳']?כ|סך\s*הכל|total/i.test(questionText);
    const asksCoupon = /קופון|קוד|הנחה|לאחר\s*הנחה|after\s*(a\s*)?coupon|discount/i.test(questionText);
    const asksQuota = /כמה\s+(?:בקשות|שאלות)|מכסה|הגבלה|quota|limit/i.test(questionText);

    // שאלות על מכסת שאלות מקבלות הסבר שאינו תלוי בספק הבינה.
    if (asksQuota) {
      return res.json({ success: true, reply: 'מספר השאלות תלוי במכסת ה־API של הבינה שמוגדרת בשרת, ולא במגבלה של הבוט עצמו. שאלות מחיר, משלוח והנחה שנמצאות בעמוד נענות מקומית ואינן צורכות מכסת AI.' });
    }
    // מונע מתשובת מסחר להינתן כאשר תוכן האתר אינו נראה מסחרי.
    const hasCommerceContext = pricing.currentPrice !== null || /מחיר|price|₪|ILS|shipping|משלוח/i.test(bot.scrapedContent);
    // מחשבים הנחה רק כשיש מחיר בסיס והקשר מסחרי; אחרת מציינים מה חסר.
    if (asksCoupon && pricing.currentPrice !== null && hasCommerceContext) {
      if (pricing.discountPercent === null) {
        return res.json({ success: true, reply: `מחיר המוצר הוא ₪${pricing.currentPrice.toFixed(2)}, אבל העמוד לא מציג סכום או אחוז קופון שאפשר לחשב. צריך להזין את ערך הקופון כדי לחשב מחיר סופי.` });
      }
      const discountedPrice = pricing.currentPrice * (1 - pricing.discountPercent / 100);
      return res.json({ success: true, reply: `מחיר אחרי הנחת ${pricing.discountPercent}%: ₪${discountedPrice.toFixed(2)}. המחיר לפני ההנחה היה ₪${pricing.currentPrice.toFixed(2)}; קופון נוסף, משלוח ומסים עשויים לשנות את הסכום הסופי.` });
    }
    // מוסיפים עלות משלוח למחיר רק אם השאלה עוסקת במשלוח והוא זוהה.
    if (asksShipping && pricing.currentPrice !== null && hasCommerceContext) {
      if (pricing.shipping === null) {
        return res.json({ success: true, reply: `מחיר המוצר הוא ₪${pricing.currentPrice.toFixed(2)}, אבל העמוד לא מציג עלות משלוח קבועה. עלות המשלוח תלויה בכתובת ובאפשרות המשלוח שנבחרה.` });
      }
      const total = pricing.currentPrice + pricing.shipping;
      return res.json({ success: true, reply: `מחיר המוצר: ₪${pricing.currentPrice.toFixed(2)}. משלוח: ${pricing.shipping === 0 ? 'חינם' : `₪${pricing.shipping.toFixed(2)}`}. סך הכל לפני מסים: ₪${total.toFixed(2)}.${pricing.beforeTaxes ? ' העמוד מציין שהמחיר לפני מסים.' : ''}` });
    }
    // מחזירים מחיר עדכני, מקור או את כל המחירים בהתאם לניסוח השאלה.
    if (isPriceQuestion && visiblePrices.length && hasCommerceContext) {
      const selectedPrices = asksOriginalPrice ? visiblePrices.slice(1, 2) : asksAllPrices ? visiblePrices : visiblePrices.slice(0, 1);
      const label = asksOriginalPrice ? 'מחיר המקור' : asksAllPrices ? 'המחירים שמצאתי' : 'המחיר הנוכחי';
      return res.json({ success: true, reply: `${label}: ${selectedPrices.length ? selectedPrices.map(price => `₪${price.toFixed(2)}`).join(', ') : 'לא נמצא במחיר שנשמר בעמוד'}. המחיר עשוי להשתנות לפי וריאציה, משלוח, קופון או מבצע.` });
    }

    // כשאין תשובה מקומית, בונים הנחיות עם תוכן האתר וגבולות למניעת המצאת מידע.
    const prompt = `
    אתה נציג שירות חכם של החברה, ועונה על שאלות לפי תוכן האתר שנסרק בלבד.
    כתובת האתר: ${bot.websiteUrl}
    נתוני מוצר שניתן לחלץ מהקישור עצמו:
    ${productSignals || 'אין נתוני מוצר או מחיר זמינים בכתובת.'}
    תוכן האתר:
    ---
    ${bot.scrapedContent}
    ---
    הנחיות לבוט:
    ${bot.instructions || 'ענה בצורה ברורה, מועילה וקצרה לפי תוכן האתר.'}
    כללי מענה חשובים:
    1. חפש את המשמעות של השאלה, לא התאמה מדויקת של המילים. התייחס למילים נרדפות, ניסוחים חלופיים, שגיאות כתיב, סלנג ושאלות עקיפות.
    2. חבר מידע רלוונטי מכמה מקומות בתוכן האתר כאשר צריך, והסק מסקנות פשוטות וברורות שנובעות ישירות מהמידע.
    3. אם יש מידע חלקי, תן את מה שאפשר לענות עליו וציין בקצרה איזה פרט חסר. אל תסרב רק משום שהשאלה לא מנוסחת בדיוק כמו באתר.
    4. אם השאלה כללית מדי, בקש את שם המוצר, הדגם או קישור ישיר למוצר כדי לתת תשובה מדויקת.
    5. אסור להמציא פרטים, מחירים, מדיניות או עובדות שלא מופיעים בתוכן האתר.
    6. אם המשתמשת מבקשת מחיר עדכני שאין בתוכן שנסרק, בקשי קישור למוצר או לקטגוריה.
    7. רק אם השאלה אינה קשורה לתחום האתר, כתוב: "מצטערת, אני יכולה לענות רק על שאלות הקשורות לתכני האתר."
    8. ענה בשפה שבה נשאלה השאלה, ובשפה טבעית ונעימה.
    שאלת המשתמשת:
    ---
    ${message}
    ---`;
    // מפתח Gemini נדרש רק כאשר צריך לשלוח בקשה לשירות החיצוני.
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw httpError(503, 'מפתח API של גוגל לא הוגדר בקובץ הסביבה');

    // שולחים את השאלה וההקשר ל-Gemini עם timeout כדי למנוע המתנה בלתי מוגבלת.
    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      { contents: [{ parts: [{ text: prompt }] }] },
      { httpsAgent: geminiHttpsAgent, headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    // שולפים את הטקסט הראשון שהמודל החזיר ומשתמשים בהודעה אם המבנה חסר.
    const replyText = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'לא התקבלה תשובה תקינה מהמודל.';
    return res.json({ success: true, reply: replyText });
  } catch (error) {
    // שגיאות HTTP שכבר הוגדרו במערכת אינן מומרות לשגיאות ספק כלליות.
    if (error.statusCode) throw error;
    // מחלצים פרטי ספק כדי לזהות מכסה, זמינות מודל וכשלי תקשורת.
    const apiMessage = error.response?.data?.error?.message;
    const isQuotaError = error.response?.status === 429 || error.response?.data?.error?.status === 'RESOURCE_EXHAUSTED';
    const isModelUnavailable = error.response?.status === 503 || error.response?.data?.error?.status === 'UNAVAILABLE';
    // אם Gemini מוגבל או אינו זמין, מנסים לענות מתוכן האתר שנשמר בבוט.
    if ((isQuotaError || isModelUnavailable) && bot) {
      const reason = isQuotaError ? 'quota' : 'unavailable';
      return res.json({ success: true, reply: buildChatFallbackReply(bot.scrapedContent, userQuestion, bot.websiteUrl, reason) });
    }
    // בוחרים הודעה מתאימה לבעיות TLS, מיצוי מכסה, זמינות או שגיאת API אחרת.
    const message = /self-signed certificate|certificate in certificate chain|TLS/i.test(error.message)
      ? 'השרת לא מצליח לאמת את תעודת ה-HTTPS של Google. יש להגדיר את תעודת ה-proxy של הרשת עבור Node.js.'
      : isQuotaError
        ? 'אני יכולה לענות על מידע שנמצא באתר, כולל פרטים, מחירים, הנחות ומשלוח כשאלה מופיעים בעמוד. שאלות כלליות יותר דורשות מכסת AI, והמכסה הנוכחית נוצלה כרגע.'
        : error.response?.status === 503
          ? 'מודל הבינה אינו זמין כרגע. נסי שוב בעוד רגע.'
          : apiMessage || 'שגיאה בתקשורת עם מודל הבינה המלאכותית';
    throw httpError(503, message);
  }
}

// מייצא את פעולות הבקר ואת פונקציות התשובה המקומית שנצרכות בבדיקות או במודולים.
export default { list, getById, update, remove, quota, createFromWebsite, chat, findRelevantSiteText, buildChatFallbackReply };