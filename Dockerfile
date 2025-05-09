# Imagen oficial de Puppeteer con Chromium ya instalado
FROM ghcr.io/puppeteer/puppeteer:latest

# Establece el directorio de trabajo
WORKDIR /app

# Copia todos los archivos
COPY . .

# Instala las dependencias
RUN npm install

# Expone el puerto para Render
EXPOSE 3000

# Comando para iniciar la app
CMD ["node", "index.js"]
