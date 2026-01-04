require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// ===============================
// Memoria simple por cliente
// ===============================
const memoryFile = './memory.json';
let memory = fs.existsSync(memoryFile)
  ? JSON.parse(fs.readFileSync(memoryFile))
  : {};

const saveMemory = () =>
  fs.writeFileSync(memoryFile, JSON.stringify(memory, null, 2));

// ===============================
// Webhook verificación
// ===============================
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ===============================
// Webhook mensajes
// ===============================
app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text = message.text?.body?.toLowerCase() || '';

    if (!memory[from]) {
      memory[from] = { historial: [], estado: 'inicio' };
    }

    memory[from].historial.push(text);
    saveMemory();

    let reply = `👋 ¡Hola! Bienvenido a *Frutas y Verduras* 🍓🥦  
¿Qué te gustaría hacer hoy?

🛒 Ver catálogo  
🧾 Hacer pedido  
💳 Formas de pago`;

    if (text.includes('catálogo')) {
      reply = `📦 *CATÁLOGO GENERAL*  
Tenemos frutas, verduras, chiles, extras y más 🥭🥕🌶️  
Escribe el producto y la cantidad que deseas 😉`;
    }

    if (text.includes('pago')) {
      reply = `💳 *FORMAS DE PAGO*  
✔️ Efectivo  
✔️ Transferencia  
(No es obligatorio pagar antes)`;
    }

    if (text.includes('pedido')) {
      reply = `🧾 Perfecto 🙌  
Escríbeme tu pedido así:  
👉 *2 kg de jitomate, 1 sandía*  
Cuando confirmes, avisamos al armador 🧑‍🍳`;
    }

    if (text.includes('ubicación')) {
      reply = `📍 Cuando gustes, envíanos tu *ubicación de Google Maps*  
(esto solo es para la entrega 🚚)`;
    }

    await axios.post(
      `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
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
  } catch (err) {
    console.error(err.message);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`✅ Bot activo en puerto ${PORT}`);
});
