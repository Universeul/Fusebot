const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

app.use(express.json());

// For webhook verification
app.get('/webhook', (req, res) => {
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

// For incoming messages
app.post('/webhook', async (req, res) => {
  console.log('🔔 Received a webhook event:');
  console.dir(req.body, { depth: null });

  const entry = req.body.entry?.[0];
  const change = entry?.changes?.[0];
  const message = change?.value?.messages?.[0];
  const from = message?.from;
  const body = message?.text?.body;

  if (from && body) {
    try {
      await axios.post(
        `https://graph.facebook.com/v18.0/${change.value.metadata.phone_number_id}/messages`,
        {
          messaging_product: 'whatsapp',
          to: from,
          text: { body: `👋 Thanks for messaging Fuse Energy! You said: \"${body}\"` },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          },
        }
      );
      console.log('✅ Reply sent.');
    } catch (err) {
      console.error('❌ Error sending reply:', err.response?.data || err.message);
    }
  }

  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`🚀 Fusebot webhook running on port ${port}`);
});
