const Bot = require('../models/Bot');
const Payment = require('../models/Payment');
const User = require('../models/User');
const axios = require('axios');
const https = require('https');
const { chromium } = require('playwright');
const Fuse = require('fuse.js');
const { PLANS, getBotLimit } = require('../utils/plans');

const geminiHttpsAgent = new https.Agent({ rejectUnauthorized: false });
const LOCAL_FALLBACK_REPLY = 'מצאתי תוכן באתר, אבל אין כרגע מספיק מידע מסודר כדי לענות על השאלה.';

function extractProductSignals(websiteUrl) {
  try {
    const url = new URL(websiteUrl);
    const signals = [];
    const productId = url.pathname.match(/\/item\/(\d+)/i)?.[1];
    if (productId) signals.push(`מזהה מוצר: ${productId}`);

    const encodedPriceData = url.searchParams.get('pdp_npi');
    if (encodedPriceData) {
      const priceData = decodeURIComponent(encodedPriceData).replace(/%21/gi, '!');
      const currency = priceData.match(/!([A-Z]{3})!/i)?.[1];
      const values = priceData.split('!').map(value => value.trim()).filter(Boolean)
        .map(value => Number(value)).filter(value => value > 0 && value < 10000)
        .filter(Number.isFinite).slice(0, 4);
      if (currency && values.length) {
        signals.push(`נתוני מחיר שהגיעו בתוך הקישור: ${currency} ${values.join(', ')}. ייתכן שמדובר במחיר מבצע, מחיר קודם, מחיר לפי וריאציה או מחיר משלוח.`);
      }
    }
    return signals.join('\n');
  } catch {
    return '';
  }
}

function extractVisiblePrices(text) {
  const matches = [...String(text).matchAll(/(?:₪|ILS\s*)(\d+(?:[.,]\d{1,2})?)/gi)]
    .map(match => Number(match[1].replace(',', '.')))
    .filter(value => Number.isFinite(value) && value > 0 && value < 100000);
  return [...new Set(matches)];
}

function extractCommercePricing(text) {
  const normalizedText = String(text);
  const prices = extractVisiblePrices(normalizedText);
  const priceSection = normalizedText.match(/([^.!?]{0,240}המחיר מוצג לפני מסים)/i)?.[1] || normalizedText.slice(0, 500);
  const sectionPrices = extractVisiblePrices(priceSection);
  const currentPrice = sectionPrices[0] || prices[0] || null;
  const originalPrice = sectionPrices[2] || sectionPrices[1] || null;
  const shippingMatch = normalizedText.match(/(?:אספקה(?:\s+מהירה)?|משלוח|shipping|delivery)[^₪]{0,100}₪\s*(\d+(?:[.,]\d{1,2})?)/i);
  const shipping = shippingMatch
    ? Number(shippingMatch[1].replace(',', '.'))
    : (/משלוח\s+חינם|free\s+shipping/i.test(normalizedText) ? 0 : null);
  const discountMatch = normalizedText.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:הנחה|discount)/i);
  const discountPercent = discountMatch ? Number(discountMatch[1].replace(',', '.')) : null;

  return {
    currentPrice,
    originalPrice,
    shipping: Number.isFinite(shipping) ? shipping : null,
    discountPercent: Number.isFinite(discountPercent) ? discountPercent : null,
    beforeTaxes: /מחיר מוצג לפני מסים|before taxes|taxes not included/i.test(normalizedText),
    prices
  };
}

function extractCourseNames(siteContent) {
  const coursePatterns = [
    [/Full Stack courses?/i, 'קורסי Full Stack'],
    [/Chip\s*&\s*Embedded courses?/i, 'קורסי Chip & Embedded'],
    [/AI\s*&\s*Data courses?/i, 'קורסי AI & Data'],
    [/Bootcamps\s*&\s*Practicum/i, 'Bootcamps והתנסות מעשית'],
    [/Preparation for Job interviews/i, 'הכנה לראיונות עבודה']
  ];
  return coursePatterns.filter(([pattern]) => pattern.test(String(siteContent))).map(([, label]) => label);
}

