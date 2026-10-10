import process from 'node:process'
import { createApplication } from './application'

const app = createApplication()

export default {
  port: process.env.PORT || 3000,
  hostname: '0.0.0.0',
  fetch: app.fetch
}
