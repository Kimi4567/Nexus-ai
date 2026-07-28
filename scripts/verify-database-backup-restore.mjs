import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const allow = process.env.ALLOW_EPHEMERAL_DATABASE_RESTORE_TEST === '1'
// pg_dump requires a direct PostgreSQL connection. Supabase's pooled
// DATABASE_URL can contain PgBouncer-only options that pg_dump rejects, so
// prefer DIRECT_URL whenever both are configured.
const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
const databaseUrlSource = process.env.DIRECT_URL ? 'DIRECT_URL' : 'DATABASE_URL'
const expectedHost = process.env.EXPECTED_DATABASE_HOST

if (!allow) {
  throw new Error(
    'Refusing to run. Set ALLOW_EPHEMERAL_DATABASE_RESTORE_TEST=1 for this read-only production dump and isolated local restore drill.',
  )
}
if (!databaseUrl || !expectedHost) {
  throw new Error('DIRECT_URL (preferred) or DATABASE_URL, plus EXPECTED_DATABASE_HOST, are required.')
}

const parsedDatabaseUrl = new URL(databaseUrl)
if (parsedDatabaseUrl.hostname !== expectedHost) {
  throw new Error(
    `Refusing to read an unexpected database host. Expected ${expectedHost}, received ${parsedDatabaseUrl.hostname}.`,
  )
}
if (!parsedDatabaseUrl.protocol.startsWith('postgres')) {
  throw new Error(`${databaseUrlSource} must use a PostgreSQL protocol.`)
}

function command(program, args, options = {}) {
  const result = spawnSync(program, args, {
    encoding: 'utf8',
    env: options.env || process.env,
    stdio: options.capture ? 'pipe' : ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    const safeOutput = `${result.stdout || ''}\n${result.stderr || ''}`
      .replaceAll(databaseUrl, '[REDACTED_DATABASE_URL]')
      .trim()
    throw new Error(`${program} failed (${result.status}): ${safeOutput}`)
  }
  return String(result.stdout || '').trim()
}

async function availablePort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : null
  await new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()))
  })
  if (!port) throw new Error('Could not allocate an isolated local PostgreSQL port.')
  return port
}

const configuredBin = process.env.POSTGRES_BIN
const postgresBin = configuredBin || join(
  command('brew', ['--prefix', 'postgresql@17'], { capture: true }),
  'bin',
)
const executable = name => join(postgresBin, name)

const restoreRoot = mkdtempSync(join(tmpdir(), 'nexus-db-restore-'))
const clusterDir = join(restoreRoot, 'cluster')
const socketDir = join(restoreRoot, 'socket')
const dumpPath = join(restoreRoot, 'nexus-public.dump')
const postgresLog = join(restoreRoot, 'postgres.log')
const port = await availablePort()
let serverStarted = false

mkdirSync(socketDir, { mode: 0o700 })

try {
  command(executable('initdb'), [
    '--pgdata', clusterDir,
    '--auth', 'trust',
    '--encoding', 'UTF8',
    '--no-sync',
  ])
  command(executable('pg_ctl'), [
    '--pgdata', clusterDir,
    '--log', postgresLog,
    '--options', `-p ${port} -k ${socketDir} -F`,
    '--wait',
    'start',
  ])
  serverStarted = true

  const localConnectionArgs = ['--host', socketDir, '--port', String(port)]
  command(executable('createdb'), [...localConnectionArgs, 'nexus_restore'])
  command(executable('psql'), [
    ...localConnectionArgs,
    '--dbname', 'nexus_restore',
    '--set', 'ON_ERROR_STOP=1',
    '--command', 'DROP SCHEMA public CASCADE;',
  ])

  // The production connection is read-only for this drill. Only the public
  // application schema is exported; Supabase-managed auth/storage schemas are
  // restored by the platform, not by this application runbook.
  command(executable('pg_dump'), [
    databaseUrl,
    '--format', 'custom',
    '--compress', '6',
    '--no-owner',
    '--no-privileges',
    '--schema', 'public',
    '--file', dumpPath,
  ])
  command(executable('pg_restore'), [
    ...localConnectionArgs,
    '--dbname', 'nexus_restore',
    '--no-owner',
    '--no-privileges',
    '--exit-on-error',
    dumpPath,
  ])

  const manifest = command(executable('psql'), [
    ...localConnectionArgs,
    '--dbname', 'nexus_restore',
    '--tuples-only',
    '--no-align',
    '--command', `
      SELECT json_build_object(
        'tables', (SELECT count(*) FROM pg_tables WHERE schemaname = 'public'),
        'users', (SELECT count(*) FROM public."User"),
        'workspaces', (SELECT count(*) FROM public."Workspace"),
        'campaigns', (SELECT count(*) FROM public."Campaign"),
        'creditTransactions', (SELECT count(*) FROM public."CreditTransaction"),
        'landingPages', (SELECT count(*) FROM public."LandingPage"),
        'leads', (SELECT count(*) FROM public."Lead")
      )::text;
    `,
  ], { capture: true })

  const parsedManifest = JSON.parse(manifest)
  if (parsedManifest.tables < 10 || parsedManifest.users < 1 || parsedManifest.workspaces < 1) {
    throw new Error(`Restored database failed the minimum integrity check: ${manifest}`)
  }

  const dumpBytes = statSync(dumpPath).size
  const dumpSha256 = createHash('sha256').update(readFileSync(dumpPath)).digest('hex')
  console.info('[Database Restore Drill]', JSON.stringify({
    ok: true,
    sourceHost: expectedHost,
    connectionSource: databaseUrlSource,
    scope: 'public',
    postgresVersion: command(executable('postgres'), ['--version'], { capture: true }),
    dumpBytes,
    dumpSha256,
    restored: parsedManifest,
    cleanup: 'ephemeral dump and local cluster removed after verification',
  }, null, 2))
} finally {
  if (serverStarted) {
    try {
      command(executable('pg_ctl'), [
        '--pgdata', clusterDir,
        '--mode', 'immediate',
        '--wait',
        'stop',
      ])
    } catch (error) {
      console.error('[Database Restore Drill] local PostgreSQL cleanup failed', error)
    }
  }
  if (restoreRoot.startsWith(join(tmpdir(), 'nexus-db-restore-'))) {
    rmSync(restoreRoot, { recursive: true, force: true })
  }
}
