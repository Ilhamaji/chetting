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

  const { id } = await params
  const asset = await prisma.mediaAsset.findFirst({
    where: {
      id,
      OR: [
        { ownerId: session.user.id },
        { owner: { sentMessages: { some: { fileUrl: `/api/media/${id}`, recipientId: session.user.id } } } },
        { owner: { sentMessages: { some: { fileUrl: `/api/media/${id}`, group: { members: { some: { userId: session.user.id } } } } } } },
      ],
    },
  })
  if (!asset) {
    return NextResponse.json({ message: "File not found" }, { status: 404 })
  }

  const body = new Uint8Array(asset.data) as unknown as BodyInit

  return new NextResponse(body, {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Disposition": `attachment; filename="${asset.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  })
}