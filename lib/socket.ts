"use client"

import { useEffect, useState } from "react"
import { io, Socket } from "socket.io-client"

let socket: Socket

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001")

    socket.on("connect", () => {
      setIsConnected(true)
    })

    socket.on("disconnect", () => {
      setIsConnected(false)
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  return { socket, isConnected }
}

export { socket }
