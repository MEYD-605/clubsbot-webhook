import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
// Backend API on LXC - accessible via Tailscale
const BACKEND_URL = process.env.BACKEND_URL || 'http://100.73.101.15:8088';

// Verify LINE signature
function verifySignature(body: string, signature: string): boolean {
    if (!CHANNEL_SECRET) return true;
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

// Forward to backend for AI processing
async function forwardToBackend(events: any[]): Promise<string | null> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events })
        });

        if (response.ok) {
            const data = await response.json();
            return data.reply || null;
        }
        return null;
    } catch (error) {
        console.error('Backend error:', error);
        return null;
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // GET = webhook verification
    if (req.method === 'GET') {
        return res.status(200).send('LINE Webhook Ready - AI Chatbot');
    }

    // POST = webhook event
    if (req.method === 'POST') {
        const events = req.body?.events || [];
        console.log(`📨 Received ${events.length} events`);

        for (const event of events) {
            if (event.type === 'message' && event.message?.type === 'text') {
                const text = event.message.text;
                const replyToken = event.replyToken;

                console.log(`Message: ${text}`);

                // Try backend AI first
                const backendReply = await forwardToBackend([event]);

                if (backendReply) {
                    await replyMessage(replyToken, backendReply);
                } else {
                    // Fallback: simple response - NO PHONE SPAM
                    let reply = '';
                    const lowerText = text.toLowerCase();

                    if (lowerText.includes('no1')) {
                        reply = '📅 *โหมดงาน*\n\nกำลังเช็คข้อมูล...';
                    } else if (text.includes('สวัสดี') || lowerText.includes('hello')) {
                        reply = 'สวัสดีค่ะ! Club S Photography ยินดีให้บริการ 📸';
                    } else if (text.includes('ราคา') || lowerText.includes('price')) {
                        reply = '📸 *ราคาถ่ายภาพ*\n\n• 1.5 ชม. = ฿1,500\n• 4 ชม. = ฿3,500\n• 8 ชม. = ฿5,500';
                    } else if (text.includes('งาน') || text.includes('จอง') || text.includes('ว่าง')) {
                        reply = 'สนใจจองคิวถ่ายภาพ สามารถแจ้งวันที่และประเภทงานได้เลยค่ะ';
                    } else {
                        reply = 'รอสักครู่นะคะ กำลังเช็คข้อมูลให้';
                    }

                    await replyMessage(replyToken, reply);
                }
            }
        }

        return res.status(200).json({ success: true, events: events.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
