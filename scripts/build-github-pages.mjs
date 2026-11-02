import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('../frontend', import.meta.url))
const distDir = path.join(rootDir, 'dist')

const [, repoName = 'otdr-reader'] = (process.env.GITHUB_REPOSITORY ?? 'tonymelek/otdr-reader').split('/')
const isUserPages = repoName.endsWith('.github.io')
const pagesBase = isUserPages ? '/' : `/${repoName}/`
const deployBase = `${pagesBase}app/`.replace(/\/{2,}/g, '/')

console.log('Building for GitHub Pages')
console.log(`  pages base: ${pagesBase}`)
console.log(`  app base:   ${deployBase}`)

execSync('npm run build', {
  cwd: rootDir,
  env: { ...process.env, DEPLOY_BASE: deployBase },
  stdio: 'inherit',
})

const repoSegment = pagesBase === '/' ? null : pagesBase.replace(/^\/|\/$/g, '')
const TEXT_EXTENSIONS = new Set(['.html', '.css', '.js', '.xml'])
const TEXT_FILENAMES = new Set(['manifest.webmanifest'])

function prefixRootPaths(content) {
  if (pagesBase === '/') return content

  const skipAlreadyPrefixed = repoSegment ? `(?!${repoSegment}/)` : ''

  return content
    .replace(new RegExp(`(\\b(?:href|src|action)=["'])\\/${skipAlreadyPrefixed}`, 'g'), `$1${pagesBase}`)
    .replace(new RegExp(`(<loc>)\\/${skipAlreadyPrefixed}`, 'g'), `$1${pagesBase}`)
    .replace(/"start_url":\s*"\/"/g, `"start_url": "${pagesBase}"`)
}

function shouldRewrite(filePath) {
  const rel = path.relative(distDir, filePath)
  if (rel.startsWith(`assets${path.sep}`) || rel.includes(`${path.sep}assets${path.sep}`)) {
    return false
  }

  const base = path.basename(filePath)
  if (TEXT_FILENAMES.has(base)) return true
  return TEXT_EXTENSIONS.has(path.extname(filePath))
}

function walkDist(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkDist(filePath)
      continue
    }
    if (!shouldRewrite(filePath)) continue
    fs.writeFileSync(filePath, prefixRootPaths(fs.readFileSync(filePath, 'utf8')))
  }
}

walkDist(distDir)

fs.writeFileSync(path.join(distDir, '.nojekyll'), '')

const appIndex = path.join(distDir, 'app', 'index.html')
if (fs.existsSync(appIndex)) {
  fs.copyFileSync(appIndex, path.join(distDir, '404.html'))
}

console.log('GitHub Pages build ready in frontend/dist/')
