import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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
    const { email } = await request.json()
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""

    if (!normalizedEmail) {
      return NextResponse.json({ message: "Email is required" }, { status: 400 })
    }

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.user.id } },
    })
    if (!membership) {
      return NextResponse.json({ message: "You are not a member of this server" }, { status: 403 })
    }

    const invitedUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, email: true, image: true, status: true },
    })
    if (!invitedUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }
    if (invitedUser.id === session.user.id) {
      return NextResponse.json({ message: "You are already in this server" }, { status: 400 })
    }

    const friendship = await prisma.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { user1Id: session.user.id, user2Id: invitedUser.id },
          { user1Id: invitedUser.id, user2Id: session.user.id },
        ],
      },
    })
    if (!friendship) {
      return NextResponse.json({ message: "You can only invite an accepted friend" }, { status: 403 })
    }

    const existingMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: invitedUser.id } },
    })
    if (existingMember) {
      return NextResponse.json({ message: "This friend is already in the server" }, { status: 400 })
    }

    await prisma.groupMember.create({
      data: { groupId, userId: invitedUser.id, role: "MEMBER" },
    })

    return NextResponse.json({ member: invitedUser }, { status: 201 })
  } catch (error) {
    console.error("Invite server member error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}