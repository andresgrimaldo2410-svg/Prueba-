const express = require('express');

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;

/* 🔐 VERIFICACIÓN DEL WEBHOOK (META) */
app.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const challenge = req.query['hub.challenge'];
  const token = req.query['hub.verify_token'];

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ WEBHOOK VERIFICADO');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

/* 📩 RECEPCIÓN DE EVENTOS (MENSAJES, ESTADOS) */
app.post('/', (req, res) => {
  console.log('📨 Evento recibido:');
  console.log(JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

/* 🚀 INICIAR SERVIDOR */
app.listen(port, () => {
  console.log(`🚀 Servidor escuchando en puerto ${port}`);
});
