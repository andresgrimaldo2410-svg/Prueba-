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

const ARMADOR = "5520606276";

// --------------------
// Memoria de clientes
// --------------------
const memoryFile = './data/memory.json';
let memory = fs.existsSync(memoryFile) ? JSON.parse(fs.readFileSync(memoryFile)) : {};
const saveMemory = () => fs.writeFileSync(memoryFile, JSON.stringify(memory, null, 2));

// --------------------
// Funciones de WhatsApp
// --------------------
async function sendMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: 'whatsapp', to, text: { body: text } },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' } }
  );
}

// --------------------
// Catálogo
// --------------------
function catalogoTexto() {
  const cat = JSON.parse(fs.readFileSync('./data/catalogo.json'));
  let t = "📋 *CATÁLOGO DE PRODUCTOS*\n\n";
  for (const c in cat) {
    t += `*${c.toUpperCase()}*\n`;
    cat[c].forEach(p => {
      if (p.disponible) t += `• ${p.nombre} — $${p.precio}/${p.unidad}\n`;
    });
    t += "\n";
  }
  return t;
}

// --------------------
// Cotización simple
// --------------------
function cotizar(texto) {
  const cat = JSON.parse(fs.readFileSync('./data/catalogo.json'));
  let detalle = [];
  let total = 0;
  for (const c in cat) {
    cat[c].forEach(p => {
      if (!p.disponible) return;
      const key = p.nombre.toLowerCase().split(" ")[0];
      if (texto.includes(key)) {
        const m = texto.match(/(\d+(\.\d+)?)/);
        const q = m ? parseFloat(m[1]) : 1;
        const sub = q * p.precio;
        total += sub;
        detalle.push(`• ${p.nombre} ${q} ${p.unidad} → $${sub}`);
      }
    });
  }
  if (!detalle.length) return null;
  return { detalle, total };
}

// --------------------
// Webhook verify
// --------------------
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  res.sendStatus(403);
});

// --------------------
// Webhook mensajes
// --------------------
app.post('/webhook', async (req, res) => {
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    const text = msg.text?.body?.toLowerCase() || '';

    if (!memory[from]) memory[from] = { historial: [], estado: 'inicio' };
    memory[from].historial.push(text);
    saveMemory();

    let reply = `👋 ¡Hola! Bienvenido a *Frutas y Verduras* 🍓🥦  
¿Qué te gustaría hacer hoy?

🛒 Ver catálogo  
🧾 Hacer pedido  
💳 Formas de pago`;

    if (text.includes('catálogo')) reply = catalogoTexto();
    if (text.includes('pedido')) reply = `🧾 Perfecto 🙌  
Escríbeme tu pedido (ej: 2 kg de jitomate, 1 sandía)`;
    if (text.includes('pago')) reply = `💳 Formas de pago:  
✔️ Efectivo  
✔️ Transferencia  
(No obligatorio pagar antes)`;
    if (text.includes('ubicación')) reply = `📍 Cuando gustes, envíanos tu *ubicación de Google Maps* para la entrega 🚚`;

    const cot = cotizar(text);
    if (cot) {
      reply = `🧾 Cotización automática:\n\n${cot.detalle.join("\n")}\n\n💰 Total: $${cot.total}\n\nEscribe *confirmar* para confirmar tu pedido`;
    }

    if (text.includes('confirmar')) {
      await sendMessage(from, "✅ Pedido confirmado 🎉");
      await sendMessage(ARMADOR, `🧺 NUEVO PEDIDO\nCliente: ${from}\n${JSON.stringify(memory[from].historial, null, 2)}`);
    }

    await sendMessage(from, reply);
    res.sendStatus(200);
  } catch (err) {
    console.error(err.message);
    res.sendStatus(500);
  }
});

// --------------------
app.listen(PORT, () => console.log(`✅ Bot activo en puerto ${PORT}`));
