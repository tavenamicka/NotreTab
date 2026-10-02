FROM node:20-alpine
RUN npm install -g json-server@0.17.4

WORKDIR /app
# bcryptjs est requis par server/auth.cjs (comparaison du mot de passe côté
# serveur). Installé localement plutôt qu'en global : require() depuis /app/server
# ne résout pas /usr/local/lib/node_modules sans bricoler NODE_PATH.
RUN npm install --no-package-lock --omit=dev bcryptjs@3.0.3

COPY db.json /app/db.json.seed
COPY server/ /app/server/
COPY docker/api-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["/entrypoint.sh"]
