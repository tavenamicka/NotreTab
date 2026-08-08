FROM node:20-alpine
RUN npm install -g json-server@0.17.4

WORKDIR /app
COPY db.json /app/db.json.seed
COPY server/ /app/server/
COPY docker/api-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["/entrypoint.sh"]
