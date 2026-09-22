const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const Bot = require('../models/Bot');

// ראוט ליצירת בוט חדש על ידי סריקת אתר
router.post('/create-bot', async (req, res) => {
    try {
        const { websiteUrl, instructions, userId } = req.body;

        if (!websiteUrl) {
            return res.status(400).json({ success: false, message: 'נא להזין כתובת אתר' });
        }

        // 1. שליפת תוכן ה-HTML של האתר
        const response = await axios.get(websiteUrl);
        const html = response.data;

        // 2. חילוץ טקסט נקי בעזרת Cheerio
        const $ = cheerio.load(html);
        
        // הסרת תגיות מיותרות כמו סקריפטים ועיצובים
        $('script, style, nav, footer').remove();
        
        // איסוף כל הטקסט מתוך גוף האתר
        const scrapedText = $('body').text().replace(/\s+/g, ' ').trim();

        // 3. שמירה במסד הנתונים
        const newBot = new Bot({
            userId: userId || null,
            websiteUrl,
            scrapedContent: scrapedText.substring(0, 5000), // שומרים את עיקר הטקסט
            instructions: instructions || ''
        });

        await newBot.save();

        res.status(201).json({
            success: true,
            message: 'הבוט נוצר בהצלחה!',
            botId: newBot._id,
            botUrl: `/chat.html?botId=${newBot._id}`
        });

    } catch (error) {
        console.error('Scraping error:', error.message);
        res.status(500).json({ success: false, message: 'שגיאה בסריקת האתר או ביצירת הבוט' });
    }
});

module.exports = router;