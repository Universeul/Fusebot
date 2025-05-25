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

// In-memory store for user progress (for demo purposes only)
const userState = {};

app.post('/webhook', async (req, res) => {
  const entry = req.body.entry?.[0];
  const changes = entry?.changes?.[0];
  const message = changes?.value?.messages?.[0];

  if (message) {
    const from = message.from;
    const userText = message.text?.body?.trim();

    // Initialize user state
    if (!userState[from]) {
      userState[from] = { step: 0 };
    }

    const state = userState[from];
    let reply = '';

    switch (state.step) {
      case 0:
        reply = "Hi! I’m Fusebot — Fuse Energy’s official WhatsApp onboarding assistant 💡🔌\nI’ll guide you step by step to get your switch started. This will only take a minute!\n\nTo begin, what’s your email address?";
        state.step++;
        break;

      case 1:
        state.email = userText;
        reply = "Great! Now please provide your supply number or full address.\n\nYour supply number is a 13-digit number that usually appears on your bill or meter certificate like this:\nS 1 801 902 **1200051437974**";
        state.step++;
        break;

      case 2:
        state.addressOrSupply = userText;
        // TODO: Validate using Royal Mail or ECOES API
        reply = "Thanks! What’s your desired switch date (in DD/MM/YYYY format)?";
        state.step++;
        break;

      case 3:
        state.switchDate = userText;
        reply = "Thanks. Now let me show you our latest tariffs...";

        try {
          const postcode = extractPostcode(state.addressOrSupply);
          const tariffs = await getTariffsFromFuse(postcode);
          reply += `\n\nAvailable tariffs:\n`;
          tariffs.forEach((t, i) => {
            reply += `\n${i + 1}. ${t.name} - ${t.rate}`;
          });
          reply += "\n\nPlease reply with the number of your preferred tariff.";
          state.tariffs = tariffs;
          state.step++;
        } catch (error) {
          reply += "\n(Sorry, I couldn’t retrieve tariffs for that postcode.)";
        }
        break;

      case 4:
        const chosenIndex = parseInt(userText) - 1;
        const chosenTariff = state.tariffs?.[chosenIndex];
        if (chosenTariff) {
          state.tariff = chosenTariff;
          reply = `Awesome, you’ve selected: ${chosenTariff.name}.\nTo complete your switch, please follow this link to set up your Direct Debit: https://www.fuseenergy.com/direct-debit`;  
          state.step++;
        } else {
          reply = "Please enter a valid number from the list of tariffs above.";
        }
        break;

      default:
        reply = "This bot is only for onboarding! If you have questions, please chat with us via our website: https://www.fuseenergy.com 🌐";
        break;
    }

    await sendWhatsAppMessage(from, reply);
  }

  res.sendStatus(200);
});

// Verification endpoint
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

// Helper: send message
async function sendWhatsAppMessage(to, body) {
  await axios.post(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      text: { body }
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
}

// Helper: dummy postcode extractor
function extractPostcode(text) {
  const match = text.match(/([A-Z]{1,2}\d{1,2}[A-Z]?) ?(\d[A-Z]{2})/i);
  return match ? match[0].toUpperCase() : 'SW1A 1AA';
}

// Helper: dummy Fuse tariff API (simulate fetch)
async function getTariffsFromFuse(postcode) {
  // Replace this with real fetch from Fuse site or backend
  return [
    { name: 'Green Variable', rate: '29.5p/kWh' },
    { name: 'Fix & Go 12M', rate: '28.8p/kWh' },
    { name: 'Flexible Tracker', rate: '27.9p/kWh' }
  ];
}
