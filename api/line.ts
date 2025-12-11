import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const BACKEND_URL = process.env.BACKEND_URL || 'http://192.168.1.200:8088';

// Verify LINE signature
function verifySignature(body: string, signature: string): boolean {
    const hash = crypto
        .createHmac('SHA256', CHANNEL_SECRET)
        .update(body)
        .digest('base64');
    return hash === signature;
}

// Forward to backend
async function forwardToBackend(events: any[]) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/line-events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events })
        });
        return await response.json();
    } catch (err) {
        console.error('Backend error:', err);
        return null;
    }
}

// Reply to LINE
async function replyMessage(replyToken: string, text: string) {
    await fetch('https://api.line.me/v2/bot/message/reply', {
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
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // GET = webhook verification
    if (req.method === 'GET') {
        return res.status(200).send('LINE Webhook Ready');
    }

    // POST = webhook event
    if (req.method === 'POST') {
        const signature = req.headers['x-line-signature'] as string;
        const body = JSON.stringify(req.body);

        if (!verifySignature(body, signature)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const events = req.body.events || [];
        console.log(`📨 Received ${events.length} events`);

        for (const event of events) {
            if (event.type === 'message' && event.message.type === 'text') {
                const text = event.message.text;
                const replyToken = event.replyToken;

                // Simple responses
                if (text.includes('สวัสดี') || text.includes('hello')) {
                    await replyMessage(replyToken, 'สวัสดีครับ! 📸 Club S Photography พร้อมให้บริการ');
                } else if (text.includes('งาน') || text.includes('ตาราง')) {
                    await replyMessage(replyToken, '📅 กำลังดึงข้อมูลตารางงาน...\n\nติดต่อ: 0800416403');
                } else {
                    await replyMessage(replyToken, `ได้รับข้อความ: "${text}"\n\nติดต่อสอบถาม: 0800416403`);
                }

                // Forward to backend for processing
                await forwardToBackend([event]);
            }
        }

        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
