"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { incidents, getThreatScore10 } from "@/lib/mock-data"
import { getThreatBgColor, getThreatColor } from "@/lib/mock-data"
import type { ThreatLevel } from "@/lib/mock-data"
import { MessageCircle, Heart, MapPin, Clock, Plus, X, ChevronDown, ChevronUp, Users, CheckCircle, Check } from "lucide-react"

interface NeighborPost {
  id: string
  author: string
  distance: number
  timeAgo: string
  ts: number
  label: string
  description: string
  threatLevel: ThreatLevel
  score10: number
  hearts: number
  myHeart: boolean
  comments: { author: string; text: string; timeAgo: string }[]
  fromIncidentId?: string
}

const MOCK_POSTS: NeighborPost[] = [
  {
    id: "p1", author: "Sarah M.", distance: 0.4, timeAgo: "10 min ago", ts: Date.now() - 10*60000,
    label: "Suspicious Vehicle", description: "Dark SUV circling the block slowly no plates visible. Two occupants. Headed east on Maple Ave.",
    threatLevel: "high", score10: 7, hearts: 4, myHeart: false,
    comments: [
      { author: "James R.", text: "Saw this too near Oak St around 10pm", timeAgo: "8 min ago" },
      { author: "Anon",     text: "Called non-emergency line", timeAgo: "5 min ago" },
    ],
  },
  {
    id: "p2", author: "David K.", distance: 0.8, timeAgo: "32 min ago", ts: Date.now() - 32*60000,
    label: "Person Loitering", description: "Someone standing near the community mailboxes for 20+ minutes. Didn't collect mail, just watching the street.",
    threatLevel: "medium", score10: 6, hearts: 2, myHeart: false, comments: [],
  },
  {
    id: "p3", author: "Anon", distance: 1.2, timeAgo: "1 hr ago", ts: Date.now() - 60*60000,
    label: "Package Theft", description: "Package stolen from porch at 3:40pm. Light sedan, two occupants. Third incident this week on this street.",
    threatLevel: "high", score10: 8, hearts: 9, myHeart: true,
    comments: [
      { author: "Priya N.", text: "Filing a police report, happened to us too", timeAgo: "55 min ago" },
      { author: "Tom W.",   text: "I have footage, sending now",               timeAgo: "20 min ago" },
    ],
  },
  {
    id: "p4", author: "Rachel T.", distance: 2.1, timeAgo: "3 hr ago", ts: Date.now() - 180*60000,
    label: "Late Night Motion", description: "Camera picked up motion near back fence around midnight. Could be animals sharing just in case.",
    threatLevel: "low", score10: 3, hearts: 1, myHeart: false, comments: [],
  },
  {
    id: "p5", author: "Mike A.", distance: 1.7, timeAgo: "5 hr ago", ts: Date.now() - 300*60000,
    label: "Broken Street Light", description: "Street light on Elm & 3rd has been out 3 days. Makes camera footage much harder to read at night.",
    threatLevel: "low", score10: 2, hearts: 5, myHeart: false,
    comments: [{ author: "Cathy L.", text: "Reported to the city already", timeAgo: "4 hr ago" }],
  },
]

// Combined ranking: danger 70% + recency 30%
function getRankScore(post: NeighborPost): number {
  const ageHours = (Date.now() - post.ts) / 3600000
  const recency  = Math.max(0, 1 - ageHours / 24)
  return post.score10 * 0.7 + recency * 10 * 0.3
}

