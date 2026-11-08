# Remote MCP server (mcp.skillselion.com): `index.js http` on $PORT.
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY index.js ./
ENV PORT=3000 NODE_ENV=production
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://127.0.0.1:3000/health || exit 1
USER node
CMD ["node", "index.js", "http"]
