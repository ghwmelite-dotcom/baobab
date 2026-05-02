import { Hono } from 'hono'
import type { AppContext } from './types'
import { residency } from './middleware/residency'

export { ReaderQueue } from './durable-objects/reader-queue'

const app = new Hono<AppContext>()

app.use('*', residency)
app.get('/', (c) => c.json({ name: c.env.APP_NAME, version: c.env.APP_VERSION }))

export default app
