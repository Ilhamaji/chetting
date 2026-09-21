import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getGroupMembership } from "@/lib/security"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { id: groupId } = await params
    const membership = await getGroupMembership(groupId, session.user.id)
    if (!membership) return NextResponse.json({ message: "Forbidden" }, { status: 403 })

    const categories = await prisma.channelCategory.findMany({
      where: { groupId },
      include: {
        channels: true,
      },
      orderBy: { position: "asc" },
    })

    const unassignedChannels = await prisma.channel.findMany({
      where: {
        groupId,
        categoryId: null,
      },
    })

    return NextResponse.json({ categories, unassignedChannels })
  } catch (error) {
    console.error("Get channels error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { id: groupId } = await params
    const { name, type = "TEXT", categoryId } = await request.json()

    const membership = await getGroupMembership(groupId, session.user.id)
    if (!membership || membership.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    if (typeof name !== "string" || !name.trim() || name.length > 100 || !["TEXT", "VOICE", "VIDEO"].includes(type)) {
      return NextResponse.json({ message: "Name is required" }, { status: 400 })
    }
    if (categoryId) {
      const category = await prisma.channelCategory.findFirst({ where: { id: categoryId, groupId } })
      if (!category) return NextResponse.json({ message: "Invalid category" }, { status: 400 })
    }

    const channel = await prisma.channel.create({
      data: {
        name: name.trim(),
        type,
        groupId,
        categoryId: categoryId || null,
      },
    })

    return NextResponse.json({ channel }, { status: 201 })
  } catch (error) {
    console.error("Create channel error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get("channelId")

    if (!channelId) {
      return NextResponse.json({ message: "Channel ID required" }, { status: 400 })
    }

    const { id: groupId } = await params
    const membership = await getGroupMembership(groupId, session.user.id)
    if (!membership || membership.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    const channel = await prisma.channel.findFirst({ where: { id: channelId, groupId } })
    if (!channel) return NextResponse.json({ message: "Channel not found" }, { status: 404 })
    await prisma.channel.delete({ where: { id: channel.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete channel error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
