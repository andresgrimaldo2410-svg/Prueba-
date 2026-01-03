const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const port = process.env.PORT || 3000;

// ⚠️ DATOS DE WHATSAPP (LUEGO LOS PONEMOS EN ENTORNO)
const VERIFY_TOKEN = 'prueba123';
const WHATSAPP_TOKEN = 'EAAKckbKJ0t8BQY2ORfO08Vm5RykOnuDzLFBPZBrI0SLUlJOFODXEkWr6UrwdJ3kLZBNZAztvZCeBcmdMbdTuOLlVNQnyPZAKlcWZCYH3eG8bFF35oAB5znZC7WmucVYAuRbDThsSgg4jZCpKwO1hLPM4oeIwyCIjpj46eWw7Bcfe6DETh0PeTLDg40TUINSDYgZDZD';
const PHONE_NUMBER_ID = '1373777010808264';

/* =========================
   VERIFICACIÓN DEL WEBHOOK
========================= */
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/* =========================
   RECEPCIÓN DE MENSAJES
========================= */
app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const from = message.from; // número del cliente
    const text = message.text?.body?.toLowerCase();

    console.log('Mensaje recibido:', text);

    // RESPUESTA AUTOMÁTICA
    let reply = 'Hola 👋 ¿En qué puedo ayudarte?\n\n1️⃣ Ventas\n2️⃣ Horarios\n3️⃣ Ubicación';

    if (text === '1' || text?.includes('venta')) {
      reply = '🍎 Tenemos frutas y verduras frescas todos los días.\n¿Qué buscas hoy?';
    }

    if (text === '2' || text?.includes('horario')) {
      reply = '🕘 Abrimos de lunes a domingo de 8:00 am a 7:00 pm';
    }

    if (text === '3' || text?.includes('ubicacion')) {
      reply = '📍 Estamos en tu mercado local. ¿Quieres la ubicación por Google Maps?';
    }

    // ENVIAR RESPUESTA
    await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: from,
        text: { body: reply }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.sendStatus(200);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.sendStatus(200);
  }
});

app.listen(port, () => {
  console.log(`Servidor activo en puerto ${port}`);
});
