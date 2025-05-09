import express from 'express';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

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

async function escribirJugador(nombre) {
  try {
    const jugadores = await leerJugadores();
    if (!jugadores.includes(nombre)) {
      await fs.appendFile('jugadores.txt', `\n${nombre}`);
      return true;
    }
    return false;
  } catch (e) {
    console.error('Error escribiendo jugador:', e);
    return false;
  }
}

async function leerReglamento() {
  try {
    const data = await fs.readFile('reglamento.txt', 'utf8');
    return data.split('\n').map(x => x.trimEnd());
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
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

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
    console.error('Error al obtener resultados desde:', url, e);
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
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .titulo-bar {
          text-align: center;
          flex-grow: 1;
        }
        .top-bar h1 {
          font-size: 42px;
          font-family: 'Castellar', serif;
        }
        .icono-telegram {
          height: 36px;
        }
        .boton {
          padding: 10px 16px;
          font-size: 16px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          background: #007bff;
          color: white;
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
          font-family: monospace;
          white-space: pre;
        }
        .popup {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          color: black;
          padding: 20px;
          border-radius: 8px;
          display: none;
          max-width: 400px;
          z-index: 1000;
        }
        .popup ul {
          padding-left: 20px;
        }
        .popup ul li {
          list-style: disc;
        }
        .popup ul li.tabulado {
          list-style: none;
        }
        .popup .cerrar {
          background: #dc3545;
          color: white;
          padding: 6px 12px;
          border: none;
          margin-top: 10px;
          float: right;
          border-radius: 5px;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="top-bar">
        <button class="boton" onclick="document.getElementById('popup-reglamento').style.display='block'">Reglamento</button>
        <div class="titulo-bar">
          <h1>LIGA VELOCIDRONE SEMANA ${semana}</h1>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <a href="https://t.me/ligasemanalvelocidron" target="_blank">
            <img src="https://cdn-icons-png.flaticon.com/512/2111/2111646.png" alt="Telegram" class="icono-telegram">
          </a>
          <button class="boton" onclick="document.getElementById('popup-alta').style.display='block'">Alta piloto</button>
        </div>
      </div>

      <div class="tracks">
        ${tracks.map(t => `<div class="card"><h3>${t.nombre}</h3><div class="resultado">${t.datos.join('\n')}</div></div>`).join('')}
      </div>

      <div class="rankings">
        <div class="card"><h3>Ranking Semanal</h3><div class="resultado">${ranking_semanal.join('\n')}</div></div>
        <div class="card"><h3>Ranking Anual</h3><div class="resultado">${ranking_anual.join('\n')}</div></div>
      </div>

      <div id="popup-reglamento" class="popup">
        <h3>Reglamento</h3>
        <ul>
          ${reglamento.map(l => l.startsWith('\t') ? `<li class="tabulado">${l.trim()}</li>` : `<li>${l}</li>`).join('')}
        </ul>
        <button class="cerrar" onclick="document.getElementById('popup-reglamento').style.display='none'">Cerrar</button>
      </div>

      <div id="popup-alta" class="popup">
        <h3>Alta piloto</h3>
        <form method="POST">
          <input type="text" name="nuevo_piloto" placeholder="Nombre en Velocidrone" required><br><br>
          <label><input type="checkbox" name="soy_humano" required> No soy un robot</label><br><br>
          <input type="submit" class="boton" value="Añadir">
        </form>
        <button class="cerrar" onclick="document.getElementById('popup-alta').style.display='none'">Cerrar</button>
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
    const params = new URLSearchParams(data);
    const nuevo_piloto = params.get("nuevo_piloto")?.trim();
    const soy_humano = params.get("soy_humano");

    console.log('Alta piloto:', nuevo_piloto, 'Verificación:', soy_humano);

    if (nuevo_piloto && soy_humano === 'on') {
      await escribirJugador(nuevo_piloto);
    }
    res.redirect('/');
  });
});

app.get('/ver-jugadores', async (req, res) => {
  const jugadores = await leerJugadores();
  res.type('text').send(jugadores.join('\n'));
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
