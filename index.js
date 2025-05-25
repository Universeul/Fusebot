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

const userState = {};
const userData = {};

const sendWhatsAppMessage = async (to, message) => {
  await axios.post(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      text: { body: message },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
};

app.post('/webhook', async (req, res) => {
  const entry = req.body.entry?.[0];
  const changes = entry?.changes?.[0];
  const message = changes?.value?.messages?.[0];

  if (message) {
    const from = message.from;
    const userText = message.text?.body?.trim();

    if (!userState[from]) {
      userState[from] = 'ask_email';
      userData[from] = {};

      await sendWhatsAppMessage(from, `Hi! I’m Fusebot — Fuse Energy’s official WhatsApp onboarding assistant 💡🔌\nI’ll guide you step by step to get your switch started. This will only take a minute!\n\nTo begin, what’s your email address?`);
      return res.sendStatus(200);
    }

    const state = userState[from];

    if (state === 'ask_email') {
      userData[from].email = userText;
      userState[from] = 'ask_supply';

      await sendWhatsAppMessage(from, "Great! Now please provide your supply number or full address.");

      setTimeout(async () => {
        await sendWhatsAppMessage(from, `\
\`\`\`
Your supply number is a 13-digit number found on your bill or meter certificate.
It’s usually displayed like this:

  Supply number
  ┌──┬────┬────┐
  │S │801 │902 │
  └──┴────┴────┘
         1200051437974
\`\`\``);
      }, 1500);

      setTimeout(async () => {
        await sendWhatsAppMessage(from, "Thanks! What’s your desired switch date (in DD/MM/YYYY format)?");
      }, 4000);

    } else if (state === 'ask_supply') {
      userData[from].address = userText;
      userState[from] = 'ask_ssd';
    } else if (state === 'ask_ssd') {
      userData[from].ssd = userText;
      userState[from] = 'ask_tariff';

      await sendWhatsAppMessage(from, `Got it! Based on your postcode, here are our current tariffs:`);
      // Placeholder: insert real tariff menu from Fuse Energy site later
      await sendWhatsAppMessage(from, `1. Simple Variable\n2. Green Fixed\n3. EV Saver\n\nPlease reply with the number of your preferred tariff.`);

    } else if (state === 'ask_tariff') {
      userData[from].tariff = userText;
      userState[from] = 'done';

      await sendWhatsAppMessage(from, `Awesome! 🎉 One last step — please follow this link to set up your Direct Debit: https://fuse.energy/direct-debit`);
      await sendWhatsAppMessage(from, `PS: I’m just a bot 🤖 here to onboard you. If you have questions, speak to a human on our website: https://fuse.energy 💬`);
    }
  }

  res.sendStatus(200);
});

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
