"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  MapPin, Clock, AlertTriangle, MessageCircle,
  ThumbsUp, Plus, Car, User, HelpCircle, Eye, ChevronUp, ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { incidents } from "@/lib/mock-data";

type Urgency  = "low" | "medium" | "high";
type Category = "person" | "vehicle" | "noise" | "other";

interface Comment {
  id: string;
  author: string;
  initials: string;
  timeAgo: string;
  text: string;
}

interface NeighborPost {
  id: string;
  author: string;
  initials: string;
  avatarColor: string;
  location: string;
  timeAgo: string;
  category: Category;
  urgency: Urgency;
  title: string;
  description: string;
  upvotes: number;
  comments: Comment[];
  sightings: number;
}

const MOCK_POSTS: NeighborPost[] = [
  {
    id: "np-1",
    author: "Sarah M.",
    initials: "SM",
    avatarColor: "bg-primary",
    location: "Oak Street & 5th Ave",
    timeAgo: "12 min ago",
    category: "person",
    urgency: "high",
    title: "Unknown person trying door handles",
    description: "Saw someone in a dark hoodie walking down the block checking car doors and front porches. They were heading east on Oak Street. Appeared to be alone.",
    upvotes: 14,
    sightings: 3,
    comments: [
      { id: "c1", author: "Mike R.", initials: "MR", timeAgo: "8 min ago",  text: "I saw the same person near Elm Ave about 20 minutes ago. Dark hoodie, maybe 5'10\"." },
      { id: "c2", author: "Priya K.", initials: "PK", timeAgo: "5 min ago", text: "Called the non-emergency line. They said they'll have a patrol swing by." },
      { id: "c3", author: "Tom W.",  initials: "TW", timeAgo: "2 min ago",  text: "Just checked my cameras — caught them on Oak at 9:42pm heading toward the park." },
    ],
  },
  {
    id: "np-2",
    author: "James T.",
    initials: "JT",
    avatarColor: "bg-chart-2",
    location: "Maple Drive",
    timeAgo: "45 min ago",
    category: "vehicle",
    urgency: "medium",
    title: "Unfamiliar van parked for hours",
    description: "White unmarked van has been parked on Maple Drive since this morning. No company logos, tinted windows. Haven't seen anyone get in or out.",
    upvotes: 8,
    sightings: 5,
    comments: [
      { id: "c4", author: "Linda S.", initials: "LS", timeAgo: "30 min ago", text: "Still there as of 10 minutes ago. Took a photo of the plate just in case." },
      { id: "c5", author: "Dev P.",   initials: "DP", timeAgo: "15 min ago", text: "Could be the cable company — they've been doing work on the street this week." },
    ],
  },
];

const urgencyConfig: Record<Urgency, { label: string; className: string }> = {
  low:    { label: "Low",    className: "bg-muted text-muted-foreground" },
  medium: { label: "Medium", className: "bg-warning/10 text-warning" },
  high:   { label: "Urgent", className: "bg-destructive/10 text-destructive" },
};

const categoryConfig: Record<Category, { label: string; icon: typeof User }> = {
  person:  { label: "Person",  icon: User },
  vehicle: { label: "Vehicle", icon: Car },
  noise:   { label: "Noise",   icon: AlertTriangle },
  other:   { label: "Other",   icon: HelpCircle },
};

