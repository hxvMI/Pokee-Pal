// Configure the React development server and production bundler.
// A root base path matches the Express deployment that serves the app at /.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
})
