FROM node:24-bookworm-slim AS builder

WORKDIR /app

RUN npm config set registry https://registry.npmmirror.com/ && \
    yarn config set registry https://registry.npmmirror.com/

COPY package.json yarn.lock tsconfig.json ./

RUN node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));for(const section of ['dependencies','devDependencies']){if(!pkg[section]) continue;for(const name of ['custom-electron-titlebar','electron','electron-builder','electron-rebuild','electronmon']) delete pkg[section][name];}fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2)+'\n');" && \
    yarn install --frozen-lockfile

COPY src ./src
COPY scripts ./scripts
COPY data ./data

RUN mkdir -p /app/bundled-data && \
    cp -R /app/data/modelPrompt /app/bundled-data/modelPrompt && \
    cp -R /app/data/models /app/bundled-data/models && \
    cp -R /app/data/skills /app/bundled-data/skills && \
    cp -R /app/data/vendor /app/bundled-data/vendor && \
    cp -R /app/data/web /app/bundled-data/web && \
    yarn build && \
    yarn cache clean

FROM node:24-bookworm-slim AS runtime

WORKDIR /app

RUN npm config set registry https://registry.npmmirror.com/ && \
    yarn config set registry https://registry.npmmirror.com/

COPY --from=builder /app/package.json /app/yarn.lock ./

RUN yarn install --frozen-lockfile --production=true && \
    yarn cache clean && \
    mkdir -p /app/server /app/data

COPY --from=builder /app/data/serve/app.js /app/server/app.js
COPY --from=builder /app/bundled-data /app/bundled-data

ENV NODE_ENV=prod
ENV PORT=10588
ENV TOONFLOW_BUNDLED_DATA_DIR=/app/bundled-data
ENV TOONFLOW_FORCE_SYNC_DIRS=web

EXPOSE 10588

CMD ["node", "server/app.js"]
