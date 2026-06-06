import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { writeFileSync } from 'fs'

const BUILD_VERSION = Date.now().toString(36)

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'build-version',
      closeBundle() {
        writeFileSync('dist/version.json', JSON.stringify({ v: BUILD_VERSION }))
      },
    },
  ],
  define: {
    __BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  base: '/',
})
