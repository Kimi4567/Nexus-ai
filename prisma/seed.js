const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Seeding demo data...')
  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: { name: 'Demo User' },
    create: { email: 'demo@example.com', name: 'Demo User', aiCredits: 500 },
  })

  const ws = await prisma.workspace.upsert({
    where: { slug: 'demo-workspace' },
    update: {},
    create: { name: 'Demo Workspace', slug: 'demo-workspace', ownerId: user.id },
  })

  const project = await prisma.project.create({ data: { name: 'Demo Project', workspaceId: ws.id, businessType: 'ecommerce', businessInfo: { description: 'Demo business' } } })

  const campaign = await prisma.campaign.create({ data: { name: 'Demo Campaign', workspaceId: ws.id, projectId: project.id, goal: 'SALES', audience: 'SMB owners', tone: 'PROFESSIONAL', platforms: ['TIKTOK', 'INSTAGRAM'] } })

  console.log('Seed complete:', { user: user.id, workspace: ws.id, project: project.id, campaign: campaign.id })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