function PostCard({ post, onUpvote }: { post: NeighborPost; onUpvote: (id: string) => void }) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment]     = useState("");
  const [comments, setComments]         = useState(post.comments);

  const urgency  = urgencyConfig[post.urgency];
  const category = categoryConfig[post.category];
  const CategoryIcon = category.icon;

  function submitComment() {
    if (!newComment.trim()) return;
    setComments(prev => [...prev, {
      id: `c-${Date.now()}`,
      author: "You",
      initials: "YO",
      timeAgo: "Just now",
      text: newComment.trim(),
    }]);
    setNewComment("");
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className={cn(post.avatarColor, "text-[11px] font-semibold text-primary-foreground")}>
              {post.initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">{post.author}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /><span>{post.timeAgo}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="gap-1 rounded-lg border-border px-2 py-0.5 text-[11px] font-medium">
            <CategoryIcon className="h-3 w-3" />{category.label}
          </Badge>
          <Badge className={cn("rounded-lg border-0 px-2 py-0.5 text-[11px] font-medium", urgency.className)}>
            {urgency.label}
          </Badge>
        </div>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-foreground leading-snug">{post.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{post.description}</p>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3" /><span>{post.location}</span>
      </div>

      <div className="mt-4 flex items-center gap-4 border-t border-border pt-3">
        <button
          onClick={() => onUpvote(post.id)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <ChevronUp className="h-3.5 w-3.5" />{post.upvotes}
        </button>
        <button
          onClick={() => setShowComments(o => !o)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <MessageCircle className="h-3.5 w-3.5" />{comments.length}
          {showComments ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
        </button>
        {post.sightings > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5" /><span>{post.sightings} also saw this</span>
          </div>
        )}
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
          {comments.map(c => (
            <div key={c.id} className="flex items-start gap-2.5">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="bg-secondary text-[10px] font-semibold text-foreground">
                  {c.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 rounded-xl bg-secondary/50 px-3 py-2">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-foreground">{c.author}</span>
                  <span className="text-[10px] text-muted-foreground">{c.timeAgo}</span>
                </div>
                <p className="text-xs text-foreground leading-relaxed">{c.text}</p>
              </div>
            </div>
          ))}

          {/* Add comment */}
          <div className="flex items-center gap-2 mt-1">
            <input
              type="text"
              placeholder="Add a comment..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitComment()}
              className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="sm" onClick={submitComment} disabled={!newComment.trim()} className="rounded-xl text-xs px-3">
              Post
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function NeighborsView() {
  const [posts,      setPosts]      = useState(MOCK_POSTS);
  const [filter,     setFilter]     = useState<"all" | Category>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [selectedIncident, setSelectedIncident] = useState<null | typeof incidents[0]>(null);
  const [newTitle,       setNewTitle]       = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newLocation,    setNewLocation]    = useState("");
  const [newCategory,    setNewCategory]    = useState<Category>("other");
  const [newUrgency,     setNewUrgency]     = useState<Urgency>("low");

  const filteredPosts = filter === "all" ? posts : posts.filter(p => p.category === filter);

  const handleUpvote = (id: string) =>
    setPosts(prev => prev.map(p => p.id === id ? { ...p, upvotes: p.upvotes + 1 } : p));

  const handleSubmit = () => {
    if (!newTitle.trim() || !newDescription.trim()) return;
    setPosts(prev => [{
      id: `np-${Date.now()}`,
      author: "You", initials: "YO", avatarColor: "bg-primary",
      location: newLocation || "Your neighborhood",
      timeAgo: "Just now",
      category: newCategory, urgency: newUrgency,
      title: newTitle, description: newDescription,
      upvotes: 0, sightings: 0, comments: [],
    }, ...prev]);
    setNewTitle(""); setNewDescription(""); setNewLocation("");
    setNewCategory("other"); setNewUrgency("low");
    setSelectedIncident(null); setDialogOpen(false);
  };

  const filters: { value: "all" | Category; label: string }[] = [
    { value: "all",     label: "All" },
    { value: "person",  label: "People" },
    { value: "vehicle", label: "Vehicles" },
    { value: "noise",   label: "Noise" },
    { value: "other",   label: "Other" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground tracking-tight">Neighborhood Watch</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Share and view reports from your neighbors</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl"><Plus className="h-4 w-4" />Report Something</Button>
          </DialogTrigger>
          <DialogContent className="w-full max-w-3xl max-h-[80vh] p-6 overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Report Something</DialogTitle>
              <DialogDescription>Select a recent incident or write a new report.</DialogDescription>
            </DialogHeader>

            <div className="mt-4 flex flex-col gap-3 max-h-[35vh] overflow-y-auto">
              {incidents.map(inc => (
                <div
                  key={inc.id}
                  onClick={() => { setSelectedIncident(inc); setNewTitle(inc.label); setNewDescription(inc.summaryLocal); setNewLocation(inc.cameraName); setNewUrgency(inc.threatLevel === "low" ? "low" : inc.threatLevel === "medium" ? "medium" : "high"); }}
                  className={cn("rounded-lg border p-4 cursor-pointer transition", selectedIncident?.id === inc.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted")}
                >
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-semibold text-foreground">{inc.label}</p>
                    <Badge className={cn("text-xs px-2 py-0.5 rounded-lg", inc.threatLevel === "low" ? "bg-success/10 text-success" : inc.threatLevel === "medium" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive")}>
                      {inc.threatLevel.charAt(0).toUpperCase() + inc.threatLevel.slice(1)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground truncate">{inc.summaryLocal}</p>
                </div>
              ))}
            </div>

            <div className="my-4 border-t border-border" />

            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">What did you see?</label>
                <input type="text" placeholder="Suspicious person near park" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Details</label>
                <textarea rows={3} placeholder="Describe what happened..." value={newDescription} onChange={e => setNewDescription(e.target.value)}
                  className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Location</label>
                <input type="text" placeholder="Corner of Elm St & 3rd Ave" value={newLocation} onChange={e => setNewLocation(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-foreground">Category</label>
                  <select value={newCategory} onChange={e => setNewCategory(e.target.value as Category)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="person">Person</option>
                    <option value="vehicle">Vehicle</option>
                    <option value="noise">Noise</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-foreground">Urgency</label>
                  <select value={newUrgency} onChange={e => setNewUrgency(e.target.value as Urgency)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleSubmit} disabled={!newTitle.trim() || !newDescription.trim()} className="rounded-xl">Post Report</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-5 flex gap-2">
        {filters.map(f => (
          <Button key={f.value} variant={filter === f.value ? "default" : "outline"} size="sm" onClick={() => setFilter(f.value)}>
            {f.label}
          </Button>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-5">
        {filteredPosts.map(p => <PostCard key={p.id} post={p} onUpvote={handleUpvote} />)}
      </div>
    </div>
  );
}