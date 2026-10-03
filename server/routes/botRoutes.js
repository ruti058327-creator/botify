const express = require('express');
const router = express.Router();
const axios = require('axios');
const https = require('https');
const { chromium } = require('playwright');
const Bot = require('../models/Bot');

const geminiHttpsAgent = new https.Agent({ rejectUnauthorized: false });

async function scrapeWebsite(websiteUrl) {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        });

        const firstUrl = new URL(websiteUrl);
        await page.goto(firstUrl.href, { timeout: 30000, waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);

        const scrapedText = await page.evaluate(() => document.body?.innerText || '');
        return scrapedText.replace(/\s+/g, ' ').trim();
    } finally {
        await browser.close();
    }
}

router.post('/create-bot', async (req, res) => {
    try {
        let { websiteUrl, instructions, userId } = req.body;
        if (!websiteUrl) return res.status(400).json({ success: false, message: 'נא להזין כתובת אתר' });

        if (!/^[a-z][a-z\d+.-]*:\/\//i.test(websiteUrl)) {
            websiteUrl = `https://${websiteUrl}`;
        }

        const scrapedText = await scrapeWebsite(websiteUrl);
        if (!scrapedText || scrapedText.length < 20) {
            return res.status(422).json({ success: false, message: 'לא נמצא באתר מספיק תוכן לסריקה.' });
        }

        const newBot = new Bot({
            userId: userId || null,
            websiteUrl,
            scrapedContent: scrapedText.substring(0, 15000),
            instructions: instructions || ''
        });

        await newBot.save();
        return res.status(201).json({
            success: true,
            message: 'הבוט נוצר בהצלחה!',
            botId: newBot._id,
            botUrl: `/pages/chat.html?botId=${newBot._id}`
        });
    } catch (error) {
        console.error('Create bot error:', error.message);
        res.status(500).json({ success: false, message: 'שגיאה בסריקת האתר' });
    }
});

router.post('/:botId/chat', async (req, res) => {
    try {
        const { botId } = req.params;
        const { message } = req.body;

        const bot = await Bot.findById(botId);
        if (!bot) return res.status(404).json({ success: false, message: 'הבוט לא נמצא' });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ success: false, message: 'מפתח API של גוגל לא הוגדר בקובץ הסביבה' });
        }

        const safeContent = (bot.scrapedContent || '').substring(0, 8000);

        const prompt = `אתה נציג שירות חכם, לבבי וידידותי של האתר! 🌟 ענה לשאלות המשתמשת אך ורק בהתבסס על תוכן האתר שסופק להלן. אם השאלה אינה קשורה כלל לתכני האתר, ענה בקצרה ובאדיבות: "אין תוכן שנוגע לאתר שלנו."
דבר בצורה טבעית, חמימה ושלב אימוגים 😊.

כתובת האתר: ${bot.websiteUrl}
תוכן האתר:
---
${safeContent}
---

שאלת המשתמשת:
${message}`;

        // שימוש במודל הרשמי והנכון gemini-3.8-flash
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
            { contents: [{ parts: [{ text: prompt }] }] },
            {
                httpsAgent: geminiHttpsAgent,
                headers: { 'Content-Type': 'application/json' },
                timeout: 25000
            }
        );

        const replyText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!replyText) {
            return res.status(500).json({ success: false, message: 'התקבלה תשובה ריקה מהמודל' });
        }

        res.json({
            success: true,
            reply: replyText
        });

    } catch (error) {
        console.error('Gemini Chat error:', error.response?.data || error.message);
        const errorMsg = error.response?.data?.error?.message || error.message;
        
        // אם מופיע עומס זמני, נציג הודעה ברורה
        if (errorMsg.includes('high demand') || errorMsg.includes('UNAVAILABLE')) {
            return res.status(503).json({ success: false, message: 'השרת של גוגל עמוס כרגע. נסי לשלוח את ההודעה שוב בעוד כמה שניות.' });
        }

        res.status(500).json({ success: false, message: 'שגיאה בקבלת תשובה. נסי שוב בעוד רגע.' });
    }
});

module.exports = router;