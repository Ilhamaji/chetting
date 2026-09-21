"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { ChatWindow } from "@/components/chat/chat-window"
import { VoiceRoom } from "@/components/chat/voice-room"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/chat/user-avatar"
import { useConfirm, useToast } from "@/components/ui/confirm-dialog"
import { useTheme } from "@/components/providers/theme-provider"
import { sound } from "@/lib/sound"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  UserPlus,
  LogOut,
  Plus,
  Camera,
  Pencil,
  Sun,
  Moon,
  Zap,
  Compass,
  MoreHorizontal,
} from "lucide-react"
import { signOut } from "next-auth/react"
import { CetingIcon } from "@/components/icons/ceting-icon"

interface Friend {
  id: string
  name: string | null
  email: string
  image: string | null
  status?: "ONLINE" | "IDLE" | "DND" | "OFFLINE"
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
  description: string | null
  creatorId: string
  members: any[]
  categories?: ChannelCategory[]
  unassignedChannels?: Channel[]
}

export default function ChatPage() {
  const router = useRouter()
  const { data: session, status, update: updateSession } = useSession()
  const confirm = useConfirm()
  const toast = useToast()
  const { theme, toggleTheme } = useTheme()

  const [friends, setFriends] = useState<Friend[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [friendsLoading, setFriendsLoading] = useState(true)
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [userStatus, setUserStatus] = useState<"ONLINE" | "IDLE" | "DND" | "OFFLINE">("ONLINE")
  const [selectedChat, setSelectedChat] = useState<{
    type: "friend" | "group" | "channel"
    id: string
    groupId?: string
    channelName?: string
    channelType?: "TEXT" | "VOICE" | "VIDEO"
  } | null>(null)

  const [addFriendEmail, setAddFriendEmail] = useState("")
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupDescription, setNewGroupDescription] = useState("")
  const [addFriendOpen, setAddFriendOpen] = useState(false)
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [profileUploading, setProfileUploading] = useState(false)
  const [editName, setEditName] = useState("")

  const profileFileRef = useRef<HTMLInputElement>(null)

  const updateStatus = async (newStatus: "ONLINE" | "IDLE" | "DND" | "OFFLINE") => {
    setUserStatus(newStatus)
    try {
      await fetch("/api/users/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
    } catch (e) {
      console.error(e)
    }
  }

  const fetchFriends = async () => {
    try {
      const res = await fetch("/api/friends", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setFriends(data.friends)
      }
    } catch (error) {
      console.error("Fetch friends error:", error)
    } finally {
      setFriendsLoading(false)
    }
  }

  const fetchGroups = async () => {
    try {
      const res = await fetch("/api/groups", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setGroups(data.groups)
      }
    } catch (error) {
      console.error("Fetch groups error:", error)
    } finally {
      setGroupsLoading(false)
    }
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
    } else if (status === "authenticated") {
      const initialFetch = window.setTimeout(() => {
        fetchFriends()
        fetchGroups()
        updateStatus("ONLINE")
      }, 0)

      const interval = window.setInterval(() => {
        fetchFriends()
        fetchGroups()
      }, 3000)

      return () => {
        window.clearTimeout(initialFetch)
        window.clearInterval(interval)
      }
    }
  }, [status, router])

  const fetchGroupDetails = async (groupId: string) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/channels`)
      if (res.ok) {
        const data = await res.json()
        setGroups((prev) =>
          prev.map((g) =>
            g.id === groupId
              ? {
                  ...g,
                  categories: data.categories,
                  unassignedChannels: data.unassignedChannels,
                }
              : g
          )
        )
      }
    } catch (error) {
      console.error("Fetch channels error:", error)
    }
  }

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addFriendEmail.trim()) return

    sound.click()
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addFriendEmail }),
      })

      if (res.ok) {
        const data = await res.json()
        setFriends([...friends, data.friend])
        setAddFriendEmail("")
        setAddFriendOpen(false)
        toast("Friend added!", "success")
      } else {
        const data = await res.json()
        toast(data.message || "Failed to add friend", "error")
      }
    } catch (error) {
      toast("Something went wrong", "error")
    }
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGroupName.trim()) return

    sound.click()
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGroupName,
          description: newGroupDescription || null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setGroups([...groups, data.group])
        setNewGroupName("")
        setNewGroupDescription("")
        setCreateGroupOpen(false)
        toast("Server created!", "success")
      } else {
        const data = await res.json()
        toast(data.message || "Failed to create server", "error")
      }
    } catch (error) {
      toast("Something went wrong", "error")
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editName.trim()) return

    setProfileUploading(true)
    try {
      const profileRes = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      })

      if (profileRes.ok) {
        const data = await profileRes.json()
        await updateSession({ name: data.user.name })
        toast("Profile updated!", "success")
        setProfileDialogOpen(false)
      } else {
        const data = await profileRes.json()
        toast(data.message || "Failed to update profile", "error")
      }
    } catch (err) {
      toast("Something went wrong", "error")
    } finally {
      setProfileUploading(false)
    }
  }

  const handleProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setProfileUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })

      if (!uploadRes.ok) {
        toast("Upload failed", "error")
        return
      }
      const { fileUrl } = await uploadRes.json()

      const profileRes = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: fileUrl }),
      })

      if (profileRes.ok) {
        await updateSession({ image: fileUrl })
        toast("Profile photo updated!", "success")
      } else {
        toast("Failed to update profile", "error")
      }
    } catch (err) {
      toast("Something went wrong", "error")
    } finally {
      setProfileUploading(false)
    }
  }

  const handleUpdateServerImage = async (groupId: string, file: File) => {
    try {
      const formData = new FormData()
      formData.append("file", file)
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })

      if (!uploadRes.ok) {
        toast("Upload failed", "error")
        return
      }
      const { fileUrl } = await uploadRes.json()

      const patchRes = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: fileUrl }),
      })

      if (patchRes.ok) {
        setGroups((prev) =>
          prev.map((g) => (g.id === groupId ? { ...g, image: fileUrl } : g))
        )
        toast("Server icon updated!", "success")
      } else {
        const data = await patchRes.json()
        toast(data.message || "Failed to update server icon", "error")
      }
    } catch (err) {
      toast("Something went wrong", "error")
    }
  }

  const handleDeleteFriendState = (friendId: string) => {
    setFriends((prev) => prev.filter((f) => f.id !== friendId))
    if (selectedChat?.type === "friend" && selectedChat.id === friendId) {
      setSelectedChat(null)
    }
  }

  const handleDeleteGroupState = (groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId))
    if (
      (selectedChat?.type === "group" && selectedChat.id === groupId) ||
      (selectedChat?.type === "channel" && selectedChat.groupId === groupId)
    ) {
      setSelectedChat(null)
    }
  }

  const handleDeleteChannelState = (groupId: string, channelId: string) => {
    if (selectedChat?.type === "channel" && selectedChat.id === channelId) {
      setSelectedChat(null)
    }
  }

  const handleDeleteCategoryState = (groupId: string, categoryId: string) => {
    fetchGroupDetails(groupId)
  }

  const handleSelectChat = (
    type: "friend" | "group" | "channel",
    id: string,
    groupId?: string,
    channelName?: string,
    channelType?: "TEXT" | "VOICE" | "VIDEO"
  ) => {
    setSelectedChat({ type, id, groupId, channelName, channelType })
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <div className="w-11 h-11 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-zinc-500 dark:text-zinc-400 text-sm font-semibold">Loading app...</p>
        </div>
      </div>
    )
  }

  if (!session?.user) {
    return null
  }

  const selectedFriend =
    selectedChat?.type === "friend"
      ? friends.find((f) => f.id === selectedChat.id)
      : null

  const selectedGroup =
    selectedChat?.type === "group" || selectedChat?.type === "channel"
      ? groups.find((g) => g.id === (selectedChat.groupId || selectedChat.id))
      : null

  return (
    <div className="app-shell flex flex-col bg-zinc-50 dark:bg-zinc-950 transition-colors">
      {/* App Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-5 py-3 flex items-center justify-between shadow-2xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-amber-100 to-amber-200/80 dark:from-amber-950/50 dark:to-amber-900/30 border border-amber-300/60 dark:border-amber-700/40 p-1 flex items-center justify-center shadow-md shadow-amber-500/10">
            <CetingIcon size={30} className="drop-shadow-xs" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">
              Cheting
            </h1>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest">
              Real-time Chat
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Add Friend Dialog */}
          <Dialog open={addFriendOpen} onOpenChange={setAddFriendOpen}>
            <DialogTrigger asChild>
              <motion.div className="hidden sm:block" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs h-9 px-4 font-semibold dark:border-zinc-700 dark:hover:bg-zinc-800 cursor-pointer"
                  onClick={() => sound.click()}
                >
                  <UserPlus className="w-4 h-4" />
                  Add Friend
                </Button>
              </motion.div>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold">Add Friend</DialogTitle>
                <DialogDescription>
                  Enter your friend's email address to connect.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddFriend} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-semibold">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="friend@example.com"
                    value={addFriendEmail}
                    onChange={(e) => setAddFriendEmail(e.target.value)}
                    required
                    className="h-10"
                  />
                </div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 font-bold h-10">
                  Send Request
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Create Server Dialog */}
          <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
            <DialogTrigger asChild>
              <motion.div className="hidden sm:block" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  size="sm"
                  className="gap-2 text-xs h-9 px-4 bg-blue-600 hover:bg-blue-700 font-bold shadow-lg shadow-blue-600/20 cursor-pointer"
                  onClick={() => sound.click()}
                >
                  <Plus className="w-4 h-4" />
                  Create Server
                </Button>
              </motion.div>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold">Create Server</DialogTitle>
                <DialogDescription>
                  Your server is where you and your friends hang out.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="groupName" className="font-semibold">Server Name</Label>
                  <Input
                    id="groupName"
                    type="text"
                    placeholder="Gaming Club"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    required
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="groupDescription" className="font-semibold">Description (Optional)</Label>
                  <Input
                    id="groupDescription"
                    type="text"
                    placeholder="What's this server about?"
                    value={newGroupDescription}
                    onChange={(e) => setNewGroupDescription(e.target.value)}
                    className="h-10"
                  />
                </div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 font-bold h-10">
                  Create Server
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Theme Toggle */}
          <motion.div className="hidden sm:block" whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                sound.click()
                toggleTheme()
              }}
              className="h-9 w-9 dark:border-zinc-700 cursor-pointer"
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>
          </motion.div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="sm:hidden h-9 w-9 dark:border-zinc-700" title="More actions">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 p-2">
              <DropdownMenuItem onClick={() => { sound.click(); setAddFriendOpen(true) }} className="font-semibold">
                <UserPlus className="w-4 h-4" /> Add Friend
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { sound.click(); setCreateGroupOpen(true) }} className="font-semibold">
                <Plus className="w-4 h-4" /> Create Server
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { sound.click(); toggleTheme() }} className="font-semibold">
                {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                {theme === "light" ? "Dark Mode" : "Light Mode"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Settings Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button variant="ghost" className="p-0.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer">
                  <UserAvatar
                    name={session.user.name}
                    image={session.user.image}
                    status={userStatus}
                    className="h-9 w-9"
                  />
                </Button>
              </motion.div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 p-2">
              <DropdownMenuLabel className="px-3 py-2">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-bold">{session.user.name}</p>
                  <p className="text-xs text-zinc-400">{session.user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* Edit Profile */}
              <DropdownMenuItem
                onClick={() => {
                  sound.click()
                  setEditName(session.user.name || "")
                  setProfileDialogOpen(true)
                }}
                className="px-3 py-2 font-semibold cursor-pointer"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />

              {/* Status Picker */}
              <DropdownMenuLabel className="text-[10px] text-zinc-400 uppercase font-bold px-3 py-1.5">
                Set Presence
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => { sound.click(); updateStatus("ONLINE") }} className="px-3 py-1.5 font-medium cursor-pointer">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2.5" /> Online
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { sound.click(); updateStatus("IDLE") }} className="px-3 py-1.5 font-medium cursor-pointer">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-2.5" /> Idle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { sound.click(); updateStatus("DND") }} className="px-3 py-1.5 font-medium cursor-pointer">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-2.5" /> Do Not Disturb
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { sound.click(); updateStatus("OFFLINE") }} className="px-3 py-1.5 font-medium cursor-pointer">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 mr-2.5" /> Invisible
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/40 px-3 py-2 font-semibold cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Profile Edit Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Edit Profile</DialogTitle>
            <DialogDescription>
              Update your display name and profile picture.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateProfile} className="space-y-5 pt-1">
            {/* Avatar upload */}
            <div className="flex flex-col items-center gap-3">
              <div
                className="relative group cursor-pointer w-24 h-24 rounded-full overflow-hidden shrink-0"
                onClick={() => profileFileRef.current?.click()}
              >
                <UserAvatar
                  name={editName || session.user.name}
                  image={session.user.image}
                  className="w-24 h-24 text-3xl"
                />
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Click avatar to change photo</p>
              <input
                type="file"
                ref={profileFileRef}
                onChange={handleProfilePhotoChange}
                accept="image/*"
                className="hidden"
              />
            </div>

            {/* Display Name input */}
            <div className="space-y-2">
              <Label htmlFor="editDisplayName" className="font-semibold">Display Name</Label>
              <Input
                id="editDisplayName"
                type="text"
                placeholder="Your name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                disabled={profileUploading}
                className="h-10"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 font-bold h-10"
              disabled={profileUploading || !editName.trim()}
            >
              {profileUploading ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Main Container */}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className={selectedChat ? "hidden md:block shrink-0" : "block w-full md:w-80 shrink-0"}>
          <ChatSidebar
          friends={friends}
          groups={groups}
          selectedChat={selectedChat}
          onSelectChat={handleSelectChat}
          onRefreshGroup={fetchGroupDetails}
          onDeleteFriend={handleDeleteFriendState}
          onDeleteGroup={handleDeleteGroupState}
          onDeleteChannel={handleDeleteChannelState}
          onDeleteCategory={handleDeleteCategoryState}
          onUpdateServerImage={handleUpdateServerImage}
          currentUserId={session.user.id}
          friendsLoading={friendsLoading}
          groupsLoading={groupsLoading}
          />
        </div>

        {selectedChat ? (
          selectedChat.type === "friend" && selectedFriend ? (
            <ChatWindow
              type="friend"
              recipientId={selectedFriend.id}
              currentUserId={session.user.id}
              title={selectedFriend.name || "User"}
              avatar={selectedFriend.image}
              onBack={() => setSelectedChat(null)}
            />
          ) : selectedChat.type === "channel" ? (
            selectedChat.channelType === "VOICE" ? (
              <VoiceRoom
                channelId={selectedChat.id}
                channelName={selectedChat.channelName || "Voice Channel"}
                groupId={selectedChat.groupId}
                currentUserId={session.user.id}
                currentUserName={session.user.name || "User"}
                currentUserImage={session.user.image}
                onLeave={() => setSelectedChat(null)}
              />
            ) : (
              <ChatWindow
                type="channel"
                channelId={selectedChat.id}
                groupId={selectedChat.groupId}
                currentUserId={session.user.id}
                title={selectedChat.channelName || "channel"}
                onBack={() => setSelectedChat(null)}
              />
            )
          ) : selectedChat.type === "group" && selectedGroup ? (
            <ChatWindow
              type="group"
              groupId={selectedGroup.id}
              currentUserId={session.user.id}
              title={selectedGroup.name}
              avatar={selectedGroup.image}
              onBack={() => setSelectedChat(null)}
            />
          ) : null
        ) : (
          <div className="flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900/30 transition-colors">
            <div className="text-center p-8 max-w-sm">
              <div className="bg-gradient-to-b from-amber-100 to-amber-200/80 dark:from-amber-950/50 dark:to-amber-900/30 border border-amber-300/60 dark:border-amber-700/40 p-4 rounded-2xl shadow-xl shadow-amber-500/10 mx-auto mb-5 w-20 h-20 flex items-center justify-center">
                <CetingIcon size={52} className="drop-shadow-sm" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                Welcome to Cheting
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Select a friend for direct messages or choose a server channel to start chatting.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
