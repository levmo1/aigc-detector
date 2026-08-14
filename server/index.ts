import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { detectionsRoutes } from './routes/detections'
import { historyRoutes } from './routes/history'
import { llmConfigRoutes } from './routes/llm-config'
import { rulesRoutes } from './routes/rules'
import { statusRoutes } from './routes/status'

const app = new Hono()

// 前端在 Tauri WebView（tauri://localhost）或 vite dev（localhost:5173）中
// fetch http://127.0.0.1:<port>，属跨源请求，必须允许 CORS。
// 白名单限定来源，避免任意网页读取本机数据。
const allowedOrigins = [
  'tauri://localhost',
  'http://tauri.localhost',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:1420',
  'http://127.0.0.1:1420',
]
app.use('*', cors({ origin: allowedOrigins }))

app.route('/api/detections', detectionsRoutes)
app.route('/api/history', historyRoutes)
app.route('/api/llm-config', llmConfigRoutes)
app.route('/api/rules', rulesRoutes)
app.route('/api/status', statusRoutes)

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: '接口不存在。' } }, 404))
app.onError((error, c) => c.json({ error: { code: 'INTERNAL', message: error.message } }, 500))

const port = Number(process.argv[2] ?? 0) || 3210
serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, (info) => {
  console.log(`AIGC-SERVER-READY ${info.port}`)
})
