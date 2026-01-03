require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const port = process.env.PORT || 3000;

// ⚠️ VARIABLES DE ENTORNO (configura estos secrets en GitHub)
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

/* =========================
   VERIFICACIÓN DEL WEBHOOK
========================= */
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/* =========================
   RECEPCIÓN DE MENSAJES
========================= */
app.post('/webhook', async (req, res) => {
  try {
    console.log('Webhook recibido:');
    console.log(JSON.stringify(req.body, null, 2));

    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return res.sendStatus(200);
    }

    const message = messages[0];
    const from = message.from; // número del cliente
    let text = message.text?.body;

    if (text) text = text.toLowerCase();

    console.log('Mensaje de:', from, 'Texto:', text);

    // RESPUESTA AUTOMÁTICA
    let reply = 'Hola 👋 ¿En qué puedo ayudarte?\n\n1️⃣ Ventas\n2️⃣ Horarios\n3️⃣ Ubicación';

    if (text === '1' || (text && text.includes('venta'))) {
      reply = '🍎 Tenemos frutas y verduras frescas todos los días.\n¿Qué buscas hoy?';
    } else if (text === '2' || (text && text.includes('horario'))) {
      reply = '🕘 Abrimos de lunes a domingo de 8:00 am a 7:00 pm';
    } else if (text === '3' || (text && text.includes('ubicacion'))) {
      reply = '📍 Estamos en tu mercado local. ¿Quieres la ubicación por Google Maps?';
    } else if (!text) {
      reply = 'Gracias por tu mensaje. Actualmente solo puedo responder mensajes de texto.';
    }

    // ENVIAR RESPUESTA
    const url = `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: from,
      text: { body: reply }
    };
    const headers = {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    };

    await axios.post(url, payload, { headers });

    res.sendStatus(200);
  } catch (error) {
    console.error('Error al procesar webhook:', error.response?.data || error.message);
    res.sendStatus(500);
  }
});

app.listen(port, () => {
  console.log(`Servidor activo en puerto ${port}`);
});
