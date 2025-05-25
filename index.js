const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Webhook verification
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = 'fusebot_token'; // Make sure this matches the token on Meta

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ WEBHOOK_VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Message receiver + responder
app.post('/webhook', async (req, res) => {
  console.log('🔔 Received a webhook event:');
  console.dir(req.body, { depth: null });

  const entry = req.body.entry?.[0];
  const changes = entry?.changes?.[0];
  const message = changes?.value?.messages?.[0];
  const phoneNumberId = changes?.value?.metadata?.phone_number_id;
  const from = message?.from;
  const text = message?.text?.body;

  if (text && from) {
    try {
      await axios.post(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: from,
          text: { body: `Hi ${text}, welcome to Fuse Energy! ⚡️` }
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (err) {
      console.error('❌ Error sending message:', err.response?.data || err.message);
    }
  }

  res.sendStatus(200);
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Fusebot webhook running on port ${port}`);
});
