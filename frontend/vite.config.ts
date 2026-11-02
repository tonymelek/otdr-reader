import fs from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig, type Connect, type ViteDevServer } from 'vite'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const publicDir = resolve(rootDir, 'public')

/** SPA subpath. CI sets DEPLOY_BASE for GitHub project pages, e.g. /otdr-reader/app/. */
const APP_BASE = process.env.DEPLOY_BASE || '/app/'
const appBasePath = APP_BASE.replace(/\/$/, '') || '/app'

const MARKETING_PAGES = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/about', 'about.html'],
  ['/about.html', 'about.html'],
])

const MARKETING_ASSETS = new Set([
  '/static_style.css',
  '/site.js',
  '/favicon.svg',
  '/logo-512.png',
  '/manifest.webmanifest',
  '/robots.txt',
  '/sitemap.xml',
])

function isAppPath(pathname: string) {
  return pathname === appBasePath || pathname === `${appBasePath}/` || pathname.startsWith(`${appBasePath}/`)
}

function hasFileExtension(pathname: string) {
  const lastSegment = pathname.split('/').pop() ?? ''
  return /\.[a-zA-Z0-9]+$/.test(lastSegment)
}

function sendPublicFile(pathname: string, res: Connect.ServerResponse) {
  const relativePath = pathname.replace(/^\//, '')
  const filePath = resolve(publicDir, relativePath)

  if (!filePath.startsWith(publicDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false
  }

  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const types: Record<string, string> = {
    css: 'text/css; charset=utf-8',
    js: 'text/javascript; charset=utf-8',
    svg: 'image/svg+xml',
    png: 'image/png',
    webmanifest: 'application/manifest+json; charset=utf-8',
    xml: 'application/xml; charset=utf-8',
    txt: 'text/plain; charset=utf-8',
    html: 'text/html; charset=utf-8',
  }

  res.statusCode = 200
  res.setHeader('Content-Type', types[ext] ?? 'application/octet-stream')
  res.end(fs.readFileSync(filePath))
  return true
}

function serveMarketingPage(pathname: string, res: Connect.ServerResponse) {
  const page = MARKETING_PAGES.get(pathname)
  if (!page) return false
  return sendPublicFile(`/${page}`, res)
}

function siteRoutingMiddleware(
  req: Connect.IncomingMessage,
  res: Connect.ServerResponse,
  next: Connect.NextFunction,
  spaFile: string,
) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const pathname = url.pathname

  if (MARKETING_ASSETS.has(pathname) && sendPublicFile(pathname, res)) return
  if (pathname === `${appBasePath}/favicon.svg` && sendPublicFile('/favicon.svg', res)) return
  if (serveMarketingPage(pathname, res)) return

  if (isAppPath(pathname)) {
    const isViteInternal =
      pathname.startsWith(`${appBasePath}/@`) ||
      pathname.startsWith(`${appBasePath}/node_modules/`) ||
      pathname.startsWith(`${appBasePath}/src/`)
    const isBuiltAsset = pathname.startsWith(`${appBasePath}/assets/`)

    if (!isViteInternal && !isBuiltAsset && !hasFileExtension(pathname)) {
      req.url = `${appBasePath}/${spaFile}${url.search}`
    }
  }

  next()
}

function siteRoutingPlugin() {
  return {
    name: 'site-routing',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => siteRoutingMiddleware(req, res, next, 'app.html'))
    },
    configurePreviewServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => siteRoutingMiddleware(req, res, next, 'index.html'))
    },
  }
}

export default defineConfig({
  base: APP_BASE,
  plugins: [svelte(), siteRoutingPlugin()],
  build: {
    rollupOptions: {
      input: resolve(rootDir, 'app.html'),
    },
  },
})
