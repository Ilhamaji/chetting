import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const groups = await prisma.group.findMany({
      where: {
        members: {
          some: { userId: session.user.id },
        },
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true, image: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true, status: true },
            },
          },
        },
        categories: {
          include: {
            channels: true,
          },
          orderBy: { position: "asc" },
        },
        channels: true,
        _count: {
          select: { members: true, messages: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    })

    const formattedGroups = groups.map((group) => {
      const categorizedChannelIds = new Set(
        group.categories.flatMap((c) => c.channels.map((ch) => ch.id))
      )
      const unassignedChannels = group.channels.filter(
        (ch) => !ch.categoryId || !categorizedChannelIds.has(ch.id)
      )

      return {
        ...group,
        unassignedChannels,
      }
    })

    return NextResponse.json({ groups: formattedGroups })
  } catch (error) {
    console.error("Get groups error:", error)
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

    const { name, description, memberIds } = await request.json()

    if (!name) {
      return NextResponse.json(
        { message: "Group name is required" },
        { status: 400 }
      )
    }

    const group = await prisma.group.create({
      data: {
        name,
        description: description || null,
        creatorId: session.user.id,
        members: {
          create: [
            {
              userId: session.user.id,
              role: "ADMIN",
            },
            ...(memberIds || []).map((userId: string) => ({
              userId,
              role: "MEMBER" as const,
            })),
          ],
        },
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true, image: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true, status: true },
            },
          },
        },
      },
    })

    // Create default categories and channels
    const textCat = await prisma.channelCategory.create({
      data: {
        name: "TEXT CHANNELS",
        groupId: group.id,
        position: 0,
      },
    })

    const generalChannel = await prisma.channel.create({
      data: {
        name: "general",
        type: "TEXT",
        groupId: group.id,
        categoryId: textCat.id,
      },
    })

    const voiceCat = await prisma.channelCategory.create({
      data: {
        name: "VOICE CHANNELS",
        groupId: group.id,
        position: 1,
      },
    })

    const voiceChannel = await prisma.channel.create({
      data: {
        name: "General Voice",
        type: "VOICE",
        groupId: group.id,
        categoryId: voiceCat.id,
      },
    })

    const completeGroup = {
      ...group,
      categories: [
        {
          ...textCat,
          channels: [generalChannel],
        },
        {
          ...voiceCat,
          channels: [voiceChannel],
        },
      ],
      channels: [generalChannel, voiceChannel],
      unassignedChannels: [],
    }

    return NextResponse.json({ group: completeGroup }, { status: 201 })
  } catch (error) {
    console.error("Create group error:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}
