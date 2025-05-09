import express from 'express';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

const ORIGINAL_PATH = path.join(process.cwd(), 'jugadores.txt');
const JUGADORES_PATH = '/tmp/jugadores.txt';
const RANKING_ANUAL_PATH = path.join(process.cwd(), 'rankinganual.txt');
const REGLAMENTO_PATH = path.join(process.cwd(), 'reglamento.txt');

const puntos_posicion = [10, 8, 6, 4, 2];
const puntos_default = 1;

// Copia inicial del archivo jugadores.txt a /tmp
fs.copyFile(ORIGINAL_PATH, JUGADORES_PATH).catch(() => {});

app.use('/static', express.static('static'));
app.use(express.urlencoded({ extended: true }));

async function leerJugadores() {
  try {
    const data = await fs.readFile(JUGADORES_PATH, 'utf8');
    return data.split('\n').map(x => x.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

async function escribirJugador(nombre) {
  try {
    const jugadores = await leerJugadores();
    if (!jugadores.includes(nombre)) {
      await fs.appendFile(JUGADORES_PATH, `${nombre}\n`);
    }
  } catch (err) {
    console.error('Error al escribir jugador:', err);
  }
}

async function leerRankingAnual() {
  try {
    const data = await fs.readFile(RANKING_ANUAL_PATH, 'utf8');
    return data.split('\n').map(x => x.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

async function leerReglamento() {
  try {
    const data = await fs.readFile(REGLAMENTO_PATH, 'utf8');
    return data.split('\n').map(x => x.trimEnd());
  } catch {
    return ['No se pudo cargar el reglamento.'];
  }
}

async function obtenerResultados(url, jugadores) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  try {
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('a')).filter(el => el.textContent.includes('Race Mode'));
      if (tabs.length > 0) tabs[0].click();
    });
    await page.waitForSelector('tbody tr', { timeout: 10000 });

    const track = await page.$eval('div.container h3', el => el.innerText.trim());
    const escenario = await page.$eval('h2.text-center', el => el.innerText.trim());

    const resultados = await page.$$eval('tbody tr', (filas, jugadores) => {
      return filas.slice(0, 50).map((fila, i) => {
        const celdas = fila.querySelectorAll('td');
        const tiempo = celdas[1]?.innerText.trim();
        const jugador = celdas[2]?.innerText.trim();
        if (jugadores.includes(jugador)) {
          return { tiempo, jugador };
        }
        return null;
      }).filter(Boolean);
    }, jugadores);

    await browser.close();
    return { escenario, track, resultados };
  } catch (e) {
    await browser.close();
    return { escenario: 'Error', track: 'Error', resultados: [] };
  }
}

app.get('/', async (req, res) => {
  const jugadores = await leerJugadores();
  const semana = Math.ceil((((new Date()) - new Date(new Date().getFullYear(), 0, 1)) / 86400000 + new Date().getDay() + 1) / 7);
  const urls = [
    'https://www.velocidrone.com/leaderboard/33/1527/All',
    'https://www.velocidrone.com/leaderboard/16/1795/All'
  ];

  const ranking = {};
  const tracks = [];

  for (const url of urls) {
    const { escenario, track, resultados } = await obtenerResultados(url, jugadores);
    const datos = resultados.map((r, i) => {
      const puntos = i < puntos_posicion.length ? puntos_posicion[i] : puntos_default;
      ranking[r.jugador] = (ranking[r.jugador] || 0) + puntos;
      return `${i + 1}\t${r.tiempo}\t${r.jugador}`;
    });
    tracks.push({ nombre: `${escenario} - ${track}`, datos });
  }

  const ranking_semanal = Object.entries(ranking)
    .sort((a, b) => b[1] - a[1])
    .map(([jugador, puntos], i) => `${i + 1}. ${jugador} - ${puntos} pts`);

  const [ranking_anual, reglamento] = await Promise.all([leerRankingAnual(), leerReglamento()]);

  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>LIGA VELOCIDRONE SEMANA ${semana}</title>
      <style>
        body {
          font-family: 'Segoe UI', sans-serif;
          background: url('/static/background.jpg') no-repeat center center fixed;
          background-size: cover;
          color: #fff;
          padding: 20px;
        }
        .top-bar {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }
        .top-bar .left,
        .top-bar .right {
          display: flex;
          justify-content: center;
        }
        .top-bar h1 {
          font-size: 40px;
          margin: 0;
          text-align: center;
          font-family: 'Castellar', serif;
        }
        .logo {
          height: 50px;
        }
        .tracks, .rankings {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
        }
        .card {
          background: rgba(0, 0, 0, 0.6);
          padding: 20px;
          border-radius: 10px;
          flex: 1;
        }
        .card h3 {
          font-size: 22px;
          font-weight: bold;
          color: #fff;
        }
        .resultado {
          font-size: 17px;
          font-weight: 500;
          line-height: 1.6;
          font-family: monospace;
          white-space: pre;
        }
        .popup {
          display: none;
          position: fixed;
          top: 20%;
          left: 50%;
          transform: translate(-50%, -20%);
          background: rgba(0, 0, 0, 0.95);
          color: #fff;
          padding: 20px;
          border-radius: 10px;
          z-index: 10;
        }
        .popup ul {
          list-style: disc;
          margin: 10px 0 0 20px;
        }
        .popup ul li {
          margin-bottom: 5px;
        }
        .popup ul li:has(pre) {
          list-style-type: none;
        }
        .popup .close {
          margin-top: 10px;
          text-align: center;
          cursor: pointer;
          font-weight: bold;
        }
        .telegram {
          position: absolute;
          top: 20px;
          right: 20px;
        }
        .telegram img {
          width: 40px;
        }
        .boton {
          background: rgba(255,255,255,0.9);
          color: #000;
          padding: 8px 14px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="telegram">
        <a href="https://t.me/ligasemanalvelocidron" target="_blank">
          <img src="https://cdn-icons-png.flaticon.com/512/2111/2111646.png" alt="Telegram">
        </a>
      </div>

      <div class="top-bar">
        <div class="left"><div class="boton" onclick="document.getElementById('popupReglamento').style.display='block'">Reglamento</div></div>
        <div><h1>LIGA VELOCIDRONE SEMANA ${semana}</h1></div>
        <div class="right"><div class="boton" onclick="document.getElementById('popupAlta').style.display='block'">Alta piloto</div></div>
      </div>

      <div class="tracks">
        ${tracks.map(t => `<div class="card"><h3>${t.nombre}</h3><div class="resultado">${t.datos.join('\n')}</div></div>`).join('')}
      </div>

      <div class="rankings">
        <div class="card"><h3>Ranking Semanal</h3><div class="resultado">${ranking_semanal.join('\n')}</div></div>
        <div class="card"><h3>Ranking Anual</h3><div class="resultado">${ranking_anual.join('\n')}</div></div>
      </div>

      <div id="popupReglamento" class="popup">
        <h3>Reglamento</h3>
        <ul>
          ${reglamento.map(linea => linea.startsWith('\t') ? `<li style="list-style:none">${linea}</li>` : `<li>${linea}</li>`).join('')}
        </ul>
        <div class="close" onclick="document.getElementById('popupReglamento').style.display='none'">Cerrar</div>
      </div>

      <div id="popupAlta" class="popup">
        <h3>Alta de piloto</h3>
        <form method="POST">
          <input type="text" name="nuevo_piloto" placeholder="Nombre en Velocidrone" required><br><br>
          <label><input type="checkbox" name="soy_humano" required> No soy un robot</label><br><br>
          <input type="submit" value="Añadir">
        </form>
        <div class="close" onclick="document.getElementById('popupAlta').style.display='none'">Cerrar</div>
      </div>
    </body>
    </html>
  `);
});

app.post('/', async (req, res) => {
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', async () => {
    const data = Buffer.concat(chunks).toString();
    const nuevo_piloto = new URLSearchParams(data).get("nuevo_piloto");
    const soy_humano = new URLSearchParams(data).get("soy_humano");
    if (nuevo_piloto && soy_humano === 'on') {
      await escribirJugador(nuevo_piloto.trim());
    }
    res.redirect('/');
  });
});

app.get('/ver-jugadores', async (req, res) => {
  const jugadores = await leerJugadores();
  res.type('text/plain').send(jugadores.join('\n'));
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