function findRelevantSiteText(siteContent, question) {
  const sentences = String(siteContent)
    .replace(/\s+/g, ' ')
    .split(/[.!?…]+|\s+[|•]\s+/u)
    .flatMap(sentence => {
      const parts = [];
      let remaining = sentence.trim();
      while (remaining.length > 360) {
        let splitAt = remaining.lastIndexOf(' ', 360);
        if (splitAt < 180) splitAt = 360;
        parts.push(remaining.slice(0, splitAt).trim());
        remaining = remaining.slice(splitAt).trim();
      }
      if (remaining) parts.push(remaining);
      return parts;
    })
    .filter(sentence => sentence.length >= 20);
  if (!sentences.length || !String(question).trim()) return '';

  const queryTerms = [...new Set(String(question).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [])]
    .filter(term => term.length >= 3);
  if (!queryTerms.length) return '';

  const fuse = new Fuse(sentences, {
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 3,
    threshold: 0.38
  });
  const scoredSentences = new Map();
  for (const term of queryTerms) {
    for (const result of fuse.search(term)) {
      if (result.score === undefined || result.score > 0.38) continue;
      const current = scoredSentences.get(result.item) || { matchCount: 0, totalScore: 0 };
      current.matchCount += 1;
      current.totalScore += result.score;
      scoredSentences.set(result.item, current);
    }
  }

  const minimumMatches = Math.min(2, queryTerms.length);
  return [...scoredSentences.entries()]
    .filter(([, result]) => result.matchCount >= minimumMatches)
    .sort((first, second) => second[1].matchCount - first[1].matchCount || first[1].totalScore - second[1].totalScore)
    .slice(0, 2)
    .map(([sentence]) => sentence)
    .join(' ');
}

function buildLocalSiteReply(siteContent, question, websiteUrl) {
  const questionText = String(question);
  const courseNames = extractCourseNames(siteContent);
  if (/אזור ה?אישי|התחבר|כניסה|חשבון|login|personal area/i.test(questionText)) {
    return `כדי להיכנס לאזור האישי, פתחי את עמוד ההתחברות של האתר: ${new URL('/login/index.php', websiteUrl).href}`;
  }
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
  const relevantText = findRelevantSiteText(siteContent, questionText);
  return relevantText ? `לפי התוכן שנסרק באתר: ${relevantText}` : LOCAL_FALLBACK_REPLY;
}

function buildChatFallbackReply(siteContent, question, websiteUrl, reason) {
  const localReply = buildLocalSiteReply(siteContent, question, websiteUrl);
  if (localReply !== LOCAL_FALLBACK_REPLY) return localReply;

  if (reason === 'quota') {
    return 'מכסת השימוש ב-Gemini נוצלה כרגע, וגם החיפוש המקומי בתוכן האתר לא מצא תשובה מתאימה לשאלה. אפשר לנסות שוב לאחר איפוס המכסה או לוודא שמוגדרת לשרת מכסת API זמינה.';
  }
  return 'Gemini אינו זמין כרגע, והחיפוש המקומי בתוכן האתר לא מצא תשובה מתאימה. אפשר לנסות שוב בעוד כמה דקות.';
}

async function scrapeWebsite(websiteUrl) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    const visitedUrls = new Set();
    const pageTexts = [];
    const extractPageText = async () => page.evaluate(() => {
      const visibleText = document.body?.innerText || '';
      const metadata = [...document.querySelectorAll('title, meta[name="description"], h1, h2, h3, p, a')]
        .map(element => element.getAttribute('content') || element.textContent || '').join(' ');
      return `${visibleText} ${metadata}`;
    });

    const firstUrl = new URL(websiteUrl);
    await page.goto(firstUrl.href, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    await page.waitForFunction(() => document.body && document.body.innerText.trim().length > 50, null, { timeout: 10000 }).catch(() => {});
    visitedUrls.add(page.url());
    pageTexts.push(await extractPageText());

    const internalUrls = await page.locator('a[href]').evaluateAll((links, origin) => links
      .map(link => {
        try { return new URL(link.href, origin); } catch { return null; }
      })
      .filter(url => url && url.origin === origin)
      .filter(url => !/login|admin|privacy|\.js(?:$|\?)/i.test(url.pathname))
      .map(url => url.href)
      .filter((url, index, urls) => urls.indexOf(url) === index)
      .slice(0, 8), firstUrl.origin);

    for (const internalUrl of internalUrls) {
      if (visitedUrls.has(internalUrl)) continue;
      try {
        await page.goto(internalUrl, { timeout: 20000, waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        visitedUrls.add(internalUrl);
        pageTexts.push(await extractPageText());
      } catch (error) {
        console.warn(`Skipping internal page ${internalUrl}: ${error.message}`);
      }
    }
    return pageTexts.join(' ').replace(/\s+/g, ' ').trim();
  } finally {
    await browser.close();
  }
}

function canManageBot(bot, user) {
  return user.role === 'admin' || String(bot.userId) === user.id;
}

function serializeBot(bot) {
  return {
    id: bot._id,
    websiteUrl: bot.websiteUrl,
    instructions: bot.instructions,
    createdAt: bot.createdAt
  };
}

async function list(req, res) {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user.id };
    const bots = await Bot.find(filter).sort({ createdAt: -1 });
    return res.json({ success: true, bots: bots.map(serializeBot) });
  } catch (error) {
    console.error('List bots error:', error.message);
    return res.status(500).json({ success: false, message: 'לא ניתן לטעון את הבוטים כרגע' });
  }
}

