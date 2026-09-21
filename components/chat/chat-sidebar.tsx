"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { UserAvatar } from "./user-avatar"
import { cn } from "@/lib/utils"
import { useConfirm, useToast } from "@/components/ui/confirm-dialog"
import { sound } from "@/lib/sound"
import {
  MessageSquare,
  Users,
  Hash,
  Volume2,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Camera,
  FolderPlus,
  Compass,
  UserPlus,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Friend {
  id: string
  name: string | null
  email: string
  image: string | null
  status?: "ONLINE" | "IDLE" | "DND" | "OFFLINE"
}

interface VoiceMember {
  id: string
  name: string | null
  image: string | null
  status: "ONLINE" | "IDLE" | "DND" | "OFFLINE"
}

interface Channel {
  id: string
  name: string
  type: "TEXT" | "VOICE" | "VIDEO"
  categoryId?: string | null
}

interface ChannelCategory {
  id: string
  name: string
  channels: Channel[]
}

interface Group {
  id: string
  name: string
  image: string | null
  creatorId: string
  members: any[]
  categories?: ChannelCategory[]
  unassignedChannels?: Channel[]
}

interface SidebarProps {
  friends: Friend[]
  groups: Group[]
  selectedChat: {
    type: "friend" | "group" | "channel"
    id: string
    groupId?: string
    channelName?: string
    channelType?: "TEXT" | "VOICE" | "VIDEO"
  } | null
  onSelectChat: (
    type: "friend" | "group" | "channel",
    id: string,
    groupId?: string,
    channelName?: string,
    channelType?: "TEXT" | "VOICE" | "VIDEO"
  ) => void
  onRefreshGroup?: (groupId: string) => void
  onDeleteFriend?: (friendId: string) => void
  onDeleteGroup?: (groupId: string) => void
  onDeleteChannel?: (groupId: string, channelId: string) => void
  onDeleteCategory?: (groupId: string, categoryId: string) => void
  onUpdateServerImage?: (groupId: string, file: File) => void
  currentUserId: string
  friendsLoading?: boolean
  groupsLoading?: boolean
}

export function ChatSidebar({
  friends,
  groups,
  selectedChat,
  onSelectChat,
  onRefreshGroup,
  onDeleteFriend,
  onDeleteGroup,
  onDeleteChannel,
  onDeleteCategory,
  onUpdateServerImage,
  currentUserId,
  friendsLoading = false,
  groupsLoading = false,
}: SidebarProps) {
  const confirm = useConfirm()
  const toast = useToast()

  const [activeTab, setActiveTab] = useState<"friends" | "groups">("friends")
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [newChannelName, setNewChannelName] = useState("")
  const [newChannelType, setNewChannelType] = useState<"TEXT" | "VOICE">("TEXT")
  const [targetCategoryId, setTargetCategoryId] = useState<string | null>(null)
  const [channelDialogOpen, setChannelDialogOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviting, setInviting] = useState(false)
  const [voiceMembers, setVoiceMembers] = useState<Record<string, VoiceMember[]>>({})

  const serverImageRef = useRef<HTMLInputElement>(null)

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null
  const isOwner = selectedGroup ? selectedGroup.creatorId === currentUserId : false

  useEffect(() => {
    if (!selectedGroup) return

    const voiceChannels = [
      ...(selectedGroup.unassignedChannels || []),
      ...(selectedGroup.categories?.flatMap((category) => category.channels) || []),
    ].filter((channel) => channel.type === "VOICE")

    if (voiceChannels.length === 0) {
      setVoiceMembers({})
      return
    }

    let active = true
    const fetchVoiceMembers = async () => {
      const entries = await Promise.all(
        voiceChannels.map(async (channel) => {
          try {
            const response = await fetch(`/api/channels/${channel.id}/voice-members`, { cache: "no-store" })
            if (!response.ok) return [channel.id, []] as const
            const data = await response.json()
            return [channel.id, data.members as VoiceMember[]] as const
          } catch {
            return [channel.id, []] as const
          }
        })
      )

      if (active) setVoiceMembers(Object.fromEntries(entries))
    }

    fetchVoiceMembers()
    const interval = window.setInterval(fetchVoiceMembers, 10_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [selectedGroup])

  const renderVoiceMembers = (channelId: string, selected: boolean) => {
    const members = voiceMembers[channelId] || []
    if (members.length === 0) return null

    return (
      <div className="flex shrink-0 -space-x-1.5" title={`${members.length} member${members.length === 1 ? "" : "s"} in voice`}>
        {members.slice(0, 3).map((member) => (
          <UserAvatar
            key={member.id}
            name={member.name}
            image={member.image}
            status={member.status}
            className={cn("h-5 w-5 border-2", selected ? "border-blue-600" : "border-zinc-50 dark:border-zinc-950")}
          />
        ))}
        {members.length > 3 && (
          <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border-2 text-[9px] font-bold", selected ? "border-blue-600 bg-blue-700 text-white" : "border-zinc-50 bg-zinc-200 text-zinc-600 dark:border-zinc-950 dark:bg-zinc-700 dark:text-zinc-200")}>
            +{members.length - 3}
          </span>
        )}
      </div>
    )
  }

  const toggleCategory = (catId: string) => {
    sound.click()
    setCollapsedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }))
  }

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedGroup || !newChannelName.trim()) return

    sound.click()
    try {
      const res = await fetch(`/api/groups/${selectedGroup.id}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newChannelName.toLowerCase().replace(/\s+/g, "-"),
          type: newChannelType,
          categoryId: targetCategoryId,
        }),
      })

      if (res.ok) {
        setNewChannelName("")
        setChannelDialogOpen(false)
        toast("Channel created", "success")
        if (onRefreshGroup) onRefreshGroup(selectedGroup.id)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedGroup || !newCategoryName.trim()) return

    sound.click()
    try {
      const res = await fetch(`/api/groups/${selectedGroup.id}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.toUpperCase() }),
      })

      if (res.ok) {
        setNewCategoryName("")
        setCategoryDialogOpen(false)
        toast("Category created", "success")
        if (onRefreshGroup) onRefreshGroup(selectedGroup.id)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedGroup || !inviteEmail.trim() || inviting) return

    setInviting(true)
    try {
      const response = await fetch(`/api/groups/${selectedGroup.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      })
      const data = await response.json()

      if (!response.ok) {
        toast(data.message || "Failed to invite friend", "error")
        return
      }

      setInviteEmail("")
      setInviteDialogOpen(false)
      toast("Friend invited to the server", "success")
      onRefreshGroup?.(selectedGroup.id)
    } catch (error) {
      console.error("Invite member error:", error)
      toast("Something went wrong", "error")
    } finally {
      setInviting(false)
    }
  }

  const handleDeleteFriend = async (e: React.MouseEvent, friendId: string) => {
    e.stopPropagation()
    sound.click()
    const ok = await confirm({
      title: "Remove Friend",
      description: "Are you sure you want to remove this friend? You can always add them back later.",
      confirmLabel: "Remove",
      variant: "danger",
    })
    if (!ok) return

    try {
      const res = await fetch(`/api/friends?friendId=${friendId}`, { method: "DELETE" })
      if (res.ok) {
        toast("Friend removed", "success")
        if (onDeleteFriend) onDeleteFriend(friendId)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteGroup = async (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation()
    sound.click()
    const ok = await confirm({
      title: "Delete Server",
      description: "This will permanently delete this server, all channels, and all messages. This cannot be undone.",
      confirmLabel: "Delete Server",
      variant: "danger",
    })
    if (!ok) return

    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" })
      if (res.ok) {
        setSelectedGroupId(null)
        toast("Server deleted", "success")
        if (onDeleteGroup) onDeleteGroup(groupId)
      } else {
        const data = await res.json()
        toast(data.message || "Failed to delete server", "error")
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteChannel = async (e: React.MouseEvent, groupId: string, channelId: string) => {
    e.stopPropagation()
    sound.click()
    const ok = await confirm({
      title: "Delete Channel",
      description: "All messages in this channel will be lost. Continue?",
      confirmLabel: "Delete",
      variant: "warning",
    })
    if (!ok) return

    try {
      const res = await fetch(`/api/groups/${groupId}/channels?channelId=${channelId}`, { method: "DELETE" })
      if (res.ok) {
        toast("Channel deleted", "success")
        if (onDeleteChannel) onDeleteChannel(groupId, channelId)
        if (onRefreshGroup) onRefreshGroup(groupId)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteCategory = async (e: React.MouseEvent, groupId: string, categoryId: string) => {
    e.stopPropagation()
    sound.click()
    const ok = await confirm({
      title: "Delete Category",
      description: "Channels in this category will become uncategorized.",
      confirmLabel: "Delete",
      variant: "warning",
    })
    if (!ok) return

    try {
      const res = await fetch(`/api/groups/${groupId}/categories?categoryId=${categoryId}`, { method: "DELETE" })
      if (res.ok) {
        toast("Category deleted", "success")
        if (onDeleteCategory) onDeleteCategory(groupId, categoryId)
        if (onRefreshGroup) onRefreshGroup(groupId)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleServerImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedGroup) return
    if (onUpdateServerImage) onUpdateServerImage(selectedGroup.id, file)
    e.target.value = ""
  }

  return (
    <aside className="w-80 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col h-full select-none shrink-0 transition-colors">
      {/* Sidebar Tabs */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 flex gap-1">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            sound.click()
            setActiveTab("friends")
            setSelectedGroupId(null)
          }}
          className={cn(
            "flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer",
            activeTab === "friends"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          )}
        >
          <MessageSquare className="w-4 h-4" />
          Direct Messages
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            sound.click()
            setActiveTab("groups")
          }}
          className={cn(
            "flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer",
            activeTab === "groups"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          )}
        >
          <Users className="w-4 h-4" />
          Servers
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {activeTab === "friends" ? (
          <div className="space-y-1">
            <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Direct Messages ({friends.length})
            </div>

            {friendsLoading ? (
              <div className="space-y-2 p-1 animate-pulse">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-[4.5rem] rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                ))}
              </div>
            ) : friends.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 flex items-center justify-center mx-auto mb-3 text-zinc-400">
                  <Compass className="w-6 h-6" />
                </div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">No friends yet</p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-1">Use Add Friend above to start chatting</p>
              </div>
            ) : (
              friends.map((friend) => {
                const isSelected = selectedChat?.type === "friend" && selectedChat?.id === friend.id
                return (
                  <motion.div
                    key={friend.id}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      sound.click()
                      onSelectChat("friend", friend.id)
                    }}
                    className={cn(
                      "group w-full p-2.5 rounded-xl flex items-center gap-3 transition-all text-left cursor-pointer",
                      isSelected
                        ? "bg-blue-600 text-white shadow-sm font-medium"
                        : "hover:bg-zinc-200/70 dark:hover:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200"
                    )}
                  >
                    <UserAvatar
                      name={friend.name}
                      image={friend.image}
                      status={friend.status || "OFFLINE"}
                      className="h-10 w-10 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate leading-tight">
                        {friend.name || "User"}
                      </div>
                      <div
                        className={cn(
                          "text-xs truncate capitalize mt-0.5",
                          isSelected ? "text-blue-100" : "text-zinc-400 dark:text-zinc-500"
                        )}
                      >
                        {friend.status?.toLowerCase() || "offline"}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteFriend(e, friend.id)}
                      className={cn(
                        "opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all",
                        isSelected
                          ? "hover:bg-blue-700 text-white"
                          : "hover:bg-rose-100 dark:hover:bg-rose-950/50 hover:text-rose-600 text-zinc-400"
                      )}
                      title="Remove Friend"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                )
              })
            )}
          </div>
        ) : !selectedGroup ? (
          <div className="space-y-1">
            <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Joined Servers ({groups.length})
            </div>

            {groupsLoading ? (
              <div className="space-y-2 p-1 animate-pulse">
                {[1, 2].map((item) => (
                  <div key={item} className="h-[4.5rem] rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 flex items-center justify-center mx-auto mb-3 text-zinc-400">
                  <Users className="w-6 h-6" />
                </div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">No servers joined</p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-1">Create your first server to hang out</p>
              </div>
            ) : (
              groups.map((group) => (
                <motion.div
                  key={group.id}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    sound.click()
                    setSelectedGroupId(group.id)
                    if (onRefreshGroup) onRefreshGroup(group.id)
                  }}
                  className="group w-full p-2.5 rounded-xl flex items-center gap-3 transition-all hover:bg-zinc-200/70 dark:hover:bg-zinc-800/60 text-left cursor-pointer"
                >
                  <UserAvatar name={group.name} image={group.image} className="h-10 w-10 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate text-zinc-900 dark:text-zinc-100 leading-tight">
                      {group.name}
                    </div>
                    <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                      {group.members?.length || 1} members
                    </div>
                  </div>
                  {group.creatorId === currentUserId && (
                    <button
                      onClick={(e) => handleDeleteGroup(e, group.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:text-rose-600 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/50 text-zinc-400 transition-all"
                      title="Delete Server"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </motion.div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Server Header Card */}
            <div className="p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 mb-3 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => {
                    sound.click()
                    setSelectedGroupId(null)
                  }}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  ← All Servers
                </button>
                {isOwner && (
                  <button
                    onClick={(e) => handleDeleteGroup(e, selectedGroup.id)}
                    className="text-zinc-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Delete Server"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Server Icon & Title */}
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "relative shrink-0 w-11 h-11 rounded-full overflow-hidden",
                    isOwner && "group cursor-pointer"
                  )}
                  onClick={() => isOwner && serverImageRef.current?.click()}
                >
                  <UserAvatar name={selectedGroup.name} image={selectedGroup.image} className="w-11 h-11" />
                  {isOwner && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black tracking-tight text-zinc-900 dark:text-white truncate">
                    {selectedGroup.name}
                  </h3>
                  {isOwner && (
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Owner
                    </span>
                  )}
                </div>
              </div>
              <input
                type="file"
                ref={serverImageRef}
                onChange={handleServerImageChange}
                accept="image/*"
                className="hidden"
              />

              {/* Actions: Add Category / Channel (owner only) */}
              {isOwner && (
                <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-8 rounded-lg font-semibold dark:bg-zinc-800/80 dark:border-zinc-700"
                    onClick={() => {
                      sound.click()
                      setTargetCategoryId(null)
                      setChannelDialogOpen(true)
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Channel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-8 rounded-lg font-semibold dark:bg-zinc-800/80 dark:border-zinc-700"
                    onClick={() => {
                      sound.click()
                      setCategoryDialogOpen(true)
                    }}
                  >
                    <FolderPlus className="w-3.5 h-3.5 mr-1" /> Category
                  </Button>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full text-xs h-8 rounded-lg font-semibold dark:bg-zinc-800/80 dark:border-zinc-700"
                onClick={() => {
                  sound.click()
                  setInviteDialogOpen(true)
                }}
              >
                <UserPlus className="w-3.5 h-3.5 mr-1" /> Invite Friend
              </Button>
            </div>

            {/* Channels & Categories List */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {/* Unassigned channels */}
              {selectedGroup.unassignedChannels && selectedGroup.unassignedChannels.length > 0 && (
                <div className="space-y-0.5">
                  {selectedGroup.unassignedChannels.map((channel) => {
                    const isSelected = selectedChat?.id === channel.id
                    return (
                      <motion.div
                        key={channel.id}
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => {
                          sound.click()
                          onSelectChat(
                            "channel",
                            channel.id,
                            selectedGroup.id,
                            channel.name,
                            channel.type
                          )
                        }}
                        className={cn(
                          "group w-full px-3 py-2 rounded-xl flex items-center justify-between text-sm transition-all cursor-pointer",
                          isSelected
                            ? "bg-blue-600 text-white font-semibold shadow-sm"
                            : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800/60"
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          {channel.type === "VOICE" ? (
                            <Volume2 className={cn("h-4 w-4 shrink-0", isSelected ? "text-white" : "text-zinc-400")} />
                          ) : (
                            <Hash className={cn("h-4 w-4 shrink-0", isSelected ? "text-white" : "text-zinc-400")} />
                          )}
                          <span className="truncate">{channel.name}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                        {channel.type === "VOICE" && renderVoiceMembers(channel.id, isSelected)}
                        {isOwner && (
                          <button
                            onClick={(e) => handleDeleteChannel(e, selectedGroup.id, channel.id)}
                            className={cn(
                              "opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity",
                              isSelected ? "hover:bg-blue-700 text-white" : "hover:text-rose-600 text-zinc-400"
                            )}
                            title="Delete Channel"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}

              {/* Categorized channels */}
              {selectedGroup.categories?.map((cat) => {
                const isCollapsed = collapsedCategories[cat.id]
                return (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      <button
                        onClick={() => toggleCategory(cat.id)}
                        className="flex items-center gap-1.5 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer truncate"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-3 h-3 shrink-0" />
                        ) : (
                          <ChevronDown className="w-3 h-3 shrink-0" />
                        )}
                        <span className="truncate">{cat.name}</span>
                      </button>
                      {isOwner && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              sound.click()
                              setTargetCategoryId(cat.id)
                              setChannelDialogOpen(true)
                            }}
                            className="hover:text-blue-600 dark:hover:text-blue-400 p-1 rounded"
                            title="Add Channel"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteCategory(e, selectedGroup.id, cat.id)}
                            className="hover:text-rose-600 p-1 rounded text-zinc-400"
                            title="Delete Category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {!isCollapsed && (
                      <div className="space-y-0.5">
                        {cat.channels.map((channel) => {
                          const isSelected = selectedChat?.id === channel.id
                          return (
                            <motion.div
                              key={channel.id}
                              whileHover={{ x: 2 }}
                              whileTap={{ scale: 0.99 }}
                              onClick={() => {
                                sound.click()
                                onSelectChat(
                                  "channel",
                                  channel.id,
                                  selectedGroup.id,
                                  channel.name,
                                  channel.type
                                )
                              }}
                              className={cn(
                                "group w-full px-3 py-2 rounded-xl flex items-center justify-between text-sm transition-all cursor-pointer",
                                isSelected
                                  ? "bg-blue-600 text-white font-semibold shadow-sm"
                                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800/60"
                              )}
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                {channel.type === "VOICE" ? (
                                  <Volume2 className={cn("h-4 w-4 shrink-0", isSelected ? "text-white" : "text-zinc-400")} />
                                ) : (
                                  <Hash className={cn("h-4 w-4 shrink-0", isSelected ? "text-white" : "text-zinc-400")} />
                                )}
                                <span className="truncate">{channel.name}</span>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                              {channel.type === "VOICE" && renderVoiceMembers(channel.id, isSelected)}
                              {isOwner && (
                                <button
                                  onClick={(e) => handleDeleteChannel(e, selectedGroup.id, channel.id)}
                                  className={cn(
                                    "opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity",
                                    isSelected ? "hover:bg-blue-700 text-white" : "hover:text-rose-600 text-zinc-400"
                                  )}
                                  title="Delete Channel"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Channel Create Dialog */}
      <Dialog open={channelDialogOpen} onOpenChange={setChannelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Channel</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateChannel} className="space-y-4">
            <div className="space-y-2">
              <Label>Channel Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={newChannelType === "TEXT" ? "default" : "outline"}
                  onClick={() => {
                    sound.click()
                    setNewChannelType("TEXT")
                  }}
                  className="flex-1 font-semibold"
                >
                  <Hash className="w-4 h-4 mr-1" /> Text
                </Button>
                <Button
                  type="button"
                  variant={newChannelType === "VOICE" ? "default" : "outline"}
                  onClick={() => {
                    sound.click()
                    setNewChannelType("VOICE")
                  }}
                  className="flex-1 font-semibold"
                >
                  <Volume2 className="w-4 h-4 mr-1" /> Voice
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chName">Channel Name</Label>
              <Input
                id="chName"
                placeholder="general"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 font-semibold">
              Create Channel
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Create Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="catName">Category Name</Label>
              <Input
                id="catName"
                placeholder="GENERAL DISCUSSIONS"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 font-semibold">
              Create Category
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Friend</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInviteMember} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Friend's email</Label>
              <Input
                id="inviteEmail"
                type="email"
                placeholder="friend@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                disabled={inviting}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 font-semibold"
              disabled={inviting}
            >
              {inviting ? "Inviting..." : "Invite to Server"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
