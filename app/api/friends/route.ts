import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { user1Id: session.user.id, status: "ACCEPTED" },
          { user2Id: session.user.id, status: "ACCEPTED" },
        ],
      },
      include: {
        user1: {
          select: { id: true, name: true, email: true, image: true, status: true },
        },
        user2: {
          select: { id: true, name: true, email: true, image: true, status: true },
        },
      },
    })

    const friends = friendships.map((friendship) => {
      return friendship.user1Id === session.user.id
        ? friendship.user2
        : friendship.user1
    })

    return NextResponse.json({ friends })
  } catch (error) {
    console.error("Get friends error:", error)
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

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { message: "Email is required" },
        { status: 400 }
      )
    }

    const friendUser = await prisma.user.findUnique({
      where: { email },
    })

    if (!friendUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    if (friendUser.id === session.user.id) {
      return NextResponse.json(
        { message: "Cannot add yourself as friend" },
        { status: 400 }
      )
    }

    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: session.user.id, user2Id: friendUser.id },
          { user1Id: friendUser.id, user2Id: session.user.id },
        ],
      },
    })

    if (existingFriendship) {
      return NextResponse.json(
        { message: "Friendship already exists" },
        { status: 400 }
      )
    }

    const friendship = await prisma.friendship.create({
      data: {
        user1Id: session.user.id,
        user2Id: friendUser.id,
        status: "ACCEPTED",
      },
      include: {
        user2: {
          select: { id: true, name: true, email: true, image: true, status: true },
        },
      },
    })

    return NextResponse.json({ friend: friendship.user2 }, { status: 201 })
  } catch (error) {
    console.error("Add friend error:", error)
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
    const friendId = searchParams.get("friendId")

    if (!friendId) {
      return NextResponse.json({ message: "Friend ID required" }, { status: 400 })
    }

    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { user1Id: session.user.id, user2Id: friendId },
          { user1Id: friendId, user2Id: session.user.id },
        ],
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete friend error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