async function getById(req, res) {
  try {
    const bot = await Bot.findById(req.params.botId);
    if (!bot || !canManageBot(bot, req.user)) {
      return res.status(404).json({ success: false, message: 'הבוט לא נמצא' });
    }
    return res.json({ success: true, bot: serializeBot(bot) });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'מזהה הבוט אינו תקין' });
  }
}

async function update(req, res) {
  if (typeof req.body.instructions !== 'string' || req.body.instructions.length > 5000) {
    return res.status(400).json({ success: false, message: 'ההנחיות חייבות להיות טקסט של עד 5000 תווים' });
  }

  try {
    const bot = await Bot.findById(req.params.botId);
    if (!bot || !canManageBot(bot, req.user)) {
      return res.status(404).json({ success: false, message: 'הבוט לא נמצא' });
    }
    bot.instructions = req.body.instructions;
    await bot.save();
    return res.json({ success: true, bot: serializeBot(bot) });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'לא ניתן לעדכן את הבוט' });
  }
}

async function remove(req, res) {
  try {
    const bot = await Bot.findById(req.params.botId);
    if (!bot || !canManageBot(bot, req.user)) {
      return res.status(404).json({ success: false, message: 'הבוט לא נמצא' });
    }
    await bot.deleteOne();
    return res.json({ success: true, message: 'הבוט נמחק בהצלחה' });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'לא ניתן למחוק את הבוט' });
  }
}

async function getBotQuota(userId) {
  const [user, botCount, completedPayment] = await Promise.all([
    User.findById(userId).select('_id'),
    Bot.countDocuments({ userId }),
    Payment.findOne({ userId, status: 'completed' }).sort({ createdAt: -1 }).select('planId')
  ]);
  if (!user) return null;

  const botLimit = completedPayment ? getBotLimit(completedPayment.planId) : 1;
  return {
    botCount,
    botLimit,
    planId: completedPayment?.planId || 'בסיסי',
    canCreate: botCount < botLimit
  };
}

async function quota(req, res) {
  if (req.user.role === 'admin') {
    return res.json({ success: true, canCreate: true, requiresPayment: false });
  }

  try {
    const requestedPlanId = req.query.planId;
    if (requestedPlanId && !PLANS[requestedPlanId]) {
      return res.status(400).json({ success: false, message: 'המסלול שנבחר אינו תקין' });
    }

    const userQuota = await getBotQuota(req.user.id);
    if (!userQuota) return res.status(401).json({ success: false, message: 'יש להתחבר מחדש כדי ליצור בוט' });
    const targetBotLimit = requestedPlanId ? getBotLimit(requestedPlanId) : userQuota.botLimit;
    return res.json({
      success: true,
      ...userQuota,
      targetBotLimit,
      botsToDelete: Math.max(0, userQuota.botCount - targetBotLimit),
      requiresPayment: !userQuota.canCreate,
      pricingUrl: '/pages/pricing.html?required=bot'
    });
  } catch (error) {
    console.error('Bot quota check error:', error.message);
    return res.status(500).json({ success: false, message: 'לא ניתן לבדוק את מכסת הבוטים כרגע' });
  }
}

