import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(bodyParser.json());

const token = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const verifyToken = process.env.VERIFY_TOKEN;

const sessions = {}; // Temporary session store in memory

app.post('/webhook', async (req, res) => {
  const entry = req.body.entry?.[0];
  const changes = entry?.changes?.[0];
  const message = changes?.value?.messages?.[0];

  if (message) {
    const from = message.from;
    const userText = message.text?.body?.toLowerCase();

    // Create session if it doesn't exist
    if (!sessions[from]) {
      sessions[from] = { step: 0 };
    }

    let reply = '';
    const step = sessions[from].step;

    switch (step) {
      case 0:
        reply = "👋 Hi, I'm the WhatsApp Fusebot! Let's get you onboarded!";
        sessions[from].step++;
        break;
      case 1:
        reply = "📧 What's your email address?";
        sessions[from].step++;
        break;
      case 2:
        sessions[from].email = userText;
        reply = "🏡 Great, now please enter your full address or your supply number.";
        sessions[from].step++;
        break;
      case 3:
        sessions[from].address = userText;
        // You can hook in address verification here (e.g., Royal Mail PAF API)
        reply = "📅 Awesome. When would you like your supply to start?";
        sessions[from].step++;
        break;
      case 4:
        sessions[from].switchDate = userText;
        reply = "⚡️ Please choose a tariff:\n1. Fixed Saver\n2. Flexible Green\n3. Smart Tracker\n\nReply with the number.";
        sessions[from].step++;
        break;
      case 5:
        if (['1', '2', '3'].includes(userText.trim())) {
          const tariffMap = {
            '1': 'Fixed Saver',
            '2': 'Flexible Green',
            '3': 'Smart Tracker'
          };
          sessions[from].tariff = tariffMap[userText.trim()];
          reply = `✅ You've selected ${sessions[from].tariff}.\nPlease follow this link to set up your Direct Debit: https://fuse.energy/direct-debit`;
          sessions[from].step++;
        } else {
          reply = "❌ Please choose a valid option (1, 2, or 3).";
        }
        break;
      default:
        reply = "🤖 This is just an onboarding bot! If you have specific questions, head over to our live chat on our website: https://fuse.energy";
    }

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
  }

  res.sendStatus(200);
});

// Meta webhook verification
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
