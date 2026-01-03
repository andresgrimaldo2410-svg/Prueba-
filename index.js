const express = require('express');
const app = express();

app.use(express.json());

const port = process.env.PORT || 3000;
const verifyToken = 'prueba123';

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('MODE:', mode);
  console.log('TOKEN:', token);

  if (mode === 'subscribe' && token === verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', (req, res) => {
  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`Servidor en puerto ${port}`);
});
