import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientKey, isRateLimited } from "@/lib/security"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }
    if (isRateLimited(getClientKey(request, `upload:${session.user.id}`), 20, 60 * 60_000)) {
      return NextResponse.json({ message: "Upload limit exceeded" }, { status: 429 })
    }

    const data = await request.formData()
    const file: File | null = data.get("file") as unknown as File

    if (!file) {
      return NextResponse.json({ message: "No file provided" }, { status: 400 })
    }

    const allowedMimeTypes = new Set([
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "audio/mpeg", "audio/ogg", "audio/wav", "video/mp4", "application/pdf",
    ])
    if (!file.type || !allowedMimeTypes.has(file.type) || file.size === 0) {
      return NextResponse.json({ message: "Invalid file" }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ message: "File must be smaller than 10 MB" }, { status: 413 })
    }
    if (file.type.startsWith("image/") && file.size > 1024 * 1024) {
      return NextResponse.json({ message: "Image must be 1 MB or smaller" }, { status: 413 })
    }
    const existingAssets = await prisma.mediaAsset.findMany({
      where: { ownerId: session.user.id },
      select: { data: true },
    })
    const usedBytes = existingAssets.reduce((total, asset) => total + asset.data.length, 0)
    if (usedBytes + file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ message: "Storage quota exceeded" }, { status: 413 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const asset = await prisma.mediaAsset.create({
      data: {
        data: buffer,
        mimeType: file.type,
        fileName: file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180),
        ownerId: session.user.id,
      },
    })

    const fileUrl = `/api/media/${asset.id}`
    let type = "FILE"
    if (file.type.startsWith("image/")) type = "IMAGE"
    else if (file.type.startsWith("video/")) type = "VIDEO"
    else if (file.type.startsWith("audio/")) type = "AUDIO"

    return NextResponse.json({
      fileUrl,
      fileName: file.name,
      fileType: type,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ message: "Upload failed" }, { status: 500 })
  }
}
