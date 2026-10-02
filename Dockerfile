FROM node:22-slim

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

RUN mkdir -p data session logs tmp temp_stickers temp_url_uploads viewonce_stealth collected_stickers sticker_packs

EXPOSE 3000

CMD ["node", "--no-warnings", "--expose-gc", "--max-old-space-size=1024", "--max-semi-space-size=64", "--experimental-global-webcrypto", "index.js"]
