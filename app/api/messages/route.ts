import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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
    const limit = parseInt(searchParams.get("limit") || "50")

    let messages = []

    if (channelId) {
      messages = await prisma.message.findMany({
        where: { channelId },
        include: {
          sender: {
            select: { id: true, name: true, email: true, image: true, status: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      })
    } else if (groupId) {
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

    const { content, recipientId, groupId, channelId, type, fileUrl } =
      await request.json()

    if ((!content && !fileUrl) || (!recipientId && !groupId && !channelId)) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      )
    }

    const message = await prisma.message.create({
      data: {
        content: content || "",
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
