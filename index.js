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

const userState = new Map();

const sendMessage = async (to, text) => {
  await axios.post(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      text: { body: text },
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
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (message) {
    const from = message.from;
    const msgType = message.type;
    const userText = message.text?.body?.trim();
    const state = userState.get(from) || { step: 'intro' };

    console.log(`🔔 Incoming message from ${from}:`, message);
    console.log(`📦 Current user state:`, state);

    // Handle contact-based referrals
    if (message.type === 'contacts' && message.contacts?.[0]) {
      const contact = message.contacts[0];
      const contactName = contact.name?.formatted_name || contact.name?.first_name || 'your friend';
      const contactNumberRaw = contact.phones?.[0]?.phone_number || contact.phones?.[0]?.wa_id;

      if (!contactNumberRaw) {
        await sendMessage(from, `Hmm, I couldn’t find a number in the contact you sent. Try again?`);
        return res.sendStatus(200);
      }

      const contactNumber = contactNumberRaw.replace(/[^\d]/g, ''); // clean non-digit characters

      try {
        await sendMessage(contactNumber, 
          `👋 Hey ${contactName}! Your friend just referred you to Fuse Energy.\n\nSwitching to Fuse is easy — cheap, 100% green, and fully app-based ⚡\nLet’s get you onboarded! Just reply “Hi” to begin.`
        );
        await sendMessage(from, `✅ I've reached out to ${contactName} and invited them to join Fuse Energy!`);
      } catch (err) {
        console.error(`❌ Failed to message referred contact:`, err?.response?.data || err.message);
        await sendMessage(from, `⚠️ Sorry, I couldn’t message your friend. Make sure their number is on WhatsApp.`);
      }

      return res.sendStatus(200); // return early to avoid triggering other logic
    }


    // Regular onboarding flow
    if (state.step === 'intro') {
      await sendMessage(from, `Hi! I’m Fusebot — Fuse Energy’s official WhatsApp onboarding assistant 💡🔌\nI’ll guide you step by step to get your switch started. This will only take a minute!\n\nTo begin, what’s your email address?`);
      userState.set(from, { step: 'email' });
    } else if (state.step === 'email') {
      state.email = userText;
      await sendMessage(from, `Great! Now please provide your supply number or full address.`);
      await sendMessage(from, `\nYour supply number is a 13-digit number that usually appears on your bill or meter certificate. It looks like this:\n\nSupply number:\nS | 1 | 801 | 902\n              1200051437974`);
      userState.set(from, { ...state, step: 'supply' });
    } else if (state.step === 'supply') {
      state.supply = userText;
      await sendMessage(from, `Thanks! What’s your desired switch date (in DD/MM/YYYY format)?`);
      userState.set(from, { ...state, step: 'ssd' });
    } else if (state.step === 'ssd') {
      state.ssd = userText;
      await sendMessage(from, `Almost there! Please select your tariff from the options below:\n\n` +
        `1️⃣ Single Rate Variable\n£0.2489/kWh · 43.49p/day · Ideal for average use homes ⚡️\n\n` +
        `2️⃣ Off-Peak Variable\nPeak: £0.3161 · Off-Peak: £0.1379 · Great for EVs and night use 🌙\nPeak: 8:30am–1:30am · Off-Peak: 1:30am–8:30am\n\n` +
        `3️⃣ 12M Fixed Single Rate\n£0.2195/kWh · 41.95p/day · £50 exit fee · Locked for 12 months 🔒\n\n` +
        `4️⃣ 18M Fixed Single Rate\n£0.2167/kWh · 37.51p/day · £50 exit fee · Locked for 18 months 🔒\n\n` +
        `5️⃣ 12M Fixed Off-Peak\nPeak: £0.2841 · Off-Peak: £0.1357 · £50 exit fee · Fixed 12m 🌙\n\n` +
        `6️⃣ 18M Fixed Off-Peak\nPeak: £0.2796 · Off-Peak: £0.1314 · £50 exit fee · Fixed 18m 🌙\n\n` +
        `7️⃣ Smart EV\nSmart: £0.0500 · Base: £0.2678 · Best for EV savings 🚗\nSmart hours: 5 hrs between 9pm–7am`);
      userState.set(from, { ...state, step: 'tariff' });
    } else if (state.step === 'tariff') {
      state.tariff = userText;
      await sendMessage(from, `Perfect. Please follow this link to set up your Direct Debit:\nhttps://fuseenergy.com/direct-debit-setup`);
      await sendMessage(from, `⚠️ Just a heads up: I'm just an onboarding bot! For any specific queries, please chat with our team here: https://www.fuseenergy.com/`);
      userState.set(from, { ...state, step: 'done' });

      console.log(`✅ Final collected onboarding data for ${from}:`);
      console.log({
        email: state.email,
        supply: state.supply,
        ssd: state.ssd,
        tariff: state.tariff,
      });
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
