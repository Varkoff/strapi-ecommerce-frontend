# base node image
FROM node:20-bullseye-slim AS base

# set for base and all layer that inherit from it
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y curl tzdata

FROM base AS deps

WORKDIR /algomax

ADD package*.json .npmrc ./
RUN npm install --include=dev
# RUN npm run partytown

# Setup production node_modules
FROM base AS production-deps

WORKDIR /algomax

COPY --from=deps /algomax/node_modules /algomax/node_modules
ADD package*.json .npmrc ./
RUN npm prune --omit=dev

# Build the app
FROM base AS build

WORKDIR /algomax

COPY --from=deps /algomax/node_modules /algomax/node_modules

ADD . .

RUN npm run build

# Finally, build the production image with minimal footprint
FROM base

ENV PORT="3000"
ENV TZ=Europe/Paris
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /algomax

# USER node

COPY --chown=node --from=production-deps /algomax/node_modules node_modules
COPY --chown=node --from=build /algomax/build build
COPY --chown=node --from=build /algomax/public public
COPY --chown=node --from=build /algomax/package.json package.json
COPY --chown=node --from=build /algomax/start.sh start.sh
COPY --chown=node --from=build /algomax/public public

ENTRYPOINT [ "./start.sh" ]