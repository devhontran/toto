import { defineConfig } from 'vite'

export default defineConfig({
  server: { port: 3016, strictPort: true, host: true },
  preview: { port: 3016, strictPort: true },
})
