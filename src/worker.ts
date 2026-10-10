import { createApplication } from './application'

const app = createApplication()

export default {
  fetch: app.fetch
}
