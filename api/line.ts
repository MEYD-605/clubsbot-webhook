import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

// Verify LINE signature
function verifySignature(body: string, signature: string): boolean {
    if (!CHANNEL_SECRET) return true; // Skip if no secret
    const hash = crypto
        .createHmac('SHA256', CHANNEL_SECRET)
        .update(body)
        .digest('base64');
    return hash === signature;
}

// Reply to LINE
async function replyMessage(replyToken: string, text: string) {
    if (!CHANNEL_ACCESS_TOKEN) {
        console.error('No access token');
        return;
    }

    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
            replyToken,
            messages: [{ type: 'text', text }]
        })
    });

    console.log('Reply status:', response.status);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // GET = webhook verification
    if (req.method === 'GET') {
        return res.status(200).send('LINE Webhook Ready');
    }

    // POST = webhook event
    if (req.method === 'POST') {
        const events = req.body?.events || [];
        console.log(`📨 Received ${events.length} events`);

        for (const event of events) {
            console.log('Event type:', event.type);

            if (event.type === 'message' && event.message?.type === 'text') {
                const text = event.message.text;
                const replyToken = event.replyToken;

                console.log(`Message: ${text}`);

                // Simple responses
                let reply = '';
                if (text.includes('สวัสดี') || text.toLowerCase().includes('hello')) {
                    reply = 'สวัสดีครับ! 📸 Club S Photography พร้อมให้บริการ\n\nติดต่อ: 0800416403';
                } else if (text.includes('งาน') || text.includes('ตาราง') || text.includes('คิว')) {
                    reply = '📅 ตารางงาน:\n• 12 ธ.ค. - Aof Saravut\n• 16 ธ.ค. - ณัฐพล ทับทิมทอง\n• 19 ธ.ค. - Tanya V.\n• 22 ธ.ค. - Sudtida Jaykam\n\nติดต่อจอง: 0800416403';
                } else if (text.includes('ราคา') || text.includes('เท่าไหร่')) {
                    reply = '📸 ราคาถ่ายภาพ:\n• 1.30 ชม. - ฿1,500\n• 4 ชม. - ฿3,500\n• 8 ชม. - ฿5,500\n\nติดต่อ: 0800416403';
                } else {
                    reply = `ได้รับข้อความ: "${text}"\n\nติดต่อสอบถาม: 0800416403 📞`;
                }

                await replyMessage(replyToken, reply);
            }
        }

        return res.status(200).json({ success: true, events: events.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
