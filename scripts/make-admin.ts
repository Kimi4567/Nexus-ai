/**
 * scripts/make-admin.ts
 *
 * Grants ADMIN role to a user by email address.
 * Run once to make yourself (or a team member) an admin.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json -e "require('./scripts/make-admin').run('your@email.com')"
 *
 * Or simply:
 *   npx tsx scripts/make-admin.ts your@email.com
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function run(email: string) {
  if (!email) {
    console.error('❌  Usage: npx tsx scripts/make-admin.ts <email>')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error(`❌  No user found with email: ${email}`)
    console.error('    Make sure the user has logged in at least once.')
    process.exit(1)
  }

  await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN' },
  })

  console.log(`✅  ${email} is now an ADMIN.`)
  console.log(`    User ID: ${user.id}`)
  console.log(`    They can now access /admin`)
}

// Run when called directly: npx tsx scripts/make-admin.ts email@example.com
const email = process.argv[2]
if (email) {
  run(email)
    .catch(console.error)
    .finally(() => prisma.$disconnect())
}
