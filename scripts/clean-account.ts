/**
 * One-time account data cleanup script.
 *
 * - Deletes all workspaces (cascades: campaigns, content plans, social posts,
 *   media, AI suggestions, brand profile, integrations, agent runs, etc.)
 * - Resets monthly counters
 * - Preserves: user row, email, subscription, aiCredits, stripeCustomerId
 * - Creates a fresh default workspace
 *
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/clean-account.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TARGET_EMAIL = 'raoufnaguib44@gmail.com'

async function main() {
  console.log(`\n🔍 Finding user: ${TARGET_EMAIL}`)

  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    include: { workspaces: { select: { id: true, name: true } } }
  })

  if (!user) {
    console.error('❌ User not found. Aborting.')
    process.exit(1)
  }

  console.log(`✅ Found user: ${user.id}`)
  console.log(`   Plan: ${user.subscriptionStatus} | Credits: ${user.aiCredits} | Stripe: ${user.stripeCustomerId ?? 'none'}`)
  console.log(`   Workspaces: ${user.workspaces.map(w => w.name).join(', ') || 'none'}`)

  // --- Delete all workspaces (cascades everything) ---
  const workspaceIds = user.workspaces.map(w => w.id)

  if (workspaceIds.length > 0) {
    console.log(`\n🗑️  Deleting ${workspaceIds.length} workspace(s) + all cascade data...`)
    await prisma.workspace.deleteMany({ where: { ownerId: user.id } })
    console.log('   ✅ Workspaces deleted (campaigns, content, media, suggestions, brand profile all gone)')
  } else {
    console.log('\n⚠️  No workspaces found — nothing to delete.')
  }

  // --- Reset monthly counters only (preserve subscription + credits + stripe) ---
  console.log('\n🔄 Resetting monthly counters (keeping subscription + credits)...')
  await prisma.user.update({
    where: { id: user.id },
    data: {
      monthlyGenerations: 0,
    }
  })

  // Reset usage record if it exists
  await prisma.usage.updateMany({
    where: { userId: user.id },
    data: {
      aiGenerations: 0,
      campaignsCreated: 0,
      postsPublished: 0,
      mediaUploaded: 0,
    }
  })

  console.log('   ✅ Counters reset')

  // --- Create fresh default workspace ---
  console.log('\n🏗️  Creating fresh workspace...')
  const freshWorkspace = await prisma.workspace.create({
    data: {
      name: 'My Workspace',
      slug: `workspace-${Date.now()}`,
      ownerId: user.id,
    }
  })
  console.log(`   ✅ New workspace created: ${freshWorkspace.id}`)

  // --- Summary ---
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ DONE — Account cleaned successfully')
  console.log(`   Plan:     ${user.subscriptionStatus}   ← preserved`)
  console.log(`   Credits:  ${user.aiCredits}            ← preserved`)
  console.log(`   Stripe:   ${user.stripeCustomerId ?? 'none'}  ← preserved`)
  console.log(`   Workspace: ${freshWorkspace.id}  ← fresh`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main()
  .catch(e => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
