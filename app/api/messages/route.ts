import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getChannelAccess, getGroupMembership, getClientKey, isRateLimited } from "@/lib/security"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const recipientId = searchParams.get("recipientId")
    const groupId = searchParams.get("groupId")
    const channelId = searchParams.get("channelId")
    const requestedLimit = Number.parseInt(searchParams.get("limit") || "50", 10)
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50

    let messages = []

    if (channelId) {
      const channel = await getChannelAccess(channelId, session.user.id)
      if (!channel) return NextResponse.json({ message: "Forbidden" }, { status: 403 })
      messages = await prisma.message.findMany({
        where: { channelId, groupId: channel.groupId },
        include: {
          sender: {
            select: { id: true, name: true, email: true, image: true, status: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      })
    } else if (groupId) {
      const membership = await getGroupMembership(groupId, session.user.id)
      if (!membership) return NextResponse.json({ message: "Forbidden" }, { status: 403 })
      messages = await prisma.message.findMany({
        where: { groupId },
        include: {
          sender: {
            select: { id: true, name: true, email: true, image: true, status: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      })
    } else if (recipientId) {
      messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: session.user.id, recipientId },
            { senderId: recipientId, recipientId: session.user.id },
          ],
        },
        include: {
          sender: {
            select: { id: true, name: true, email: true, image: true, status: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      })
    } else {
      return NextResponse.json(
        { message: "Missing recipientId, groupId or channelId" },
        { status: 400 }
      )
    }

    return NextResponse.json({ messages: messages.reverse() })
  } catch (error) {
    console.error("Get messages error:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    if (isRateLimited(getClientKey(request, `messages:${session.user.id}`), 60, 60_000)) {
      return NextResponse.json({ message: "Too many messages" }, { status: 429 })
    }

    const contentLength = Number(request.headers.get("content-length") || 0)
    if (contentLength > 128 * 1024) {
      return NextResponse.json({ message: "Request is too large" }, { status: 413 })
    }

    const { content, recipientId, groupId, channelId, type, fileUrl } =
      await request.json()

    const targetCount = [recipientId, groupId, channelId].filter(Boolean).length
    const normalizedContent = typeof content === "string" ? content.trim() : ""
    const allowedTypes = new Set(["TEXT", "IMAGE", "FILE", "AUDIO", "VIDEO"])

    if ((!normalizedContent && !fileUrl) || targetCount !== 1) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      )
    }
    if (normalizedContent.length > 4000 || (fileUrl && (typeof fileUrl !== "string" || fileUrl.length > 500))) {
      return NextResponse.json({ message: "Message content is too large" }, { status: 413 })
    }
    if (type !== undefined && !allowedTypes.has(type)) {
      return NextResponse.json({ message: "Invalid message type" }, { status: 400 })
    }

    if (groupId) {
      const membership = await getGroupMembership(groupId, session.user.id)
      if (!membership) return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }
    if (channelId) {
      const channel = await getChannelAccess(channelId, session.user.id)
      if (!channel || (groupId && channel.groupId !== groupId)) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
      }
    }
    if (fileUrl) {
      const assetId = fileUrl.startsWith("/api/media/") ? fileUrl.slice("/api/media/".length) : ""
      const asset = assetId ? await prisma.mediaAsset.findUnique({ where: { id: assetId }, select: { ownerId: true } }) : null
      if (!asset || asset.ownerId !== session.user.id) {
        return NextResponse.json({ message: "Invalid attachment" }, { status: 400 })
      }
    }

    const message = await prisma.message.create({
      data: {
        content: normalizedContent,
        senderId: session.user.id,
        recipientId: recipientId || null,
        groupId: groupId || null,
        channelId: channelId || null,
        type: type || "TEXT",
        fileUrl: fileUrl || null,
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, image: true, status: true },
        },
      },
    })

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    console.error("Send message error:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get("messageId")

    if (!messageId) {
      return NextResponse.json({ message: "Message ID required" }, { status: 400 })
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    })

    if (!message) {
      return NextResponse.json({ message: "Message not found" }, { status: 404 })
    }

    if (message.senderId !== session.user.id) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    await prisma.message.delete({
      where: { id: messageId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete message error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
