import { Hono } from 'hono'
import type { AppContext } from './types'

const app = new Hono<AppContext>()

app.get('/', (c) => c.json({ name: c.env.APP_NAME, version: c.env.APP_VERSION }))

export default app