export function NeighborsView() {
  const [posts,        setPosts]        = useState<NeighborPost[]>(MOCK_POSTS)
  const [maxDistance,  setMaxDistance]  = useState(5)
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [newComment,   setNewComment]   = useState<Record<string, string>>({})
  const [showCompose,  setShowCompose]  = useState(false)
  const [shareIncId,   setShareIncId]   = useState<string>("")
  const [composeNote,  setComposeNote]  = useState("")
  const [postAnon,     setPostAnon]     = useState(false)
  const [postPhase,    setPostPhase]    = useState<"form"|"done">("form")

  // Shareable incidents (not already shared, level 4+)
  const shareableIncidents = incidents.filter(i => getThreatScore10(i.threatScore) >= 4)

  const filtered = useMemo(() =>
    posts
      .filter(p => p.distance <= maxDistance)
      .sort((a, b) => getRankScore(b) - getRankScore(a)),
    [posts, maxDistance]
  )

  function toggleHeart(id: string) {
    setPosts(ps => ps.map(p => p.id === id
      ? { ...p, hearts: p.myHeart ? p.hearts - 1 : p.hearts + 1, myHeart: !p.myHeart }
      : p
    ))
  }

  function submitComment(postId: string) {
    const text = (newComment[postId] || "").trim()
    if (!text) return
    setPosts(ps => ps.map(p => p.id === postId
      ? { ...p, comments: [...p.comments, { author: postAnon ? "Anon" : "You", text, timeAgo: "Just now" }] }
      : p
    ))
    setNewComment(n => ({ ...n, [postId]: "" }))
  }

  function submitPost() {
    const inc = incidents.find(i => i.id === shareIncId)
    if (!inc) return
    const score10 = getThreatScore10(inc.threatScore)
    const newPost: NeighborPost = {
      id: `p-${Date.now()}`,
      author: postAnon ? "Anon" : "You",
      distance: 0,
      timeAgo: "Just now",
      ts: Date.now(),
      label: inc.label,
      description: composeNote || inc.summaryLocal,
      threatLevel: inc.threatLevel,
      score10,
      hearts: 0,
      myHeart: false,
      comments: [],
      fromIncidentId: inc.id,
    }
    setPosts(ps => [newPost, ...ps])
    setPostPhase("done")
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto">

      {/*  Header  */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Neighborhood Watch</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} posts within {maxDistance} miles</p>
        </div>
        <button
          onClick={() => { setShowCompose(true); setPostPhase("form"); setComposeNote(""); setShareIncId(""); }}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm"
        >
          <Plus className="h-4 w-4" /> Post Alert
        </button>
      </div>

      {/*  Distance filter  */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Radius</span>
          </div>
          <span className="text-sm font-bold text-primary">{maxDistance} mi</span>
        </div>
        <input
          type="range" min={1} max={10} value={maxDistance}
          onChange={e => setMaxDistance(+e.target.value)}
          className="w-full accent-primary"
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>1 mi</span><span>10 mi</span>
        </div>
      </div>

      {/*  Stats strip  */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Users,         val: "24",            label: "Verified neighbors" },
          { icon: MapPin,        val: `${maxDistance} mi`, label: "Alert radius" },
          { icon: MessageCircle, val: filtered.length, label: "Active posts" },
        ].map(({ icon: Icon, val, label }) => (
          <div key={label} className="flex flex-col items-center rounded-xl border border-border bg-card p-3 text-center">
            <Icon className="mb-1 h-4 w-4 text-muted-foreground" />
            <span className="text-lg font-bold text-foreground">{val}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/*  Feed  */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">No posts within {maxDistance} miles.</p>
          </div>
        )}

        {filtered.map(post => (
          <div key={post.id} className={cn(
            "rounded-2xl border bg-card overflow-hidden",
            post.threatLevel === "critical" || post.threatLevel === "high"
              ? "border-destructive/25" : "border-border"
          )}>
            {/* Post body */}
            <div className="p-4">
              <div className="flex items-start gap-3">
                {/* Danger orb */}
                <div className={cn(
                  "flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl",
                  post.threatLevel === "high" || post.threatLevel === "critical" ? "bg-destructive/10" :
                  post.threatLevel === "medium" ? "bg-warning/10" : "bg-success/10"
                )}>
                  <span className={cn("text-base font-bold leading-none", getThreatColor(post.threatLevel))}>{post.score10}</span>
                  <span className={cn("text-[9px] leading-none opacity-60", getThreatColor(post.threatLevel))}>/10</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <span className="text-sm font-bold text-foreground">{post.label}</span>
                    <span className={cn("rounded-lg px-2 py-0.5 text-xs font-bold", getThreatBgColor(post.threatLevel))}>
                      Level {post.score10}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{post.author}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{post.distance} mi away</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{post.timeAgo}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-foreground">{post.description}</p>
                </div>
              </div>
            </div>

            {/* Action bar */}
            <div className="flex items-center gap-3 border-t border-border bg-secondary/30 px-4 py-2.5">
              <button
                onClick={() => toggleHeart(post.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                  post.myHeart ? "text-destructive" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Heart className={cn("h-3.5 w-3.5", post.myHeart && "fill-destructive")} />
                {post.hearts}
              </button>

              <button
                onClick={() => setExpandedId(expandedId === post.id ? null : post.id)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {post.comments.length}
                {expandedId === post.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>

            {/* Comments */}
            {expandedId === post.id && (
              <div className="border-t border-border bg-secondary/10 p-4">
                {post.comments.length > 0 && (
                  <div className="mb-3 flex flex-col gap-2">
                    {post.comments.map((c, i) => (
                      <div key={i} className="rounded-xl border border-border bg-card p-3">
                        <p className="mb-1 text-xs font-semibold text-muted-foreground">{c.author} · {c.timeAgo}</p>
                        <p className="text-sm text-foreground">{c.text}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={newComment[post.id] || ""}
                    onChange={e => setNewComment(n => ({ ...n, [post.id]: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && submitComment(post.id)}
                    placeholder="Reply… (Enter to send)"
                    className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => submitComment(post.id)}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/*  Compose modal  */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4 md:items-center"
          onClick={() => setShowCompose(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
            onClick={e => e.stopPropagation()}>

            {postPhase === "form" && <>
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground">Post to Neighbors</h3>
                <button onClick={() => setShowCompose(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Select your incident */}
              <div className="mb-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Select your incident (Level 4+)
                </label>
                {shareableIncidents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No shareable incidents (need Level 4+).</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {shareableIncidents.map(inc => {
                      const s = getThreatScore10(inc.threatScore)
                      return (
                        <button
                          key={inc.id}
                          onClick={() => setShareIncId(inc.id)}
                          className={cn(
                            "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                            shareIncId === inc.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                          )}
                        >
                          <div className={cn(
                            "flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg",
                            inc.threatLevel === "high" || inc.threatLevel === "critical" ? "bg-destructive/10" :
                            inc.threatLevel === "medium" ? "bg-warning/10" : "bg-success/10"
                          )}>
                            <span className={cn("text-sm font-bold", getThreatColor(inc.threatLevel))}>{s}</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{inc.label}</p>
                            <p className="text-xs text-muted-foreground">{inc.cameraName}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Optional note */}
              <div className="mb-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Add a note (optional)
                </label>
                <textarea
                  value={composeNote}
                  onChange={e => setComposeNote(e.target.value)}
                  maxLength={280}
                  placeholder="Describe what you saw…"
                  className="w-full resize-none rounded-xl border border-border bg-secondary/30 p-3 text-sm text-foreground outline-none focus:border-primary"
                  rows={3}
                />
                <p className="mt-1 text-right text-xs text-muted-foreground">{composeNote.length}/280</p>
              </div>

              {/* Anon toggle */}
              <div
                onClick={() => setPostAnon(a => !a)}
                className="mb-5 flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-3"
              >
                <div className={cn(
                  "flex h-5 w-5 items-center justify-center rounded border-2 transition-all",
                  postAnon ? "border-primary bg-primary" : "border-border"
                )}>
                  {postAnon && <Check className="h-3 w-3 text-white" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Post anonymously</p>
                  <p className="text-xs text-muted-foreground">Your name won't be shown to neighbors</p>
                </div>
              </div>

              <button
                onClick={submitPost}
                disabled={!shareIncId}
                className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-sm disabled:opacity-40"
              >
                Post to Neighbors
              </button>
            </>}

            {postPhase === "done" && (
              <div className="py-4 text-center">
                <div className="mb-4 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10">
                  <span className="text-3xl">+</span>
                </div>
                <h3 className="mb-2 text-lg font-bold text-success">Alert Posted!</h3>
                <p className="mb-6 text-sm text-muted-foreground">
                  24 verified neighbors within {maxDistance} miles have been notified.
                </p>
                <button
                  onClick={() => setShowCompose(false)}
                  className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}