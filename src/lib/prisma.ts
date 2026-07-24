import { PrismaClient } from '@prisma/client'
import { buildPrismaConnectionUrl } from '@/lib/prismaConnection'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient = globalForPrisma.prisma
  ?? new PrismaClient({
    log: ['warn', 'error'],
    datasourceUrl: buildPrismaConnectionUrl(),
  })

globalForPrisma.prisma = prisma
