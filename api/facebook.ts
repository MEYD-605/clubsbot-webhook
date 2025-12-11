import type { VercelRequest, VercelResponse } from '@vercel/node';

const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'clubslab_verify_2024';
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN || '';

async function sendMessage(recipientId: string, text: string) {
    await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${FB_PAGE_ACCESS_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text }
        })
    });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // GET = webhook verification
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe' && token === FB_VERIFY_TOKEN) {
            console.log('✅ Facebook webhook verified');
            return res.status(200).send(challenge);
        }
        return res.status(403).send('Forbidden');
    }

    // POST = webhook event
    if (req.method === 'POST') {
        const body = req.body;

        if (body.object === 'page') {
            for (const entry of body.entry || []) {
                for (const event of entry.messaging || []) {
                    if (event.message && event.message.text) {
                        const senderId = event.sender.id;
                        const text = event.message.text;

                        console.log(`📨 FB Message from ${senderId}: ${text}`);

                        // Simple response
                        await sendMessage(senderId, `ได้รับข้อความ: "${text}"\n\nติดต่อ: 0800416403`);
                    }
                }
            }
        }

        return res.status(200).send('EVENT_RECEIVED');
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
