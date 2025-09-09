FROM node:18-alpine

# Crea directory di lavoro
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Installa dipendenze
RUN npm ci --only=production

# Copia il codice sorgente
COPY . .

# Crea directory per file statici
RUN mkdir -p public

# Espone la porta
EXPOSE 3000

# Comando di avvio
CMD ["npm", "start"]
