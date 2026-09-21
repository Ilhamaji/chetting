"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { UserAvatar } from "./user-avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Send,
  MoreVertical,
  Paperclip,
  FileText,
  Trash2,
  X,
  Hash,
  Download,
  Image as ImageIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useConfirm, useToast } from "@/components/ui/confirm-dialog"
import { sound } from "@/lib/sound"
import { format } from "date-fns"

interface Message {
  id: string
  content: string
  senderId: string
  createdAt: string
  type: "TEXT" | "IMAGE" | "FILE" | "AUDIO" | "VIDEO"
  fileUrl?: string | null
  sender: {
    id: string
    name: string | null
    email: string
    image: string | null
    status?: "ONLINE" | "IDLE" | "DND" | "OFFLINE"
  }
}

interface ChatWindowProps {
  type: "friend" | "group" | "channel"
  recipientId?: string
  groupId?: string
  channelId?: string
  currentUserId: string
  title: string
  avatar?: string | null
}

export function ChatWindow({
  type,
  recipientId,
  groupId,
  channelId,
  currentUserId,
  title,
  avatar,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<{
    file: File
    previewUrl: string
    type: "IMAGE" | "FILE" | "AUDIO" | "VIDEO"
  } | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const confirm = useConfirm()
  const toast = useToast()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const fetchMessages = async () => {
    try {
      const params = new URLSearchParams()
      if (channelId) params.append("channelId", channelId)
      else if (groupId) params.append("groupId", groupId)
      else if (recipientId) params.append("recipientId", recipientId)

      const res = await fetch(`/api/messages?${params}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages)
      }
    } catch (error) {
      console.error("Fetch messages error:", error)
    }
  }

  useEffect(() => {
    const initialFetch = window.setTimeout(fetchMessages, 0)
    const interval = window.setInterval(fetchMessages, 2000)

    return () => {
      window.clearTimeout(initialFetch)
      window.clearInterval(interval)
    }
  }, [recipientId, groupId, channelId])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    sound.click()
    let fileType: "IMAGE" | "FILE" | "AUDIO" | "VIDEO" = "FILE"
    if (file.type.startsWith("image/")) fileType = "IMAGE"
    else if (file.type.startsWith("video/")) fileType = "VIDEO"
    else if (file.type.startsWith("audio/")) fileType = "AUDIO"

    const previewUrl = URL.createObjectURL(file)
    setSelectedFile({ file, previewUrl, type: fileType })
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!newMessage.trim() && !selectedFile) || loading) return

    setLoading(true)
    let uploadedFileUrl: string | null = null
    let messageType: "TEXT" | "IMAGE" | "FILE" | "AUDIO" | "VIDEO" = "TEXT"

    try {
      if (selectedFile) {
        setUploading(true)
        const formData = new FormData()
        formData.append("file", selectedFile.file)

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json()
          uploadedFileUrl = uploadData.fileUrl
          messageType = selectedFile.type
        }
        setUploading(false)
      }

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newMessage,
          recipientId: recipientId || null,
          groupId: groupId || null,
          channelId: channelId || null,
          fileUrl: uploadedFileUrl,
          type: messageType,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        sound.pop()
        setMessages((prev) => [...prev, data.message])
        setNewMessage("")
        setSelectedFile(null)
      }
    } catch (error) {
      toast("Failed to send message", "error")
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    sound.click()
    const ok = await confirm({
      title: "Delete Message",
      description: "Are you sure you want to delete this message? This cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/messages?messageId=${messageId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast("Message deleted", "success")
        setMessages((prev) => prev.filter((m) => m.id !== messageId))
      }
    } catch (err) {
      console.error("Delete message error:", err)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-100/50 dark:bg-zinc-900/50 relative overflow-hidden select-none">
      {/* Top Header Bar */}
      <div className="px-6 py-3.5 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          {type === "channel" ? (
            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300">
              <Hash className="w-5 h-5" />
            </div>
          ) : (
            <UserAvatar name={title} image={avatar} className="w-9 h-9" />
          )}
          <div>
            <h2 className="font-extrabold text-base text-zinc-900 dark:text-white flex items-center gap-1.5 leading-tight">
              {type === "channel" && <span className="text-zinc-400">#</span>}
              {title}
            </h2>
            <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
              {type === "channel"
                ? "Text Channel"
                : type === "group"
                ? "Server Chat"
                : "Direct Message"}
            </p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-400 mb-3 shadow-xs">
              <Hash className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
              Welcome to #{title}
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-sm">
              This is the start of the #{title} conversation. Send a message to say hello!
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((message, index) => {
              const isOwn = message.senderId === currentUserId
              const showAvatar =
                !isOwn &&
                (index === messages.length - 1 ||
                  messages[index + 1]?.senderId !== message.senderId)

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.15 }}
                  className={cn("group flex gap-3 items-start", isOwn && "flex-row-reverse")}
                >
                  {showAvatar && !isOwn && (
                    <UserAvatar
                      name={message.sender.name}
                      image={message.sender.image}
                      status={message.sender.status}
                      className="h-8 w-8 shrink-0"
                    />
                  )}
                  {!showAvatar && !isOwn && <div className="w-8 shrink-0" />}

                  <div className={cn("max-w-[75%] space-y-1", isOwn && "items-end")}>
                    {!isOwn && (type === "group" || type === "channel") && (
                      <div className="text-xs font-bold text-zinc-600 dark:text-zinc-400 px-1">
                        {message.sender.name || "User"}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {isOwn && (
                        <button
                          onClick={() => handleDeleteMessage(message.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:text-rose-600 rounded-lg text-zinc-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                          title="Delete Message"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2.5 shadow-2xs text-sm break-words select-text",
                          isOwn
                            ? "bg-blue-600 text-white rounded-br-xs font-normal"
                            : "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700/60 rounded-bl-xs"
                        )}
                      >
                        {/* Attachments */}
                        {message.fileUrl && (
                          <div className="mb-2 overflow-hidden rounded-xl">
                            {message.type === "IMAGE" ? (
                              <img
                                src={message.fileUrl}
                                alt="Attachment"
                                className="max-h-72 max-w-full rounded-xl object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                onClick={() => window.open(message.fileUrl || "", "_blank")}
                              />
                            ) : message.type === "VIDEO" ? (
                              <video
                                src={message.fileUrl}
                                controls
                                className="max-h-72 rounded-xl"
                              />
                            ) : message.type === "AUDIO" ? (
                              <audio src={message.fileUrl} controls className="w-full" />
                            ) : (
                              <a
                                href={message.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={cn(
                                  "flex items-center gap-2 p-2.5 rounded-lg text-xs font-medium transition-colors",
                                  isOwn
                                    ? "bg-blue-700 hover:bg-blue-800 text-white"
                                    : "bg-zinc-100 dark:bg-zinc-700/60 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200"
                                )}
                              >
                                <FileText className="w-4 h-4" />
                                <span>Download File</span>
                                <Download className="w-3.5 h-3.5 ml-auto opacity-70" />
                              </a>
                            )}
                          </div>
                        )}

                        {message.content && <p className="leading-relaxed">{message.content}</p>}
                      </div>
                    </div>

                    <div
                      className={cn(
                        "text-[10px] font-medium text-zinc-400 dark:text-zinc-500 px-1",
                        isOwn && "text-right"
                      )}
                    >
                      {format(new Date(message.createdAt), "HH:mm")}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Attachment Preview bar */}
      {selectedFile && (
        <div className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            {selectedFile.type === "IMAGE" ? (
              <img
                src={selectedFile.previewUrl}
                alt="Upload preview"
                className="w-11 h-11 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700"
              />
            ) : (
              <div className="w-11 h-11 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <FileText className="w-5 h-5" />
              </div>
            )}
            <div>
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate max-w-xs block">
                {selectedFile.file.name}
              </span>
              <span className="text-[10px] text-zinc-400 uppercase font-semibold">
                {selectedFile.type}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              sound.click()
              setSelectedFile(null)
            }}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
        <form onSubmit={sendMessage} className="flex items-center gap-2 max-w-5xl mx-auto">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                sound.click()
                fileInputRef.current?.click()
              }}
              className="h-10 w-10 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 dark:border-zinc-700 rounded-xl shrink-0 cursor-pointer"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
          </motion.div>

          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={
              type === "channel"
                ? `Message #${title}`
                : `Message ${title}...`
            }
            className="flex-1 bg-zinc-50 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/80 rounded-xl h-10 text-sm focus-visible:ring-2 focus-visible:ring-blue-600 font-medium"
            disabled={loading || uploading}
          />

          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}>
            <Button
              type="submit"
              disabled={loading || uploading || (!newMessage.trim() && !selectedFile)}
              className="bg-blue-600 hover:bg-blue-700 h-10 px-4 rounded-xl text-white font-bold shrink-0 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </Button>
          </motion.div>
        </form>
      </div>
    </div>
  )
}
