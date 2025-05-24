const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// For webhook verification
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = 'fusebot_token'; // You can change this but use the same in Meta config

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// For incoming messages
app.post('/webhook', (req, res) => {
  console.log('🔔 Received a webhook event:');
  console.dir(req.body, { depth: null });
  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`🚀 Fusebot webhook running on port ${port}`);
});
