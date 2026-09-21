import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { getClientKey, isRateLimited } from "@/lib/security"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    if (isRateLimited(getClientKey(request, "register"), 5, 60 * 60_000)) {
      return NextResponse.json({ message: "Too many registration attempts" }, { status: 429 })
    }
    const contentLength = Number(request.headers.get("content-length") || 0)
    if (contentLength > 16 * 1024) {
      return NextResponse.json({ message: "Request is too large" }, { status: 413 })
    }
    const body = await request.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const password = typeof body.password === "string" ? body.password : ""

    if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 128) {
      return NextResponse.json(
        { message: "Invalid registration details" },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { message: "User already exists" },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    })

    return NextResponse.json(
      { message: "User created successfully", userId: user.id },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}
