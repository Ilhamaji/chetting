import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"

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

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadDir = join(process.cwd(), "public", "uploads")
    await mkdir(uploadDir, { recursive: true })

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const filename = `${uniqueSuffix}-${originalName}`
    const filepath = join(uploadDir, filename)

    await writeFile(filepath, buffer)

    const fileUrl = `/uploads/${filename}`
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
