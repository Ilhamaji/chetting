import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id: channelId } = await params
  const cutoff = new Date(Date.now() - 30_000)

  try {
    await prisma.voiceSession.deleteMany({
      where: { channelId, updatedAt: { lt: cutoff } },
    })

    const members = await prisma.voiceSession.findMany({
      where: { channelId },
      select: {
        user: {
          select: { id: true, name: true, image: true, status: true },
        },
      },
      orderBy: { updatedAt: "asc" },
    })

    return NextResponse.json({ members: members.map(({ user }) => user) })
  } catch (error) {
    console.error("Get voice members error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id: channelId } = await params

  try {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, type: true },
    })

    if (!channel || channel.type !== "VOICE") {
      return NextResponse.json({ message: "Voice channel not found" }, { status: 404 })
    }

    await prisma.voiceSession.upsert({
      where: { channelId_userId: { channelId, userId: session.user.id } },
      update: {},
      create: { channelId, userId: session.user.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Join voice channel error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id: channelId } = await params

  try {
    await prisma.voiceSession.deleteMany({
      where: { channelId, userId: session.user.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Leave voice channel error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
