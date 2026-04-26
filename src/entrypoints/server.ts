import {
  createGatewayApp,
  loadGatewayConfigFromEnv,
} from '../server/gateway.js'

const config = loadGatewayConfigFromEnv()
if (!config.token && process.env.KIMI_SERVER_ALLOW_NO_TOKEN !== '1') {
  throw new Error(
    'KIMI_SERVER_TOKEN is required. Set KIMI_SERVER_ALLOW_NO_TOKEN=1 only for isolated local development.',
  )
}
const app = createGatewayApp(config)

Bun.serve({
  hostname: config.host,
  port: config.port,
  fetch: app.fetch,
})

console.log(`kimi-code server listening on http://${config.host}:${config.port}`)
