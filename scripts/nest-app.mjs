import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const distDir = path.join(fileURLToPath(new URL('.', import.meta.url)), '..', 'frontend', 'dist')
const appDir = path.join(distDir, 'app')

fs.mkdirSync(appDir, { recursive: true })

const builtAssets = path.join(distDir, 'assets')
const nestedAssets = path.join(appDir, 'assets')
if (fs.existsSync(builtAssets)) {
  fs.rmSync(nestedAssets, { recursive: true, force: true })
  fs.renameSync(builtAssets, nestedAssets)
}

const appHtml = path.join(distDir, 'app.html')
if (fs.existsSync(appHtml)) {
  fs.copyFileSync(appHtml, path.join(appDir, 'index.html'))
  fs.rmSync(appHtml)
}

const favicon = path.join(distDir, 'favicon.svg')
if (fs.existsSync(favicon)) {
  fs.copyFileSync(favicon, path.join(appDir, 'favicon.svg'))
}

console.log('Nested app build at frontend/dist/app/')
