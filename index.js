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
const ARMADOR = "5520606276"; // Número del armador

// --------------------
// Funciones JSON
// --------------------
const readJSON = (file) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {};
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// Archivos de datos
const MEMORY_FILE = './data/historial.json';
const CLIENTES_FILE = './data/clientes.json';
const CATALOGO_FILE = './data/catalogo.json';
const COMBOS_FILE = './data/combos.json';

let memory = readJSON(MEMORY_FILE);

// Guardar memoria
const saveMemory = () => writeJSON(MEMORY_FILE, memory);

// --------------------
// Enviar mensaje
// --------------------
async function sendMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: 'whatsapp', to, text: { body: text } },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' } }
  );
}

// --------------------
// Botones interactivos
// --------------------
async function sendButtons(to, text, buttons) {
  await axios.post(
    `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
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
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' } }
  );
}

// --------------------
// Catálogo
// --------------------
function catalogoTexto() {
  const cat = readJSON(CATALOGO_FILE);
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
// Cotizar
// --------------------
function cotizar(texto) {
  const cat = readJSON(CATALOGO_FILE);
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

  // Combos automáticos
  const combos = readJSON(COMBOS_FILE);
  for (const combo of combos) {
    const comboKeys = combo.productos.map(p => p.toLowerCase().split(" ")[0]);
    if (comboKeys.every(k => texto.includes(k))) {
      detalle.push(`🎁 *COMBO SUGERIDO*: ${combo.nombre} → $${combo.precio}`);
      total += combo.precio;
    }
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

    // --- Mensaje inicial con botones ---
    if (text === 'hola' || memory[from].estado === 'inicio') {
      memory[from].estado = 'menu';
      saveMemory();
      await sendButtons(from, "👋 ¡Hola! Bienvenido a *Frutas y Verduras* 🍓🥦\n¿Qué quieres hacer hoy?", [
        { id: "ver_catalogo", title: "📋 Ver catálogo" },
        { id: "ordenar", title: "🛒 Ordenar" }
      ]);
      return res.sendStatus(200);
    }

    // --- Botón interactivo ---
    if (msg.type === "interactive" && msg.interactive.button_reply) {
      const id = msg.interactive.button_reply.id;

      if (id === "ver_catalogo") {
        await sendMessage(from, catalogoTexto());
        return res.sendStatus(200);
      }
      if (id === "ordenar") {
        await sendMessage(from, "🛒 Escribe tu pedido, por ejemplo: `2 kg tomate, 1 sandía`");
        return res.sendStatus(200);
      }
    }

    // --- Cotización ---
    const cot = cotizar(text);
    if (cot) {
      await sendMessage(
        from,
        `🧾 Cotización automática:\n\n${cot.detalle.join("\n")}\n\n💰 Total: $${cot.total}\n\nEscribe *confirmar* para confirmar tu pedido`
      );
      return res.sendStatus(200);
    }

    // --- Confirmación de pedido ---
    if (text.includes("confirmar")) {
      await sendMessage(from, "✅ Pedido confirmado 🎉");
      await sendMessage(ARMADOR, `🧺 NUEVO PEDIDO\nCliente: ${from}\n${JSON.stringify(memory[from].historial, null, 2)}`);
      return res.sendStatus(200);
    }

    // Mensaje por defecto
    await sendMessage(from, "😄 No entendí tu mensaje. Escribe *hola* para ver el menú.");

    res.sendStatus(200);
  } catch (err) {
    console.error(err.message);
    res.sendStatus(500);
  }
});

// --------------------
app.listen(PORT, () => console.log(`✅ Bot activo en puerto ${PORT}`));
