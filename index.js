import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(bodyParser.json());

const token = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const verifyToken = process.env.VERIFY_TOKEN;  // ✅ Use this instead of META_VERIFY_TOKEN

// Webhook endpoint to receive messages from WhatsApp
app.post('/webhook', async (req, res) => {
  const entry = req.body.entry?.[0];
  const changes = entry?.changes?.[0];
  const message = changes?.value?.messages?.[0];

  if (message) {
    const from = message.from;
    const userText = message.text?.body?.toLowerCase();

    let reply = "Hi! Welcome to Fuse Energy. To get started, what's your address?";

    if (userText.includes("address")) {
      reply = "Thanks! What’s your desired supply start date (SSD)?";
    } else if (userText.includes("ssd")) {
      reply = "Perfect. Lastly, please follow this link to set up your Direct Debit: [Insert OpenBanking link].";
    }

    try {
      await axios.post(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: from,
          text: { body: reply }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      console.error("❌ Error sending message:", error.response?.data || error.message);
    }
  }

  res.sendStatus(200);
});

// Webhook verification with Meta
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.listen(10000, () => {
  console.log('🚀 Fusebot webhook running on port 10000');
});
