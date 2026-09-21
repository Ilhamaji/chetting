import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getGroupMembership } from "@/lib/security"

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
    const membership = await getGroupMembership(groupId, session.user.id)
    if (!membership) return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    const { name } = await request.json()

    if (typeof name !== "string" || !name.trim() || name.length > 100) {
      return NextResponse.json({ message: "Category name is required" }, { status: 400 })
    }
    if (membership.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

    const count = await prisma.channelCategory.count({ where: { groupId } })

    const category = await prisma.channelCategory.create({
      data: {
        name: name.trim(),
        groupId,
        position: count,
      },
      include: {
        channels: true,
      },
    })

    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    console.error("Create category error:", error)
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
    const categoryId = searchParams.get("categoryId")

    if (!categoryId) {
      return NextResponse.json({ message: "Category ID required" }, { status: 400 })
    }

    const { id: groupId } = await params
    const membership = await getGroupMembership(groupId, session.user.id)
    if (!membership || membership.role !== "ADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }
    const category = await prisma.channelCategory.findFirst({ where: { id: categoryId, groupId } })
    if (!category) return NextResponse.json({ message: "Category not found" }, { status: 404 })
    await prisma.channelCategory.delete({ where: { id: category.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete category error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
