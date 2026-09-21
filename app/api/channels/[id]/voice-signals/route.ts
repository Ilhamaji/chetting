import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getChannelAccess } from "@/lib/security"

const signalTypes = new Set(["offer", "answer", "ice-candidate"])

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id: channelId } = await params
  if (!(await getChannelAccess(channelId, session.user.id))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }

  try {
    const signals = await prisma.voiceSignal.findMany({
      where: { channelId, recipientId: session.user.id },
      orderBy: { createdAt: "asc" },
    })

    if (signals.length > 0) {
      await prisma.voiceSignal.deleteMany({
        where: { id: { in: signals.map((signal) => signal.id) } },
      })
    }

    return NextResponse.json({ signals })
  } catch (error) {
    console.error("Get voice signals error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id: channelId } = await params
  if (!(await getChannelAccess(channelId, session.user.id))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }

  try {
    const { recipientId, type, payload } = await request.json()
    if (
      typeof recipientId !== "string" ||
      !signalTypes.has(type) ||
      !payload ||
      typeof payload !== "object"
    ) {
      return NextResponse.json({ message: "Invalid voice signal" }, { status: 400 })
    }
    if (JSON.stringify(payload).length > 64 * 1024) {
      return NextResponse.json({ message: "Voice signal is too large" }, { status: 413 })
    }
    const recipientSession = await prisma.voiceSession.findUnique({
      where: { channelId_userId: { channelId, userId: recipientId } },
    })
    if (!recipientSession) return NextResponse.json({ message: "Recipient is not in this voice channel" }, { status: 403 })

    const senderSession = await prisma.voiceSession.findUnique({
      where: { channelId_userId: { channelId, userId: session.user.id } },
    })
    if (!senderSession) {
      return NextResponse.json({ message: "You are not in this voice channel" }, { status: 403 })
    }

    const signal = await prisma.voiceSignal.create({
      data: {
        channelId,
        senderId: session.user.id,
        recipientId,
        type,
        payload,
      },
    })

    return NextResponse.json({ signal }, { status: 201 })
  } catch (error) {
    console.error("Create voice signal error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}