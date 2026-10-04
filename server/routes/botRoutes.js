const express = require('express');
const router = express.Router();
const botController = require('../controllers/botController');
const { authenticateToken } = require('../middlewares/authMiddleware');

<<<<<<< HEAD
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

// יצירת בוט וסריקה חד-פעמית
router.post('/create-bot', async (req, res) => {
    try {
        let { websiteUrl, instructions, userId } = req.body;
        if (!websiteUrl) return res.status(400).json({ success: false, message: 'נא להזין כתובת אתר' });

        if (!/^[a-z][a-z\d+.-]*:\/\//i.test(websiteUrl)) {
            websiteUrl = `https://${websiteUrl}`; // תוקן לגרש הפוך
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
            botUrl: `/pages/chat.html?botId=${newBot._id}` // תוקן לגרש הפוך
        });
    } catch (error) {
        console.error('Create bot error:', error.message);
        res.status(500).json({ success: false, message: 'שגיאה בסריקת האתר' });
    }
});

// צ'אט מול הבוט הקיים באמצעות Gemini מעודכן
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

        const prompt = `אתה נציג שירות חכם, לבבי וידידותי של האתר! 🌟 ענה לשאלות המשתמשת אך ורק בהתבסס על תוכן האתר שסופק להלן. אם השאלה אינה קשורה כלל לתכני האתר, ענה בקצרה ובאדיבות: "אין תוכן שנוגע לאתר שלנו."
דבר בצורה טבעית, חמימה ושלב אימוגים 😊.

כתובת האתר: ${bot.websiteUrl}
תוכן האתר:
---
${bot.scrapedContent}
---

שאלת המשתמשת:
${message}`;

        const geminiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
            { contents: [{ parts: [{ text: prompt }] }] },
            {
                httpsAgent: geminiHttpsAgent,
                headers: { 'Content-Type': 'application/json' },
                timeout: 20000
            }
        );

        const replyText = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'התקבלה תשובה ריקה.';

        res.json({
            success: true,
            reply: replyText
        });

    } catch (error) {
        console.error('Gemini Chat error:', error.response?.data || error.message);
        res.status(500).json({ success: false, message: 'שגיאה בתקשורת עם מודל הבינה' });
    }
});
=======
router.get('/', authenticateToken, botController.list);
router.get('/:botId', authenticateToken, botController.getById);
router.post('/create-bot', authenticateToken, botController.createFromWebsite);
router.put('/:botId', authenticateToken, botController.update);
router.delete('/:botId', authenticateToken, botController.remove);
router.post('/:botId/chat', botController.chat);
>>>>>>> b2bfc2d14049709ceeea182d0b1c06118eefbe3c

module.exports = router;