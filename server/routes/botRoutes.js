const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const Bot = require('../models/Bot');

// ראוט ליצירת בוט חדש על ידי סריקת אתר אמיתי
router.post('/create-bot', async (req, res) => {
    try {
        const { websiteUrl, instructions, userId } = req.body;

        if (!websiteUrl) {
            return res.status(400).json({ success: false, message: 'נא להזין כתובת אתר' });
        }

        // 1. שליפת תוכן ה-HTML של האתר עם כותרות דפדפן למניעת חסימות
        const response = await axios.get(websiteUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 15000
        });
        const html = response.data;

        // 2. ניקוי סקריפטים ועיצובים ישירות מה-HTML בבטחה מלאה
        const cleanHtml = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

        // 3. חילוץ טקסט נקי בעזרת Cheerio
        const $ = cheerio.load(cleanHtml);
        let scrapedText = $('body').text().replace(/\s+/g, ' ').trim();

        if (!scrapedText) {
            scrapedText = $('html').text().replace(/\s+/g, ' ').trim() || `אתר בוט: ${websiteUrl}`;
        }

        // 4. שמירה במסד הנתונים
        const newBot = new Bot({
            userId: userId || null,
            websiteUrl,
            scrapedContent: scrapedText.substring(0, 15000),
            instructions: instructions || ''
        });

        await newBot.save();

        res.status(201).json({
            success: true,
            message: 'הבוט נוצר ונסרק בהצלחה!',
            botId: newBot._id,
            botUrl: `/pages/chat.html?botId=${newBot._id}`
        });

    } catch (error) {
        const networkErrorCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND'];
        const isNetworkError = networkErrorCodes.includes(error.code) || /TLS|secure connection|socket disconnected/i.test(error.message);
        const statusCode = error.response?.status;
        const message = isNetworkError
            ? 'השרת לא הצליח לגשת לאתר דרך HTTPS. בדקי שהשרת מחובר לאינטרנט ושאין חסימת proxy או TLS.'
            : statusCode
                ? `האתר החזיר שגיאה ${statusCode}. ייתכן שהוא חוסם סריקה אוטומטית.`
                : 'שגיאה בסריקת האתר או ביצירת הבוט. ודאי שהכתובת תקינה.';

        console.error('Scraping error:', error.code || statusCode || error.message);
        res.status(500).json({ 
            success: false, 
            message
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

        const prompt = `
אתה עוזר וירטואלי מקצועי שתפקידו היחיד הוא לענות על שאלות אך ורק בהתבסס על תוכן האתר שנסרק וצורף להלן.
כתובת האתר: ${bot.websiteUrl}

תוכן האתר שנסרק:
---
${bot.scrapedContent}
---

הנחיות קשיחות לתשובה:
1. ענה אך ורק על סמך המידע שמופיע בתוכן האתר שלמעלה.
2. אם השאלה של המשתמשת אינה קשורה לתוכן האתר, או שהמידע פשוט לא קיים בתוכן שנסרק - ענה בדיוק כך: "מצטערת, המידע הזה אינו מופיע באתר שנסרק. אני יכולה לענות רק על שאלות הקשורות לתכנים של האתר."
3. בשום אופן אל תשתמש בידע הכללי שלך ואל תמציא מידע שלא קיים בטקסט של האתר.
4. ענה בשפה שבה נשאלה השאלה (עברית).

שאלת המשתמשת: "${message}"
        `;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ success: false, message: 'מפתח API של גוגל לא הוגדר בקובץ הסביבה' });
        }

        // שליחת בקשת HTTP ישירה ל-API הרשמי של גוגל
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
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000
            }
        );

        // חילוץ התשובה מתוך מבנה הנתונים של גוגל
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
            : apiMessage || 'שגיאה בתקשורת עם מודל הבינה המלאכותית';
        res.status(500).json({ success: false, message });
    }
});

module.exports = router;