"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { UserAvatar } from "./user-avatar"
import { Button } from "@/components/ui/button"
import {
  Mic,
  MicOff,
  Headphones,
  Video,
  VideoOff,
  ScreenShare,
  PhoneOff,
  Volume2,
  Signal,
  Radio,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useConfirm, useToast } from "@/components/ui/confirm-dialog"
import { sound } from "@/lib/sound"

interface VoiceMember {
  id: string
  name: string | null
  image: string | null
  status: "ONLINE" | "IDLE" | "DND" | "OFFLINE"
}

interface VoiceRoomProps {
  channelId: string
  channelName: string
  groupId?: string
  currentUserId: string
  currentUserName: string
  currentUserImage?: string | null
  onLeave?: () => void
}

export function VoiceRoom({
  channelId,
  channelName,
  currentUserId,
  currentUserName,
  currentUserImage,
  onLeave,
}: VoiceRoomProps) {
  const toast = useToast()
  const confirm = useConfirm()
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [mediaAction, setMediaAction] = useState<"camera" | "screen" | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [ping] = useState(24)
  const [connectedTime, setConnectedTime] = useState(0)
  const [members, setMembers] = useState<VoiceMember[]>([])
  const [mediaReady, setMediaReady] = useState(false)
  const [mediaError, setMediaError] = useState(false)
  const [mediaAttempt, setMediaAttempt] = useState(0)
  const [presenceReady, setPresenceReady] = useState(false)
  const [presenceError, setPresenceError] = useState(false)
  const [presenceAttempt, setPresenceAttempt] = useState(0)
  const [peerStates, setPeerStates] = useState<Record<string, RTCPeerConnectionState>>({})
  const [remoteSpeakingIds, setRemoteSpeakingIds] = useState<string[]>([])
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
  const [remoteVideoActive, setRemoteVideoActive] = useState<Record<string, boolean>>({})

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const screenVideoRef = useRef<HTMLVideoElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const videoStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const remoteAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const remoteAnalyserRef = useRef<Map<string, AnalyserNode>>(new Map())
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())
  const videoSendersRef = useRef<Map<string, RTCRtpSender>>(new Map())
  const reconnectTimersRef = useRef<Map<string, number>>(new Map())
  const peerTimeoutsRef = useRef<Map<string, number>>(new Map())
  const reconnectAttemptsRef = useRef<Map<string, number>>(new Map())
  const leavingRef = useRef(false)
  const presenceControllerRef = useRef<AbortController | null>(null)
  const presenceInFlightRef = useRef(false)
  const presenceFailuresRef = useRef(0)

  const remoteMemberIds = members
    .filter((member) => member.id !== currentUserId)
    .map((member) => member.id)
  const voiceStatus = mediaError
    ? "error"
    : presenceError
    ? "presence-error"
    : !mediaReady
    ? "requesting"
    : !presenceReady
    ? "connecting"
    : "connected"
  const remoteConnectionPending = remoteMemberIds.some(
    (peerId) => ["new", "connecting", "checking"].includes(peerStates[peerId])
  )
  const remoteConnectionFailed = remoteMemberIds.some(
    (peerId) => ["failed", "disconnected", "closed"].includes(peerStates[peerId])
  )

  const attachStream = (video: HTMLVideoElement | null, stream: MediaStream | null) => {
    if (!video) return
    if (video.srcObject !== stream) {
      video.srcObject = stream
    }
    if (stream) {
      video.play().catch(() => {})
    }
  }

  useEffect(() => {
    let active = true
    leavingRef.current = false

    const updatePresence = async () => {
      if (!active || leavingRef.current || presenceInFlightRef.current) return
      presenceInFlightRef.current = true
      const controller = new AbortController()
      presenceControllerRef.current = controller
      const timeoutId = window.setTimeout(() => controller.abort(), 20_000)
      try {
        const response = await fetch(`/api/channels/${channelId}/voice-members`, {
          method: "PUT",
          cache: "no-store",
          signal: controller.signal,
        })
        if (!response.ok || !active || leavingRef.current) {
          throw new Error(`Voice presence request failed with status ${response.status}`)
        }
        const data = await response.json()
        setMembers(data.members)
        setPresenceReady(true)
        setPresenceError(false)
        presenceFailuresRef.current = 0
      } catch (error) {
        presenceFailuresRef.current += 1
        if (active && !leavingRef.current && presenceFailuresRef.current >= 3) {
          setPresenceError(true)
        }
        if (!(error instanceof DOMException && error.name === "AbortError") && active) {
          console.error("Update voice presence error:", error)
        }
      } finally {
        window.clearTimeout(timeoutId)
        presenceInFlightRef.current = false
        presenceControllerRef.current = null
      }
    }

    sound.join()
    updatePresence()
    const interval = window.setInterval(updatePresence, 5_000)

    return () => {
      active = false
      leavingRef.current = true
      presenceControllerRef.current?.abort()
      window.clearInterval(interval)
      fetch(`/api/channels/${channelId}/voice-members`, { method: "POST", keepalive: true })
    }
  }, [channelId, presenceAttempt])

  const sendSignal = async (
    recipientId: string,
    type: "offer" | "answer" | "ice-candidate",
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit
  ) => {
    await fetch(`/api/channels/${channelId}/voice-signals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId, type, payload }),
    })
  }

  const closePeer = (peerId: string) => {
    const reconnectTimer = reconnectTimersRef.current.get(peerId)
    if (reconnectTimer) window.clearTimeout(reconnectTimer)
    reconnectTimersRef.current.delete(peerId)
    const peerTimeout = peerTimeoutsRef.current.get(peerId)
    if (peerTimeout) window.clearTimeout(peerTimeout)
    peerTimeoutsRef.current.delete(peerId)
    peersRef.current.get(peerId)?.close()
    peersRef.current.delete(peerId)
    const audio = remoteAudioRef.current.get(peerId)
    audio?.pause()
    if (audio) audio.srcObject = null
    remoteAudioRef.current.delete(peerId)
    remoteAnalyserRef.current.delete(peerId)
    videoSendersRef.current.delete(peerId)
    setPeerStates((previous) => {
      const next = { ...previous }
      delete next[peerId]
      return next
    })
    setRemoteVideoActive((previous) => {
      const next = { ...previous }
      delete next[peerId]
      return next
    })
    setRemoteStreams((previous) => {
      const next = { ...previous }
      delete next[peerId]
      return next
    })
    pendingIceRef.current.delete(peerId)
  }

  const createPeer = (peerId: string, initiator: boolean, iceRestart = false) => {
    const existingPeer = peersRef.current.get(peerId)
    if (existingPeer) return existingPeer

    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
      ],
    })
    peersRef.current.set(peerId, peer)
    setPeerStates((previous) => ({ ...previous, [peerId]: "new" }))
    const timeout = window.setTimeout(() => {
      if (peersRef.current.get(peerId) !== peer || peer.connectionState === "connected") return
      const attempts = reconnectAttemptsRef.current.get(peerId) || 0
      closePeer(peerId)
      if (attempts < 2 && !leavingRef.current) {
        reconnectAttemptsRef.current.set(peerId, attempts + 1)
        createPeer(peerId, currentUserId < peerId, true)
      } else {
        setPeerStates((previous) => ({ ...previous, [peerId]: "failed" }))
      }
    }, 10_000)
    peerTimeoutsRef.current.set(peerId, timeout)

    const audioTrack = mediaStreamRef.current?.getAudioTracks()[0]
    if (audioTrack && mediaStreamRef.current) {
      peer.addTrack(audioTrack, mediaStreamRef.current)
    }
    const videoTransceiver = peer.addTransceiver("video", { direction: "sendrecv" })
    videoSendersRef.current.set(peerId, videoTransceiver.sender)
    const currentVideoTrack = screenStreamRef.current?.getVideoTracks()[0] || videoStreamRef.current?.getVideoTracks()[0]
    const initialVideoReady = currentVideoTrack
      ? videoTransceiver.sender.replaceTrack(currentVideoTrack)
      : Promise.resolve()

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(peerId, "ice-candidate", event.candidate.toJSON()).catch((error) => {
          console.error("Send ICE candidate error:", error)
        })
      }
    }

    peer.ontrack = (event) => {
      const [stream] = event.streams
      if (!stream) return
      setRemoteStreams((previous) => ({ ...previous, [peerId]: stream }))
      if (event.track.kind === "video") {
        const setVideoActive = (active: boolean) => {
          setRemoteVideoActive((previous) => ({ ...previous, [peerId]: active }))
        }
        setVideoActive(event.track.readyState === "live" && !event.track.muted)
        event.track.onunmute = () => setVideoActive(true)
        event.track.onmute = () => setVideoActive(false)
        event.track.onended = () => setVideoActive(false)
      }
      let audio = remoteAudioRef.current.get(peerId)
      if (!audio) {
        audio = new Audio()
        audio.autoplay = true
        audio.volume = 1
        remoteAudioRef.current.set(peerId, audio)
      }
      audio.srcObject = stream
      audio.volume = isDeafened ? 0 : 1
      if (!remoteAnalyserRef.current.has(peerId) && audioContextRef.current) {
        const analyser = audioContextRef.current.createAnalyser()
        analyser.fftSize = 256
        audioContextRef.current.createMediaStreamSource(stream).connect(analyser)
        remoteAnalyserRef.current.set(peerId, analyser)
      }
      audio.play().catch(() => {
        toast("Klik halaman ini untuk mengaktifkan output suara", "error")
      })
    }

    peer.onconnectionstatechange = () => {
      setPeerStates((previous) => ({ ...previous, [peerId]: peer.connectionState }))
      if (peer.connectionState === "connected") {
        reconnectAttemptsRef.current.delete(peerId)
        const reconnectTimer = reconnectTimersRef.current.get(peerId)
        if (reconnectTimer) window.clearTimeout(reconnectTimer)
        reconnectTimersRef.current.delete(peerId)
        const currentTrack = screenStreamRef.current?.getVideoTracks()[0] || videoStreamRef.current?.getVideoTracks()[0] || null
        videoSendersRef.current.get(peerId)?.replaceTrack(currentTrack).catch((error) => {
          console.error("Attach media after connection error:", error)
        })
      }
      if (["failed", "closed", "disconnected"].includes(peer.connectionState)) {
        const timer = window.setTimeout(() => {
          if (peersRef.current.get(peerId) === peer) {
            closePeer(peerId)
            const attempts = reconnectAttemptsRef.current.get(peerId) || 0
            if (attempts < 2 && !leavingRef.current) {
              reconnectAttemptsRef.current.set(peerId, attempts + 1)
              createPeer(peerId, currentUserId < peerId, true)
            }
          }
        }, 750)
        reconnectTimersRef.current.set(peerId, timer)
      }
    }

    if (initiator) {
      initialVideoReady
        .then(() => peer.createOffer({ iceRestart }))
        .then((offer) => peer.setLocalDescription(offer).then(() => offer))
        .then((offer) => sendSignal(peerId, "offer", offer))
        .catch((error) => console.error("Create voice offer error:", error))
    }

    return peer
  }

  const replaceVideoForPeers = async (track: MediaStreamTrack | null) => {
    await Promise.all(
      Array.from(videoSendersRef.current.entries()).map(async ([peerId, sender]) => {
        try {
          await sender.replaceTrack(track)
          const peer = peersRef.current.get(peerId)
          if (peer?.signalingState === "stable") {
            const offer = await peer.createOffer()
            await peer.setLocalDescription(offer)
            await sendSignal(peerId, "offer", offer)
          }
        } catch (error) {
          console.error("Replace video track or renegotiation error:", error)
        }
      })
    )
  }

  useEffect(() => {
    for (const [peerId, video] of remoteVideoRefs.current) {
      const stream = remoteStreams[peerId]
      if (video.srcObject !== stream) video.srcObject = stream || null
    }
  }, [remoteStreams])

  useEffect(() => {
    if (!mediaReady) return

    for (const member of members) {
      if (member.id === currentUserId) continue
      createPeer(member.id, currentUserId < member.id)
    }

    const activePeerIds = new Set(members.map((member) => member.id))
    for (const peerId of peersRef.current.keys()) {
      if (!activePeerIds.has(peerId)) closePeer(peerId)
    }
  }, [members, mediaReady, currentUserId])

  useEffect(() => {
    if (!mediaReady) return
    let active = true

    const pollSignals = async () => {
      try {
        const response = await fetch(`/api/channels/${channelId}/voice-signals`, {
          cache: "no-store",
        })
        if (!response.ok || !active) return
        const { signals } = await response.json()

        for (const signal of signals as Array<{
          senderId: string
          type: "offer" | "answer" | "ice-candidate"
          payload: RTCSessionDescriptionInit | RTCIceCandidateInit
        }>) {
          if (signal.type === "offer") {
            const peer = createPeer(signal.senderId, false)
            await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit)
            const pendingIce = pendingIceRef.current.get(signal.senderId) || []
            for (const candidate of pendingIce) await peer.addIceCandidate(candidate)
            pendingIceRef.current.delete(signal.senderId)
            const answer = await peer.createAnswer()
            await peer.setLocalDescription(answer)
            await sendSignal(signal.senderId, "answer", answer)
          } else if (signal.type === "answer") {
            const peer = peersRef.current.get(signal.senderId)
            if (peer && !peer.currentRemoteDescription) {
              await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit)
            }
          } else {
            const peer = peersRef.current.get(signal.senderId)
            if (peer?.remoteDescription) {
              await peer.addIceCandidate(signal.payload as RTCIceCandidateInit)
            } else {
              const pending = pendingIceRef.current.get(signal.senderId) || []
              pending.push(signal.payload as RTCIceCandidateInit)
              pendingIceRef.current.set(signal.senderId, pending)
            }
          }
        }
      } catch (error) {
        console.error("Poll voice signals error:", error)
      }
    }

    pollSignals()
    const interval = window.setInterval(pollSignals, 100)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [channelId, mediaReady])

  useEffect(() => {
    return () => {
      for (const peerId of peersRef.current.keys()) closePeer(peerId)
    }
  }, [])

  // Timer counter
  useEffect(() => {
    const timer = setInterval(() => {
      setConnectedTime((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Audio level detection using Web Audio API
  useEffect(() => {
    let active = true
    let timedOut = false
    let timeoutId: number | null = null

    async function initAudio() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Microphone access is not supported by this browser")
        }

        const streamPromise = navigator.mediaDevices.getUserMedia({ audio: true })
        const timeoutPromise = new Promise<null>((resolve) => {
          timeoutId = window.setTimeout(() => {
            timedOut = true
            setMediaError(true)
            resolve(null)
          }, 10_000)
        })
        const stream = await Promise.race([streamPromise, timeoutPromise])
        if (!stream) return
        if (!active || timedOut) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        mediaStreamRef.current = stream
        setMediaReady(true)

        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AudioCtx) return
        const audioCtx = new AudioCtx()
        audioContextRef.current = audioCtx
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        const source = audioCtx.createMediaStreamSource(stream)
        source.connect(analyser)

        const dataArray = new Uint8Array(analyser.frequencyBinCount)

        const checkVolume = () => {
          if (!active) return
          analyser.getByteFrequencyData(dataArray)
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i]
          }
          const average = sum / dataArray.length
          setAudioLevel(average)
          setIsSpeaking(!isMuted && average > 16)

          const speakingIds: string[] = []
          for (const [peerId, remoteAnalyser] of remoteAnalyserRef.current) {
            const remoteData = new Uint8Array(remoteAnalyser.frequencyBinCount)
            remoteAnalyser.getByteFrequencyData(remoteData)
            const remoteAverage = remoteData.reduce((total, value) => total + value, 0) / remoteData.length
            if (remoteAverage > 16) speakingIds.push(peerId)
          }
          setRemoteSpeakingIds(speakingIds)
          animationFrameRef.current = requestAnimationFrame(checkVolume)
        }

        checkVolume()
      } catch (err) {
        console.warn("Microphone access unavailable or blocked:", err)
        setMediaError(true)
      } finally {
        if (timeoutId !== null) window.clearTimeout(timeoutId)
      }
    }

    initAudio()

    return () => {
      active = false
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close()
      }
    }
  }, [mediaAttempt])

  useEffect(() => {
    for (const track of mediaStreamRef.current?.getAudioTracks() || []) {
      track.enabled = !isMuted
    }
    for (const audio of remoteAudioRef.current.values()) {
      audio.volume = isDeafened ? 0 : 1
    }
    audioContextRef.current?.resume().catch(() => {})
  }, [isMuted, isDeafened])

  useEffect(() => {
    attachStream(localVideoRef.current, isVideoOn ? videoStreamRef.current : null)
  }, [isVideoOn])

  useEffect(() => {
    attachStream(screenVideoRef.current, isScreenSharing ? screenStreamRef.current : null)
  }, [isScreenSharing])

  const stopStream = (stream: MediaStream | null) => {
    stream?.getTracks().forEach((track) => track.stop())
  }

  const toggleVideo = async () => {
    if (mediaAction) return
    sound.click()
    setMediaAction("camera")
    if (isVideoOn) {
      try {
        stopStream(videoStreamRef.current)
        videoStreamRef.current = null
        await replaceVideoForPeers(screenStreamRef.current?.getVideoTracks()[0] || null)
        attachStream(localVideoRef.current, null)
        setIsVideoOn(false)
      } finally {
        setMediaAction(null)
      }
      return
    }

    try {
      const confirmed = await confirm({
        title: "Turn on camera?",
        description: "Your camera preview will be visible to you and sent to people in this voice channel.",
        confirmLabel: "Turn on camera",
        cancelLabel: "Cancel",
        variant: "info",
      })
      if (!confirmed) return
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      videoStreamRef.current = stream
      await replaceVideoForPeers(stream.getVideoTracks()[0])
      setIsVideoOn(true)
    } catch (err) {
      toast("Could not access camera", "error")
    } finally {
      setMediaAction(null)
    }
  }

  const toggleScreenShare = async () => {
    if (mediaAction) return
    sound.click()
    setMediaAction("screen")
    if (isScreenSharing) {
      try {
        stopStream(screenStreamRef.current)
        screenStreamRef.current = null
        await replaceVideoForPeers(videoStreamRef.current?.getVideoTracks()[0] || null)
        attachStream(screenVideoRef.current, null)
        setIsScreenSharing(false)
      } finally {
        setMediaAction(null)
      }
      return
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const [track] = stream.getVideoTracks()
      track.onended = () => {
        stopStream(screenStreamRef.current)
        screenStreamRef.current = null
        replaceVideoForPeers(videoStreamRef.current?.getVideoTracks()[0] || null).catch((error) => {
          console.error("Restore camera after screen share error:", error)
        })
        attachStream(screenVideoRef.current, null)
        setIsScreenSharing(false)
      }
      screenStreamRef.current = stream
      await replaceVideoForPeers(stream.getVideoTracks()[0])
      setIsScreenSharing(true)
    } catch (err) {
      console.warn("Screen share cancelled", err)
    } finally {
      setMediaAction(null)
    }
  }

  const handleToggleMute = () => {
    if (isMuted) {
      sound.unmute()
      setIsMuted(false)
    } else {
      sound.mute()
      setIsMuted(true)
    }
  }

  const handleToggleDeafen = () => {
    sound.click()
    setIsDeafened((prev) => !prev)
  }

  const handleDisconnect = () => {
    leavingRef.current = true
    presenceControllerRef.current?.abort()
    fetch(`/api/channels/${channelId}/voice-members`, { method: "POST", keepalive: true }).catch(() => {})
    sound.leave()
    if (onLeave) onLeave()
  }

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const remSecs = secs % 60
    return `${mins.toString().padStart(2, "0")}:${remSecs.toString().padStart(2, "0")}`
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 text-zinc-100 select-none">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 bg-zinc-900 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-extrabold tracking-tight text-white">
                {channelName}
              </h2>
              <span className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                voiceStatus === "connected"
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                  : voiceStatus === "error"
                  ? "border-rose-500/30 bg-rose-500/15 text-rose-400"
                  : "border-amber-500/30 bg-amber-500/15 text-amber-400"
              )}>
                {voiceStatus !== "connected" && voiceStatus !== "error" && (
                  <span className="h-2.5 w-2.5 shrink-0 aspect-square animate-spin rounded-full border-2 border-current/30 border-t-current" />
                )}
                {voiceStatus === "connected" ? "Connected" : voiceStatus === "error" ? "Microphone unavailable" : voiceStatus === "requesting" ? "Starting microphone" : "Connecting voice"}
              </span>
            </div>
            <p className="mt-0.5 text-xs font-medium text-zinc-400">
              Voice Room · Elapsed: {formatDuration(connectedTime)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-xl border border-zinc-700/60 bg-zinc-800/80 px-3 py-1.5 text-xs font-semibold text-emerald-400 sm:px-3.5">
          <Signal className="h-3.5 w-3.5 text-emerald-400" />
          <span>RTC OK ({ping}ms)</span>
        </div>
      </div>

      {/* Main Grid: Participant Cards */}
      <div className="relative flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {voiceStatus !== "connected" ? (
          <div className={cn(
            "mx-auto mb-4 flex max-w-5xl flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm",
            voiceStatus === "error" || voiceStatus === "presence-error"
              ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-200"
          )}>
            {voiceStatus !== "error" && <span className="h-4 w-4 shrink-0 aspect-square animate-spin rounded-full border-2 border-current/30 border-t-current" />}
            <span className="min-w-0 flex-1">
              {voiceStatus === "error"
                ? "Microphone access did not finish. Check the browser permission, then try again."
                : voiceStatus === "presence-error"
                ? "Voice server did not respond. Check your connection, then try again."
                : voiceStatus === "requesting"
                ? "Preparing your microphone..."
                : "Connecting to the voice channel. Your audio will be sent when connected."}
            </span>
            {(voiceStatus === "error" || voiceStatus === "presence-error") && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 shrink-0 border-current/30 text-current hover:bg-white/10"
                onClick={() => {
                  setMediaError(false)
                  setMediaReady(false)
                  setPresenceError(false)
                  setPresenceReady(false)
                  presenceFailuresRef.current = 0
                  setPresenceAttempt((attempt) => attempt + 1)
                  setMediaAttempt((attempt) => attempt + 1)
                }}
              >
                Try again
              </Button>
            )}
          </div>
        ) : remoteConnectionPending ? (
          <div className="mx-auto mb-4 flex max-w-5xl items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
            <span className="h-4 w-4 shrink-0 aspect-square animate-spin rounded-full border-2 border-current/30 border-t-current" />
            <span>Voice connected. Connecting to other participants...</span>
          </div>
        ) : remoteConnectionFailed ? (
          <div className="mx-auto mb-4 flex max-w-5xl items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <span>Voice connected, but one or more participants could not establish a direct media connection.</span>
          </div>
        ) : null}
        {mediaAction && (
          <div className="mx-auto mb-4 flex max-w-5xl items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
            <span className="h-4 w-4 shrink-0 aspect-square animate-spin rounded-full border-2 border-current/30 border-t-current" />
            <span>
              {mediaAction === "camera"
                ? "Preparing camera and sending video to the voice channel..."
                : "Preparing screen share and sending it to the voice channel..."}
            </span>
          </div>
        )}
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          <motion.div
            layout
            className={cn(
              "relative flex min-h-[16rem] items-center justify-center overflow-hidden rounded-2xl border-2 border-zinc-800 bg-zinc-900 p-5 transition-colors sm:min-h-[18rem] sm:p-6 lg:min-h-[20rem] lg:p-8",
              isSpeaking && "border-emerald-500"
            )}
          >
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                "absolute inset-0 h-full w-full bg-black object-contain",
                isScreenSharing ? "block" : "hidden"
              )}
            />
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                "absolute inset-0 h-full w-full object-cover",
                isVideoOn && !isScreenSharing ? "block" : "hidden"
              )}
            />
            {!isScreenSharing && !isVideoOn && (
              <div className="relative z-10 flex flex-col items-center gap-5">
                <UserAvatar
                  name={currentUserName}
                  image={currentUserImage}
                  speaking={isSpeaking}
                  className="h-20 w-20 text-2xl sm:h-24 sm:w-24 sm:text-3xl"
                />

                <div className="text-center">
                  <h3 className="font-extrabold text-white text-lg flex items-center justify-center gap-2">
                    {currentUserName} <span className="text-xs text-zinc-400 font-medium">(You)</span>
                  </h3>
                  <div className="flex items-center justify-center gap-1.5 mt-1.5">
                    {isSpeaking ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        Speaking
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-500 font-medium">Ready</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Status tags inside card */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-20">
              <span className="bg-zinc-950/80 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-bold text-white border border-zinc-800">
                {currentUserName}
              </span>
              <div className="flex items-center gap-2">
                {isMuted && (
                  <span className="bg-rose-600 text-white p-1.5 rounded-lg shadow-sm" title="Muted">
                    <MicOff className="w-3.5 h-3.5" />
                  </span>
                )}
                {isDeafened && (
                  <span className="bg-rose-600 text-white p-1.5 rounded-lg shadow-sm" title="Deafened">
                    <Headphones className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </div>
          </motion.div>
          {members
            .filter((member) => member.id !== currentUserId)
            .map((member) => (
              <motion.div
                key={member.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "relative flex min-h-[16rem] items-center justify-center overflow-hidden rounded-2xl border-2 bg-zinc-900 p-5 transition-colors sm:min-h-[18rem] sm:p-6 lg:min-h-[20rem] lg:p-8",
                  remoteSpeakingIds.includes(member.id) ? "border-emerald-500" : "border-zinc-800"
                )}
              >
                {remoteVideoActive[member.id] ? (
                  <video
                    ref={(element) => {
                      if (element) remoteVideoRefs.current.set(member.id, element)
                      else remoteVideoRefs.current.delete(member.id)
                    }}
                    autoPlay
                    playsInline
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : null}
                <div className={cn("relative z-10 flex flex-col items-center gap-5", remoteVideoActive[member.id] && "mt-auto self-start") }>
                  <UserAvatar
                    name={member.name}
                    image={member.image}
                    speaking={remoteSpeakingIds.includes(member.id)}
                    className={cn("h-20 w-20 text-2xl sm:h-24 sm:w-24 sm:text-3xl", remoteVideoActive[member.id] && "hidden")}
                  />
                  <div className="text-center">
                    <h3 className="font-extrabold text-lg text-white">{member.name || "User"}</h3>
                    <span className={cn(
                      "mt-1.5 block text-xs font-medium",
                      remoteSpeakingIds.includes(member.id) ? "text-emerald-400" : "text-zinc-500"
                    )}>
                      {remoteSpeakingIds.includes(member.id) ? "Speaking" : "In voice"}
                    </span>
                  </div>
                </div>
                <span className="absolute bottom-4 left-4 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-1 text-xs font-bold text-white">
                  {member.name || "User"}
                </span>
              </motion.div>
            ))}
        </div>
      </div>

      {/* Bottom Voice Control Bar (Satisfying Tactile Controls) */}
      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-zinc-800 bg-zinc-900 p-3 sm:gap-3.5 sm:p-5">
        {/* Mute Button */}
        <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}>
          <Button
            size="icon"
            onClick={handleToggleMute}
            disabled={!mediaReady}
            className={cn(
              "w-13 h-13 rounded-2xl shadow-lg transition-all cursor-pointer font-bold",
              isMuted
                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-950/50"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700"
            )}
            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>
        </motion.div>

        {/* Deafen Button */}
        <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}>
          <Button
            size="icon"
            onClick={handleToggleDeafen}
            disabled={!mediaReady}
            className={cn(
              "w-13 h-13 rounded-2xl shadow-lg transition-all cursor-pointer font-bold",
              isDeafened
                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-950/50"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700"
            )}
            title={isDeafened ? "Undeafen Audio" : "Deafen Audio"}
          >
            <Headphones className="w-5 h-5" />
          </Button>
        </motion.div>

        {/* Camera Toggle */}
        <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}>
          <Button
            size="icon"
            onClick={toggleVideo}
            disabled={!mediaReady || Boolean(mediaAction)}
            className={cn(
              "w-13 h-13 rounded-2xl shadow-lg transition-all cursor-pointer font-bold",
              isVideoOn
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-950/50"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700"
            )}
            title={isVideoOn ? "Turn off camera" : "Turn on camera"}
          >
            {mediaAction === "camera" ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
            ) : isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </Button>
        </motion.div>

        {/* Screen Share */}
        <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}>
          <Button
            size="icon"
            onClick={toggleScreenShare}
            disabled={!mediaReady || Boolean(mediaAction)}
            className={cn(
              "w-13 h-13 rounded-2xl shadow-lg transition-all cursor-pointer font-bold",
              isScreenSharing
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-950/50"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700"
            )}
            title={isScreenSharing ? "Stop sharing" : "Share screen"}
          >
            {mediaAction === "screen" ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
            ) : <ScreenShare className="w-5 h-5" />}
          </Button>
        </motion.div>

        <div className="w-[1px] h-8 bg-zinc-800 mx-2" />

        {/* Disconnect Button */}
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.94 }}>
          <Button
            variant="destructive"
            onClick={handleDisconnect}
            className="h-13 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 font-extrabold text-sm shadow-xl shadow-rose-950/50 gap-2 text-white cursor-pointer"
          >
            <PhoneOff className="w-5 h-5" />
            Disconnect
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
