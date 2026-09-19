import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { status } = await request.json()
    const validStatuses = ["ONLINE", "IDLE", "DND", "OFFLINE"]

    if (!validStatuses.includes(status)) {
      return NextResponse.json({ message: "Invalid status" }, { status: 400 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        status,
        lastSeen: new Date(),
      },
      select: {
        id: true,
        name: true,
        status: true,
        lastSeen: true,
      },
    })

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error("Update status error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
