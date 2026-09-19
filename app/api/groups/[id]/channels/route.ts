import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

    if (!name) {
      return NextResponse.json({ message: "Name is required" }, { status: 400 })
    }

    const channel = await prisma.channel.create({
      data: {
        name,
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

    await prisma.channel.delete({
      where: { id: channelId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete channel error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
