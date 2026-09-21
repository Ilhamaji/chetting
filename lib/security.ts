import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type RateLimitEntry = { count: number; resetAt: number }

const rateLimits = new Map<string, RateLimitEntry>()

export function getClientKey(request: NextRequest, scope: string) {
  const forwardedFor = request.headers.get("x-forwarded-for")
  const ip = forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"
  return `${scope}:${ip}`
}

export function isRateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const current = rateLimits.get(key)
  if (!current || current.resetAt <= now) {
    if (rateLimits.size >= 10_000) {
      const oldestKey = rateLimits.keys().next().value
      if (oldestKey) rateLimits.delete(oldestKey)
    }
    rateLimits.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  current.count += 1
  return current.count > limit
}

export async function getAuthenticatedUserId() {
  const session = await auth()
  return session?.user?.id ?? null
}

export async function getGroupMembership(groupId: string, userId: string) {
  return prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true },
  })
}

export async function getChannelAccess(channelId: string, userId: string) {
  return prisma.channel.findFirst({
    where: {
      id: channelId,
      group: { members: { some: { userId } } },
    },
    select: { id: true, groupId: true, type: true },
  })
}

export function jsonError(message: string, status: number) {
  return Response.json({ message }, { status })
}