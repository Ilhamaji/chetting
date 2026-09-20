import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new (PrismaClient as any)({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      // Override postinstall flag so Prisma does not throw CI dependency caching error on Vercel
      __internal: {
        configOverride: (config: any) => ({
          ...config,
          postinstall: false,
        }),
      },
    }) as PrismaClient
  }
  return globalForPrisma.prisma
}

export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    const client = getPrismaClient()
    return Reflect.get(client, prop, receiver)
  },
})

