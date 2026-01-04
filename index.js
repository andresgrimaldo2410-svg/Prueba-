require("dotenv").config();
const express = require("express");
const axios = require("axios");
const fs = require("fs");
const OpenAI = require("openai");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// CONTACTOS
const ARMADOR = "5520606276";
const ACTUALIZADOR = "5645594185";

// MEMORIA RAM
const memory = {};

// ARCHIVOS
const CATALOGO = "./data/catalogo.json";
const HISTORIAL = "./data/historial.json";
const CLIENTES = "./data/clientes.json";
const COMBOS = "./data/combos.json";

// UTILIDADES
const readJSON = f => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : {});
const writeJSON = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

// WHATSAPP
async function sendMessage(to, body) {
  await axios.post(
    `https://graph.facebook.com/v22.0/${PHONE_ID}/messages`,
    { messaging_product: "whatsapp", to, text: { body } },
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
}

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

// CATALOGO TEXTO
function catalogoTexto() {
  const c = readJSON(CATALOGO);
  let t = "📋 LISTA DE PRECIOS DEL DÍA\n\n";
  for (const cat in c) {
    t += `*${cat.toUpperCase()}*\n`;
    c[cat].forEach(p => {
      if (p.disponible) t += `• ${p.nombre} — $${p.precio}/${p.unidad}\n`;
    });
    t += "\n";
  }
  t += "⚠️ Inventario sujeto a disponibilidad\n⏰ 8:00 AM a 6:30 PM";
  return t;
}

// IA COTIZACIÓN
function cotizarIA(texto) {
  const cat = readJSON(CATALOGO);
  let detalle = [];
  let total = 0;

  for (const c in cat) {
    cat[c].forEach(p => {
      if (!p.disponible) return;
      const key = p.nombre.toLowerCase().split(" ")[0];
      if (texto.includes(key)) {
        const n = texto.match(/(\d+(\.\d+)?)/);
        const qty = n ? parseFloat(n[1]) : 1;
        const sub = qty * p.precio;
        total += sub;
        detalle.push(`• ${p.nombre} ${qty} ${p.unidad} → $${sub}`);
      }
    });
  }
  return detalle.length ? { detalle, total } : null;
}

// IA COMBOS
function sugerirCombos(texto, cliente) {
  const combos = readJSON(COMBOS);
  const clientes = readJSON(CLIENTES);
  let s = new Set();

  for (const p in combos)
    if (texto.includes(p)) combos[p].forEach(x => s.add(x));

  if (clientes[cliente]?.favoritos)
    Object.keys(clientes[cliente].favoritos).slice(0, 2).forEach(x => s.add(x));

  return [...s].slice(0, 4);
}

// WEBHOOK VERIFY
app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) return res.send(req.query["hub.challenge"]);
  res.sendStatus(403);
});

// WEBHOOK MENSAJES
app.post("/webhook", async (req, res) => {
  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return res.sendStatus(200);
  const from = msg.from;

  // BOTONES
  if (msg.type === "interactive") {
    const id = msg.interactive.button_reply.id;

    if (id === "ver_catalogo") {
      await sendMessage(from, catalogoTexto());
      await sendButtons(from, "¿Qué deseas hacer? 😄", [
        { id: "ordenar", title: "🛒 Ordenar ahora" }
      ]);
    }

    if (id === "ordenar") {
      memory[from] = {};
      await sendMessage(from, "🛒😋 Escríbenos tu pedido libremente");
    }

    if (id.startsWith("add_")) {
      const prod = id.replace("add_", "");
      memory[from].extra = prod;
      await sendMessage(from, `✅ Agregado: ${prod}`);
    }

    return res.sendStatus(200);
  }

  // BIENVENIDA
  if (!memory[from]) {
    await sendMessage(
      from,
      "👋😄 ¡Holaaa! Bienvenido a tu frutería de confianza 🍓🥬"
    );
    await sendButtons(from, "¿Qué te gustaría hacer?", [
      { id: "ver_catalogo", title: "📋 Ver catálogo" },
      { id: "ordenar", title: "🛒 Ordenar ahora" }
    ]);
    return res.sendStatus(200);
  }

  // TEXTO → IA
  const texto = msg.text?.body?.toLowerCase();
  const cot = cotizarIA(texto);

  if (cot) {
    memory[from].cot = cot;

    await sendMessage(
      from,
`🧠🧾 Cotización automática

${cot.detalle.join("\n")}

💰 Total: $${cot.total}`
    );

    const sug = sugerirCombos(texto, from);
    if (sug.length)
      await sendButtons(
        from,
        "💡 ¿Te agrego algo más?",
        sug.map(s => ({ id: `add_${s}`, title: `➕ ${s}` }))
      );
  }

  // CONFIRMACIÓN
  if (texto?.includes("confirmar")) {
    const hist = readJSON(HISTORIAL);
    const cli = readJSON(CLIENTES);

    hist[from] = hist[from] || [];
    hist[from].push({ fecha: new Date(), pedido: memory[from].cot });
    writeJSON(HISTORIAL, hist);

    cli[from] = cli[from] || { pedidos: 0, favoritos: {} };
    cli[from].pedidos++;
    memory[from].cot.detalle.forEach(i => {
      const n = i.split(" ")[1];
      cli[from].favoritos[n] = (cli[from].favoritos[n] || 0) + 1;
    });
    writeJSON(CLIENTES, cli);

    await sendMessage(from, "✅ Pedido confirmado 🎉");
    await sendMessage(
      ARMADOR,
      `🧺 NUEVO PEDIDO\nCliente: ${from}\n${memory[from].cot.detalle.join("\n")}\n💰 $${memory[from].cot.total}`
    );

    delete memory[from];
  }

  res.sendStatus(200);
});

app.listen(PORT, () =>
  console.log("🤖 Bot WhatsApp IA activo en puerto", PORT)
);
