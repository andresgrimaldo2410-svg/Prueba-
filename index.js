require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;

// MEMORIA SIMPLE
const memory = {};

// CONTACTOS CLAVE
const ARMADOR = "5520606276";
const ACTUALIZADOR = "5645594185";

// CARGAR CATÁLOGO
function cargarCatalogo() {
  return JSON.parse(fs.readFileSync('./catalogo.json'));
}

// MENSAJES WHATSAPP
async function sendMessage(to, body) {
  await axios.post(
    `https://graph.facebook.com/v22.0/${PHONE_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      text: { body }
    },
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
}

// BOTONES
async function sendButtons(to, text, buttons) {
  await axios.post(
    `https://graph.facebook.com/v22.0/${PHONE_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text },
        action: {
          buttons: buttons.map(b => ({
            type: "reply",
            reply: { id: b.id, title: b.title }
          }))
        }
      }
    },
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
}

// LISTA DE PRECIOS
function generarCatalogoTexto() {
  const cat = cargarCatalogo();
  let txt = "📋 LISTA DE PRECIOS DEL DÍA\n\n";

  for (const catg in cat) {
    txt += `*${catg.toUpperCase()}*\n`;
    cat[catg].forEach(p => {
      if (p.disponible) {
        txt += `• ${p.nombre} — $${p.precio}/${p.unidad}\n`;
      }
    });
    txt += "\n";
  }

  txt += "⚠️ Inventario sujeto a disponibilidad\n";
  txt += "⏰ Horario: 8:00 AM a 6:30 PM";
  return txt;
}

// WEBHOOK VERIFICACIÓN
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// WEBHOOK MENSAJES
app.post('/webhook', async (req, res) => {
  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return res.sendStatus(200);

  const from = msg.from;
  const text = msg.text?.body?.toLowerCase();

  // BOTONES
  if (msg.type === "interactive") {
    const id = msg.interactive.button_reply.id;

    if (id === "ver_catalogo") {
      await sendMessage(from, generarCatalogoTexto());
      await sendButtons(from, "¿Qué deseas hacer ahora? 😄", [
        { id: "ordenar", title: "🛒 Ordenar ahora" }
      ]);
    }

    if (id === "ordenar") {
      memory[from] = { pedido: [] };
      await sendMessage(
        from,
        "🛒😋 Escribe tu pedido así:\nEj: tomate 2kg, cebolla 1kg"
      );
    }

    return res.sendStatus(200);
  }

  // BIENVENIDA
  if (!memory[from]) {
    await sendMessage(
      from,
      "👋😄 ¡Holaaaa!\nAquí vendemos frutas bien frescas 🍓🥑"
    );
    await sendButtons(from, "¿Qué te gustaría hacer?", [
      { id: "ver_catalogo", title: "📋 Ver catálogo" },
      { id: "ordenar", title: "🛒 Ordenar ahora" }
    ]);
    return res.sendStatus(200);
  }

  // GUARDAR PEDIDO
  memory[from].pedido.push(text);

  await sendButtons(from, "¿Confirmamos tu pedido? ✅", [
    { id: "confirmar", title: "✅ Confirmar pedido" }
  ]);

  // CONFIRMAR
  if (text?.includes("confirmar")) {
    await sendMessage(from, "💰 Forma de pago:\n• Efectivo\n• Transferencia");

    await sendMessage(
      ARMADOR,
      `🧺 NUEVO PEDIDO\nCliente: ${from}\nPedido:\n${memory[from].pedido.join("\n")}`
    );

    delete memory[from];
  }

  res.sendStatus(200);
});

// SERVER
app.listen(PORT, () => {
  console.log("🤖 Bot WhatsApp activo en puerto", PORT);
});
