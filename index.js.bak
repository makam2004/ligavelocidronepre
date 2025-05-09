import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.resolve();

app.use('/static', express.static('static'));
app.use(express.urlencoded({ extended: true }));

async function leerRankingAnual() {
  try {
    const data = await fs.readFile('rankinganual.txt', 'utf8');
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

async function leerResultados() {
  try {
    const data = await fs.readFile('/tmp/resultados.json', 'utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

app.get('/', async (req, res) => {
  const resultados = await leerResultados();
  if (!resultados) return res.send('<h2>Error: No hay resultados disponibles aún.</h2>');

  const { semana, tracks, ranking_semanal } = resultados;
  const ranking_anual = await leerRankingAnual();

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
          align-items: center;
          justify-content: center;
          gap: 20px;
          margin-bottom: 20px;
        }
        .top-bar h1 {
          font-size: 40px;
          margin: 0;
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
      </style>
    </head>
    <body>
      <div class="top-bar">
        <img src="https://www.velocidrone.com/assets/images/VelocidroneLogoWeb.png" class="logo">
        <h1>LIGA VELOCIDRONE SEMANA ${semana}</h1>
        <img src="https://www.velocidrone.com/assets/images/VelocidroneLogoWeb.png" class="logo">
      </div>

      <div class="tracks">
        ${tracks.map(t => `<div class="card"><h3>${t.nombre}</h3><div class="resultado">${t.datos.join('\n')}</div></div>`).join('')}
      </div>

      <div class="rankings">
        <div class="card"><h3>Ranking Semanal</h3><div class="resultado">${ranking_semanal.join('\n')}</div></div>
        <div class="card"><h3>Ranking Anual</h3><div class="resultado">${ranking_anual.join('\n')}</div></div>
      </div>
    </body>
    </html>
  `);
});

// ✅ Ruta protegida para actualizar resultados
app.get('/actualizar-resultados', (req, res) => {
  const token = req.query.token;
  if (token !== process.env.UPDATE_SECRET) {
    return res.status(403).send('Acceso denegado');
  }

  exec('node actualizar_resultados.js', (err, stdout, stderr) => {
    if (err) {
      console.error('❌ Error al ejecutar actualización:', stderr);
      return res.status(500).send('Error al actualizar');
    }
    console.log('✅ Resultados actualizados:', stdout);
    res.send('Actualización completada');
  });
});

app.listen(PORT, () => {
  console.log(`Servidor web escuchando en http://localhost:${PORT}`);
});