async function createFromWebsite(req, res) {
  try {
    if (req.user.role !== 'admin') {
      const userQuota = await getBotQuota(req.user.id);
      if (!userQuota) return res.status(401).json({ success: false, message: 'יש להתחבר מחדש כדי ליצור בוט' });
      if (!userQuota.canCreate) {
        return res.status(403).json({
          success: false,
          code: 'BOT_LIMIT_REACHED',
          message: 'הגעת למכסת הבוטים במסלול שלך. יש לבחור מסלול בתשלום כדי ליצור בוטים נוספים.',
          pricingUrl: '/pages/pricing.html?required=bot'
        });
      }
    }

    let { websiteUrl, instructions } = req.body;
    if (!websiteUrl) return res.status(400).json({ success: false, message: 'נא להזין כתובת אתר' });
    if (!/^[a-z][a-z\d+.-]*:\/\//i.test(websiteUrl)) websiteUrl = `https://${websiteUrl}`;

    let requestedUrl;
    try { requestedUrl = new URL(websiteUrl); } catch {
      return res.status(400).json({ success: false, message: 'כתובת האתר אינה תקינה' });
    }
    if (/safepage\.etrog\.net\.il/i.test(requestedUrl.hostname)) {
      return res.status(403).json({ success: false, message: 'הרשת חסמה את האתר, ולכן לא ניתן לסרוק את תוכנו. יש לבחור אתר שנגיש מהרשת הנוכחית.' });
    }

    const scrapedText = await scrapeWebsite(websiteUrl);
    if (!scrapedText || scrapedText.length < 20) {
      return res.status(422).json({ success: false, message: 'לא נמצא באתר מספיק תוכן קריא לסריקה. ייתכן שהאתר נטען באופן דינמי או חסם את הסריקה.' });
    }

    const newBot = new Bot({
      userId: req.user.role === 'admin' ? null : req.user.id,
      websiteUrl,
      scrapedContent: scrapedText.substring(0, 15000),
      instructions: instructions || ''
    });
    await newBot.save();
    return res.status(201).json({
      success: true,
      message: 'הבוט נוצר ונסרק בהצלחה באמצעות Playwright!',
      botId: newBot._id,
      botUrl: `/pages/chat.html?botId=${newBot._id}`
    });
  } catch (error) {
    console.error('Scraping error:', error.message);
    return res.status(500).json({ success: false, message: 'שגיאה בסריקת האתר או ביצירת הבוט. ודאי שהכתובת תקינה.' });
  }
}

async function chat(req, res) {
  let bot;
  let userQuestion = '';
  try {
    const { botId } = req.params;
    const { message } = req.body;
    userQuestion = String(message || '');
    bot = await Bot.findById(botId);
    if (!bot) return res.status(404).json({ success: false, message: 'הבוט לא נמצא' });
    if (!bot.scrapedContent || !bot.scrapedContent.trim()) {
      return res.json({ success: true, reply: 'לא נשמר תוכן מהאתר. נסי ליצור את הבוט מחדש עם קישור ישיר לעמוד ציבורי ונגיש.' });
    }

    const productSignals = extractProductSignals(bot.websiteUrl);
    const questionText = String(message);
    if (/^(הי|היי|שלום|הלו|hello|hi|hey|vh)[!?.\s]*$/i.test(questionText.trim())) {
      return res.json({ success: true, reply: 'היי! אני כאן כדי לענות על שאלות מתוך תוכן האתר. מה תרצי לדעת?' });
    }
    const isPriceQuestion = /מחיר|עולה|עלות|price|cost|כמה\s+(?:זה|הוא)\s*(?:עולה)?|כמה.*(?:עולה|עלות|מחיר)/i.test(questionText);
    const asksOriginalPrice = /מחיר\s*מקור|מחיר\s*רגיל|מחיר\s*לפני|original|regular/i.test(questionText);
    const asksAllPrices = /כל\s*(ה)?מחירים|מחירים\s*של|all\s*prices/i.test(questionText);
    const visiblePrices = extractVisiblePrices(bot.scrapedContent);
    const pricing = extractCommercePricing(bot.scrapedContent);
    const asksShipping = /כולל\s*משלוח|משלוח|shipping|delivery|סה["״׳']?כ|סך\s*הכל|total/i.test(questionText);
    const asksCoupon = /קופון|קוד|הנחה|לאחר\s*הנחה|after\s*(a\s*)?coupon|discount/i.test(questionText);
    const asksQuota = /כמה\s+(?:בקשות|שאלות)|מכסה|הגבלה|quota|limit/i.test(questionText);

    if (asksQuota) {
      return res.json({ success: true, reply: 'מספר השאלות תלוי במכסת ה־API של הבינה שמוגדרת בשרת, ולא במגבלה של הבוט עצמו. שאלות מחיר, משלוח והנחה שנמצאות בעמוד נענות מקומית ואינן צורכות מכסת AI.' });
    }
    const hasCommerceContext = pricing.currentPrice !== null || /מחיר|price|₪|ILS|shipping|משלוח/i.test(bot.scrapedContent);
    if (asksCoupon && pricing.currentPrice !== null && hasCommerceContext) {
      if (pricing.discountPercent === null) {
        return res.json({ success: true, reply: `מחיר המוצר הוא ₪${pricing.currentPrice.toFixed(2)}, אבל העמוד לא מציג סכום או אחוז קופון שאפשר לחשב. צריך להזין את ערך הקופון כדי לחשב מחיר סופי.` });
      }
      const discountedPrice = pricing.currentPrice * (1 - pricing.discountPercent / 100);
      return res.json({ success: true, reply: `מחיר אחרי הנחת ${pricing.discountPercent}%: ₪${discountedPrice.toFixed(2)}. המחיר לפני ההנחה היה ₪${pricing.currentPrice.toFixed(2)}; קופון נוסף, משלוח ומסים עשויים לשנות את הסכום הסופי.` });
    }
    if (asksShipping && pricing.currentPrice !== null && hasCommerceContext) {
      if (pricing.shipping === null) {
        return res.json({ success: true, reply: `מחיר המוצר הוא ₪${pricing.currentPrice.toFixed(2)}, אבל העמוד לא מציג עלות משלוח קבועה. עלות המשלוח תלויה בכתובת ובאפשרות המשלוח שנבחרה.` });
      }
      const total = pricing.currentPrice + pricing.shipping;
      return res.json({ success: true, reply: `מחיר המוצר: ₪${pricing.currentPrice.toFixed(2)}. משלוח: ${pricing.shipping === 0 ? 'חינם' : `₪${pricing.shipping.toFixed(2)}`}. סך הכל לפני מסים: ₪${total.toFixed(2)}.${pricing.beforeTaxes ? ' העמוד מציין שהמחיר לפני מסים.' : ''}` });
    }
    if (isPriceQuestion && visiblePrices.length && hasCommerceContext) {
      const selectedPrices = asksOriginalPrice ? visiblePrices.slice(1, 2) : asksAllPrices ? visiblePrices : visiblePrices.slice(0, 1);
      const label = asksOriginalPrice ? 'מחיר המקור' : asksAllPrices ? 'המחירים שמצאתי' : 'המחיר הנוכחי';
      return res.json({ success: true, reply: `${label}: ${selectedPrices.length ? selectedPrices.map(price => `₪${price.toFixed(2)}`).join(', ') : 'לא נמצא במחיר שנשמר בעמוד'}. המחיר עשוי להשתנות לפי וריאציה, משלוח, קופון או מבצע.` });
    }

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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ success: false, message: 'מפתח API של גוגל לא הוגדר בקובץ הסביבה' });

    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      { contents: [{ parts: [{ text: prompt }] }] },
      { httpsAgent: geminiHttpsAgent, headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    const replyText = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'לא התקבלה תשובה תקינה מהמודל.';
    return res.json({ success: true, reply: replyText });
  } catch (error) {
    console.error('AI Chat error:', error.response?.data || error.message);
    const apiMessage = error.response?.data?.error?.message;
    const isQuotaError = error.response?.status === 429 || error.response?.data?.error?.status === 'RESOURCE_EXHAUSTED';
    const isModelUnavailable = error.response?.status === 503 || error.response?.data?.error?.status === 'UNAVAILABLE';
    if ((isQuotaError || isModelUnavailable) && bot) {
      const reason = isQuotaError ? 'quota' : 'unavailable';
      return res.json({ success: true, reply: buildChatFallbackReply(bot.scrapedContent, userQuestion, bot.websiteUrl, reason) });
    }
    const message = /self-signed certificate|certificate in certificate chain|TLS/i.test(error.message)
      ? 'השרת לא מצליח לאמת את תעודת ה-HTTPS של Google. יש להגדיר את תעודת ה-proxy של הרשת עבור Node.js.'
      : isQuotaError
        ? 'אני יכולה לענות על מידע שנמצא באתר, כולל פרטים, מחירים, הנחות ומשלוח כשאלה מופיעים בעמוד. שאלות כלליות יותר דורשות מכסת AI, והמכסה הנוכחית נוצלה כרגע.'
        : error.response?.status === 503
          ? 'מודל הבינה אינו זמין כרגע. נסי שוב בעוד רגע.'
          : apiMessage || 'שגיאה בתקשורת עם מודל הבינה המלאכותית';
    return res.status(500).json({ success: false, message });
  }
}

module.exports = { list, getById, update, remove, quota, createFromWebsite, chat, findRelevantSiteText, buildChatFallbackReply };