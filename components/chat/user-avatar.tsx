"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface UserAvatarProps {
  name?: string | null
  image?: string | null
  className?: string
  status?: "ONLINE" | "IDLE" | "DND" | "OFFLINE"
  speaking?: boolean
}

export function UserAvatar({ name, image, className, status, speaking }: UserAvatarProps) {
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U"

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 aspect-square overflow-visible rounded-full",
        speaking && "avatar-speaking",
        className
      )}
    >
      <Avatar className="h-full w-full overflow-hidden rounded-full">
        <AvatarImage src={image || undefined} alt={name || "User"} className="object-cover" />
        <AvatarFallback className="bg-blue-600 text-white font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>
      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900",
            status === "ONLINE" && "bg-emerald-500",
            status === "IDLE" && "bg-amber-500",
            status === "DND" && "bg-rose-500",
            status === "OFFLINE" && "bg-zinc-400"
          )}
        />
      )}
    </div>
  )
}
