import {
  createGatewayApp,
  loadGatewayConfigFromEnv,
} from '../server/gateway.js'

const config = loadGatewayConfigFromEnv()
const app = createGatewayApp(config)

Bun.serve({
  hostname: config.host,
  port: config.port,
  fetch: app.fetch,
})

console.log(`kimi-code server listening on http://${config.host}:${config.port}`)
