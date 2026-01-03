const express = require('express');
const app = express();

app.use(express.json());

const port = process.env.PORT || 3000;

// TOKEN FIJO (temporal)
const verifyToken = 'prueba123';

/* VERIFICACIÓN DEL WEBHOOK */
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK VERIFICADO');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

/* RECEPCIÓN DE EVENTOS */
app.post('/webhook', (req, res) => {
  console.log('Evento recibido:', JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`Servidor escuchando en puerto ${port}`);
});
