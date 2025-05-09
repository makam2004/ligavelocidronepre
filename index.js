import express from 'express';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';

const app = express();
const PORT = process.env.PORT || 3000;

app.use('/static', express.static('static'));
app.use(express.urlencoded({ extended: true }));

const puntos_posicion = [10, 8, 6, 4, 2];
const puntos_default = 1;

async function leerJugadores() {
  try {
    const data = await fs.readFile('jugadores.txt', 'utf8');
    return data.split('\n').map(x => x.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

async function leerReglamento() {
  try {
    const data = await fs.readFile('reglamento.txt', 'utf8');
    return data.split('\n').map(x => x.trim()).filter(Boolean);
  } catch {
    return ['No se pudo cargar el reglamento.'];
  }
}

async function leerRankingAnual() {
  try {
    const data = await fs.readFile('rankinganual.txt', 'utf8');
    return data.split('\n').map(x => x.trim()).filter(Boolean);
  } catch {
    return [];
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
      return filas.slice(0, 100).map((fila, i) => {
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
          position: relative;
        }
        .top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .title-group {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
        }
        .title-group h1 {
          font-family: 'Castellar', serif;
          font-size: 38px;
          margin: 0 10px;
          text-align: center;
        }
        .logo {
          height: 60px;
        }
        .btn {
          padding: 8px 12px;
          font-size: 16px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
        .telegram {
          position: absolute;
          top: 10px;
          right: 10px;
        }
        .telegram img {
          height: 42px;
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
          transform: translateX(-50%);
          background: #fff;
          color: #000;
          padding: 20px;
          border-radius: 10px;
          z-index: 1000;
          max-width: 400px;
          box-shadow: 0 0 15px rgba(0,0,0,0.5);
        }
        .popup .close {
          float: right;
          cursor: pointer;
          font-weight: bold;
          font-size: 18px;
        }
      </style>
    </head>
    <body>
      <div class="top-bar">
        <button class="btn" onclick="document.getElementById('popupReglamento').style.display='block'">📘 Reglamento</button>
        <div class="title-group">
          <img src="https://www.velocidrone.com/assets/images/VelocidroneLogoWeb.png" class="logo">
          <h1>LIGA VELOCIDRONE SEMANA ${semana}</h1>
          <img src="https://www.velocidrone.com/assets/images/VelocidroneLogoWeb.png" class="logo">
        </div>
        <button class="btn" onclick="document.getElementById('popupAlta').style.display='block'">➕ Alta piloto</button>
      </div>

      <div class="telegram">
        <a href="https://t.me/ligasemanalvelocidron" target="_blank">
          <img src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" alt="Telegram">
        </a>
      </div>

      <div class="tracks">
        ${tracks.map(t => `<div class="card"><h3>${t.nombre}</h3><div class="resultado">${t.datos.join('\n')}</div></div>`).join('')}
      </div>
      <div class="rankings">
        <div class="card"><h3>Ranking Semanal</h3><div class="resultado">${ranking_semanal.join('\n')}</div></div>
        <div class="card"><h3>Ranking Anual</h3><div class="resultado">${ranking_anual.join('\n')}</div></div>
      </div>

      <div id="popupAlta" class="popup">
        <span class="close" onclick="document.getElementById('popupAlta').style.display='none'">✖</span>
        <h2>Alta de piloto</h2>
        <form method="POST">
          <input type="text" name="nuevo_piloto" placeholder="Nombre en Velocidrone" required><br><br>
          <label><input type="checkbox" name="soy_humano" required> No soy un robot</label><br><br>
          <input type="submit" value="Añadir">
        </form>
      </div>

      <div id="popupReglamento" class="popup">
        <span class="close" onclick="document.getElementById('popupReglamento').style.display='none'">✖</span>
        <h2>Reglamento</h2>
        <ul>${reglamento.map(regla => `<li>${regla}</li>`).join('')}</ul>
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
      const jugadores = await leerJugadores();
      if (!jugadores.includes(nuevo_piloto)) {
        await fs.appendFile('jugadores.txt', `\n${nuevo_piloto}`);
      }
    }
    res.redirect('/');
  });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
