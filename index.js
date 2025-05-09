// index.js
import express from 'express';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import bodyParser from 'body-parser';

const app = express();
const PORT = process.env.PORT || 3000;

const puntos_posicion = [10, 8, 6, 4, 2];
const puntos_default = 1;

app.use('/static', express.static('static'));
app.use(bodyParser.urlencoded({ extended: true }));

async function leerArchivo(nombre) {
  try {
    const data = await fs.readFile(nombre, 'utf8');
    return data.split('\n').map(x => x.trimEnd());
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
  const jugadores = await leerArchivo('jugadores.txt');
  const ranking_anual = await leerArchivo('rankinganual.txt');
  const reglamento = await leerArchivo('reglamento.txt');

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

  res.send(`<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>LIGA VELOCIDRONE SEMANA ${semana}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Castellar&display=swap');
      body {
        font-family: 'Segoe UI', sans-serif;
        background: url('/static/background.jpg') no-repeat center center fixed;
        background-size: cover;
        color: #fff;
        padding: 20px;
      }
      .top-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
      }
      .btn {
        background-color: #007bff;
        color: white;
        border: none;
        padding: 10px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 15px;
      }
      .title-group {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 1;
      }
      .title-group h1 {
        font-family: 'Castellar', serif;
        font-size: 40px;
        margin: 0 10px;
      }
      .title-group img {
        height: 60px;
      }
      .telegram {
        position: absolute;
        right: 10px;
        top: 10px;
      }
      .telegram img {
        height: 40px;
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
      }
      .popup h2 { margin-top: 0; }
      .popup ul { padding-left: 20px; }
      .popup ul li { list-style-type: disc; }
      .popup ul li.tabbed { list-style-type: none; }
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
      .resultado {
        font-size: 17px;
        font-family: monospace;
        white-space: pre;
      }
    </style>
  </head>
  <body>
    <div class="telegram">
      <a href="https://t.me/ligasemanalvelocidron" target="_blank">
        <img src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" alt="Telegram">
      </a>
    </div>
    <div class="top-bar">
      <button class="btn" onclick="document.getElementById('popupReglamento').style.display='block'">📘 Reglamento</button>
      <div class="title-group">
        <img src="https://www.velocidrone.com/assets/images/VelocidroneLogoWeb.png">
        <h1>LIGA VELOCIDRONE SEMANA ${semana}</h1>
        <img src="https://www.velocidrone.com/assets/images/VelocidroneLogoWeb.png">
      </div>
      <button class="btn" onclick="document.getElementById('popupAlta').style.display='block'">➕ Alta piloto</button>
    </div>

    <div class="tracks">
      ${tracks.map(t => `<div class="card"><h3>${t.nombre}</h3><div class="resultado">${t.datos.join('\n')}</div></div>`).join('')}
    </div>

    <div class="rankings">
      <div class="card"><h3>Ranking Semanal</h3><div class="resultado">${ranking_semanal.join('\n')}</div></div>
      <div class="card"><h3>Ranking Anual</h3><div class="resultado">${ranking_anual.join('\n')}</div></div>
    </div>

    <div id="popupReglamento" class="popup">
      <h2>Reglamento</h2>
      <ul>
        ${reglamento.map(regla => `<li class="${regla.startsWith('\t') ? 'tabbed' : ''}">${regla}</li>`).join('')}
      </ul>
      <button onclick="document.getElementById('popupReglamento').style.display='none'">Cerrar</button>
    </div>
    <div id="popupAlta" class="popup">
      <h2>Alta de piloto</h2>
      <form method="POST">
        <input type="text" name="nuevo_piloto" required placeholder="Nombre en Velocidrone"><br><br>
        <label><input type="checkbox" name="soy_humano" required> No soy un robot</label><br><br>
        <input type="submit" value="Añadir">
      </form>
      <br>
      <button onclick="document.getElementById('popupAlta').style.display='none'">Cerrar</button>
    </div>
  </body>
  </html>`);
});

app.get('/ver-jugadores', async (req, res) => {
  const jugadores = await leerArchivo('jugadores.txt');
  res.type('text/plain').send(jugadores.join('\n'));
});

app.post('/', async (req, res) => {
  const { nuevo_piloto, soy_humano } = req.body;
  if (nuevo_piloto && soy_humano === 'on') {
    const jugadores = await leerArchivo('jugadores.txt');
    if (!jugadores.includes(nuevo_piloto)) {
      await fs.appendFile('jugadores.txt', `\n${nuevo_piloto}`);
    }
  }
  res.redirect('/');
});

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
