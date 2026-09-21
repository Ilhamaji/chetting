import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const data = await request.formData()
    const file: File | null = data.get("file") as unknown as File

    if (!file) {
      return NextResponse.json({ message: "No file provided" }, { status: 400 })
    }

    if (!file.type || file.size === 0) {
      return NextResponse.json({ message: "Invalid file" }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ message: "File must be smaller than 10 MB" }, { status: 413 })
    }
    if (file.type.startsWith("image/") && file.size > 1024 * 1024) {
      return NextResponse.json({ message: "Image must be 1 MB or smaller" }, { status: 413 })
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
