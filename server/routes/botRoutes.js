const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const axios = require('axios');
const https = require('https');
const Bot = require('../models/Bot');

const geminiHttpsAgent = new https.Agent({ rejectUnauthorized: false });

function extractProductSignals(websiteUrl) {
    try {
        const url = new URL(websiteUrl);
        const signals = [];
        const productId = url.pathname.match(/\/item\/(\d+)/i)?.[1];

        if (productId) {
            signals.push(`מזהה מוצר: ${productId}`);
        }

        const encodedPriceData = url.searchParams.get('pdp_npi');
        if (encodedPriceData) {
            const priceData = decodeURIComponent(encodedPriceData).replace(/%21/gi, '!');
            const currency = priceData.match(/!([A-Z]{3})!/i)?.[1];
            const values = priceData.split('!')
                .map(value => value.trim())
                .filter(Boolean)
                .map(value => Number(value))
                .filter(value => value > 0 && value < 10000)
                .filter(value => Number.isFinite(value))
                .slice(0, 4);

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

// ראוט ליצירת בוט חדש על ידי סריקת אתר באמצעות סקריפט הפייתון
router.post('/create-bot', async (req, res) => {
    try {
        let { websiteUrl, instructions, userId } = req.body;

        if (!websiteUrl) {
            return res.status(400).json({ success: false, message: 'נא להזין כתובת אתר' });
        }

        if (!/^[a-z][a-z\d+.-]*:\/\//i.test(websiteUrl)) {
            websiteUrl = `https://${websiteUrl}`;
        }

        let requestedUrl;
        try {
            requestedUrl = new URL(websiteUrl);
        } catch {
            return res.status(400).json({ success: false, message: 'כתובת האתר אינה תקינה' });
        }

        if (/safepage\.etrog\.net\.il/i.test(requestedUrl.hostname)) {
            return res.status(403).json({
                success: false,
                message: 'הרשת חסמה את האתר, ולכן לא ניתן לסרוק את תוכנו. יש לבחור אתר שנגיש מהרשת הנוכחית.'
            });
        }

        // הפעלת סקריפט הפייתון (scraper.py) ברקע לחילוץ מושלם של תוכן האתר
        const pythonProcess = spawn('python', ['scraper.py', websiteUrl]);

        let scrapedData = '';
        let errorData = '';

        pythonProcess.stdout.on('data', (data) => {
            scrapedData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorData += data.toString();
        });

        pythonProcess.on('close', async (code) => {
            if (code !== 0 || !scrapedData.trim()) {
                console.error('Python Scraper Error:', errorData);
                return res.status(422).json({ 
                    success: false, 
                    message: 'האתר חוסם סריקות אוטומטיות או נטען באופן דינמי. ודאי שהכתובת תקינה.' 
                });
            }

            const scrapedText = scrapedData.trim();

            if (scrapedText.length < 100) {
                return res.status(422).json({
                    success: false,
                    message: 'האתר נטען באופן דינמי או חסם את הסריקה, ולא נמצא בו מספיק תוכן קריא. נסי קישור ישיר לעמוד הרלוונטי או אתר נגיש יותר.'
                });
            }

            try {
                // שמירה במסד הנתונים
                const newBot = new Bot({
                    userId: userId || null,
                    websiteUrl,
                    scrapedContent: scrapedText.substring(0, 15000),
                    instructions: instructions || ''
                });

                await newBot.save();

                return res.status(201).json({
                    success: true,
                    message: 'הבוט נוצר ונסרק בהצלחה באמצעות פייתון!',
                    botId: newBot._id,
                    botUrl: `/pages/chat.html?botId=${newBot._id}`
                });
            } catch (dbError) {
                console.error('Database Save Error:', dbError);
                return res.status(500).json({ success: false, message: 'שגיאה בשמירת הבוט במסד הנתונים' });
            }
        });

    } catch (error) {
        console.error('Scraping error:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'שגיאה בסריקת האתר או ביצירת הבוט. ודאי שהכתובת תקינה.' 
        });
    }
});

// ראוט לקבלת הודעות בצ'אט ישירות דרך ה-API של גוגל באמצעות Axios
router.post('/:botId/chat', async (req, res) => {
    try {
        const { botId } = req.params;
        const { message } = req.body;

        const bot = await Bot.findById(botId);
        if (!bot) {
            return res.status(404).json({ success: false, message: 'הבוט לא נמצא' });
        }

        if (bot.scrapedContent.length < 100) {
            return res.json({
                success: true,
                reply: 'לא נשמר מספיק תוכן מהאתר כדי לענות באופן אמין. נסי לשלוח קישור ישיר לעמוד הרלוונטי או לבדוק שהעמוד נגיש.'
            });
        }

        const productSignals = extractProductSignals(bot.websiteUrl);
        const questionText = String(message);
        const isPriceQuestion = /מחיר|עולה|עלות|price|cost|כמה\s+(?:זה|הוא)\s*(?:עולה)?|כמה.*(?:עולה|עלות|מחיר)/i.test(questionText);
        const asksOriginalPrice = /מחיר\s*מקור|מחיר\s*רגיל|מחיר\s*לפני|original|regular/i.test(String(message));
        const asksAllPrices = /כל\s*(ה)?מחירים|מחירים\s*של|all\s*prices/i.test(String(message));
        const visiblePrices = extractVisiblePrices(bot.scrapedContent);
        const pricing = extractCommercePricing(bot.scrapedContent);
        const asksShipping = /כולל\s*משלוח|משלוח|shipping|delivery|סה["״׳']?כ|סך\s*הכל|total/i.test(String(message));
        const asksCoupon = /קופון|קוד|הנחה|לאחר\s*הנחה|after\s*(a\s*)?coupon|discount/i.test(questionText);
        const asksQuota = /כמה\s+(?:בקשות|שאלות)|מכסה|הגבלה|quota|limit/i.test(questionText);

        if (asksQuota) {
            return res.json({
                success: true,
                reply: 'מספר השאלות תלוי במכסת ה־API של הבינה שמוגדרת בשרת, ולא במגבלה של הבוט עצמו. שאלות מחיר, משלוח והנחה שנמצאות בעמוד נענות מקומית ואינן צורכות מכסת AI.'
            });
        }

        const hasCommerceContext = pricing.currentPrice !== null || /מחיר|price|₪|ILS|shipping|משלוח/i.test(bot.scrapedContent);
        if (asksCoupon && pricing.currentPrice !== null && hasCommerceContext) {
            if (pricing.discountPercent === null) {
                return res.json({
                    success: true,
                    reply: `מחיר המוצר הוא ₪${pricing.currentPrice.toFixed(2)}, אבל העמוד לא מציג סכום או אחוז קופון שאפשר לחשב. צריך להזין את ערך הקופון כדי לחשב מחיר סופי.`
                });
            }

            const discountedPrice = pricing.currentPrice * (1 - pricing.discountPercent / 100);
            return res.json({
                success: true,
                reply: `מחיר אחרי הנחת ${pricing.discountPercent}%: ₪${discountedPrice.toFixed(2)}. המחיר לפני ההנחה היה ₪${pricing.currentPrice.toFixed(2)}; קופון נוסף, משלוח ומסים עשויים לשנות את הסכום הסופי.`
            });
        }

        if (asksShipping && pricing.currentPrice !== null && hasCommerceContext) {
            if (pricing.shipping === null) {
                return res.json({
                    success: true,
                    reply: `מחיר המוצר הוא ₪${pricing.currentPrice.toFixed(2)}, אבל העמוד לא מציג עלות משלוח קבועה. עלות המשלוח תלויה בכתובת ובאפשרות המשלוח שנבחרה.`
                });
            }

            const total = pricing.currentPrice + pricing.shipping;
            return res.json({
                success: true,
                reply: `מחיר המוצר: ₪${pricing.currentPrice.toFixed(2)}. משלוח: ${pricing.shipping === 0 ? 'חינם' : `₪${pricing.shipping.toFixed(2)}`}. סך הכל לפני מסים: ₪${total.toFixed(2)}.${pricing.beforeTaxes ? ' העמוד מציין שהמחיר לפני מסים.' : ''}`
            });
        }

        if (isPriceQuestion && visiblePrices.length && hasCommerceContext) {
            const selectedPrices = asksOriginalPrice
                ? visiblePrices.slice(1, 2)
                : asksAllPrices
                    ? visiblePrices
                    : visiblePrices.slice(0, 1);
            const label = asksOriginalPrice ? 'מחיר המקור' : asksAllPrices ? 'המחירים שמצאתי' : 'המחיר הנוכחי';

            return res.json({
                success: true,
                reply: `${label}: ${selectedPrices.length ? selectedPrices.map(price => `₪${price.toFixed(2)}`).join(', ') : 'לא נמצא במחיר שנשמר בעמוד'}. המחיר עשוי להשתנות לפי וריאציה, משלוח, קופון או מבצע.`
            });
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
    4. אם השאלה כללית מדי, למשל "כמה עולה נעליים", אל תמציא מחיר ואל תציג סירוב. בקש את שם המוצר, הדגם או קישור ישיר למוצר כדי לתת תשובה מדויקת.
    5. אסור להמציא פרטים, מחירים, מדיניות או עובדות שלא מופיעים בתוכן האתר. אל תשתמש בידע כללי כדי להשלים מידע חסר.
    6. אם המשתמשת מבקשת את כל המחירים באתר או מחיר עדכני שאין בתוכן שנסרק, הסברי שאי אפשר לבדוק את כל הקטלוג ובקשי קישור למוצר או לקטגוריה.
    7. רק אם השאלה אינה קשורה כלל לתחום האתר, כתוב: "מצטערת, אני יכולה לענות רק על שאלות הקשורות לתכני האתר."
    8. ענה בשפה שבה נשאלה השאלה, ובשפה טבעית ונעימה.

    שאלת המשתמשת:
    ---
    ${message}
    ---
        `;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ success: false, message: 'מפתח API של גוגל לא הוגדר בקובץ הסביבה' });
        }

        const geminiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
                contents: [
                    {
                        parts: [
                            { text: prompt }
                        ]
                    }
                ]
            },
            {
                httpsAgent: geminiHttpsAgent,
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000
            }
        );

        const replyText = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'לא התקבלה תשובה תקינה מהמודל.';

        res.json({
            success: true,
            reply: replyText
        });

    } catch (error) {
        console.error('AI Chat error:', error.response?.data || error.message);
        const apiMessage = error.response?.data?.error?.message;
        const message = /self-signed certificate|certificate in certificate chain|TLS/i.test(error.message)
            ? 'השרת לא מצליח לאמת את תעודת ה-HTTPS של Google. יש להגדיר את תעודת ה-proxy של הרשת עבור Node.js.'
            : error.response?.status === 429 || error.response?.data?.error?.status === 'RESOURCE_EXHAUSTED'
            ? 'אני יכולה לענות על מידע שנמצא באתר, כולל פרטים, מחירים, הנחות ומשלוח כשאלה מופיעים בעמוד. שאלות כלליות יותר דורשות מכסת AI, והמכסה הנוכחית נוצלה כרגע.'
                : error.response?.status === 503
                    ? 'מודל הבינה אינו זמין כרגע. נסי שוב בעוד רגע.'
                    : apiMessage || 'שגיאה בתקשורת עם מודל הבינה המלאכותית';
        const isQuotaError = error.response?.status === 429 || error.response?.data?.error?.status === 'RESOURCE_EXHAUSTED';
        if (isQuotaError) {
            return res.json({ success: true, reply: message });
        }

        res.status(500).json({ success: false, message });
    }
});

module.exports = router;