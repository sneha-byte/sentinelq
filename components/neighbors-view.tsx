"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  MapPin,
  Clock,
  AlertTriangle,
  MessageCircle,
  ThumbsUp,
  Plus,
  Car,
  User,
  HelpCircle,
  Eye,
  ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { incidents } from "@/lib/mock-data";

// ================= TYPES =================
type Urgency = "low" | "medium" | "high";
type Category = "person" | "vehicle" | "noise" | "other";

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
  comments: number;
  sightings: number;
}

// ================= MOCK POSTS =================
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
    description:
      "Saw someone in a dark hoodie walking down the block checking car doors and front porches. They were heading east on Oak Street. Appeared to be alone.",
    upvotes: 14,
    comments: 6,
    sightings: 3,
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
    description:
      "White unmarked van has been parked on Maple Drive since this morning. No company logos, tinted windows. Haven't seen anyone get in or out.",
    upvotes: 8,
    comments: 3,
    sightings: 5,
  },
];

// ================= CONFIGS =================
const urgencyConfig: Record<Urgency, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-muted text-muted-foreground" },
  medium: { label: "Medium", className: "bg-warning/10 text-warning" },
  high: { label: "Urgent", className: "bg-destructive/10 text-destructive" },
};

const categoryConfig: Record<Category, { label: string; icon: typeof User }> = {
  person: { label: "Person", icon: User },
  vehicle: { label: "Vehicle", icon: Car },
  noise: { label: "Noise", icon: AlertTriangle },
  other: { label: "Other", icon: HelpCircle },
};

// ================= POST CARD =================
function PostCard({
  post,
  onUpvote,
}: {
  post: NeighborPost;
  onUpvote: (id: string) => void;
}) {
  const urgency = urgencyConfig[post.urgency];
  const category = categoryConfig[post.category];
  const CategoryIcon = category.icon;

  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback
              className={cn(
                post.avatarColor,
                "text-[11px] font-semibold text-primary-foreground"
              )}
            >
              {post.initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">{post.author}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{post.timeAgo}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className="gap-1 rounded-lg border-border px-2 py-0.5 text-[11px] font-medium"
          >
            <CategoryIcon className="h-3 w-3" />
            {category.label}
          </Badge>
          <Badge
            className={cn(
              "rounded-lg border-0 px-2 py-0.5 text-[11px] font-medium",
              urgency.className
            )}
          >
            {urgency.label}
          </Badge>
        </div>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-foreground leading-snug">
        {post.title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {post.description}
      </p>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3" />
        <span>{post.location}</span>
      </div>

      <div className="mt-4 flex items-center gap-4 border-t border-border pt-3">
        <button
          onClick={() => onUpvote(post.id)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <ChevronUp className="h-3.5 w-3.5" />
          {post.upvotes}
        </button>
        <button className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
          <MessageCircle className="h-3.5 w-3.5" />
          {post.comments}
        </button>
        {post.sightings > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            <span>{post.sightings} also saw this</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ================= MAIN VIEW =================
export function NeighborsView() {
  const [posts, setPosts] = useState(MOCK_POSTS);
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [selectedIncident, setSelectedIncident] = useState<null | typeof incidents[0]>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("other");
  const [newUrgency, setNewUrgency] = useState<Urgency>("low");

  const filteredPosts =
    filter === "all" ? posts : posts.filter((p) => p.category === filter);

  const handleUpvote = (id: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, upvotes: p.upvotes + 1 } : p))
    );
  };

  const handleSubmit = () => {
    if (!newTitle.trim() || !newDescription.trim()) return;

    const newPost: NeighborPost = {
      id: `np-${Date.now()}`,
      author: "You",
      initials: "YO",
      avatarColor: "bg-primary",
      location: newLocation || "Your neighborhood",
      timeAgo: "Just now",
      category: newCategory,
      urgency: newUrgency,
      title: newTitle,
      description: newDescription,
      upvotes: 0,
      comments: 0,
      sightings: 0,
    };

    setPosts((prev) => [newPost, ...prev]);
    setNewTitle("");
    setNewDescription("");
    setNewLocation("");
    setNewCategory("other");
    setNewUrgency("low");
    setSelectedIncident(null);
    setDialogOpen(false);
  };

  const filters: { value: "all" | Category; label: string }[] = [
    { value: "all", label: "All" },
    { value: "person", label: "People" },
    { value: "vehicle", label: "Vehicles" },
    { value: "noise", label: "Noise" },
    { value: "other", label: "Other" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground tracking-tight">
            Neighborhood Watch
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Share and view reports from your neighbors
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl">
              <Plus className="h-4 w-4" />
              Report Something
            </Button>
          </DialogTrigger>

          <DialogContent className="w-full max-w-3xl max-h-[80vh] p-6 overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Report Something</DialogTitle>
              <DialogDescription>
                Select one of your recent incidents below, or create a new report.
              </DialogDescription>
            </DialogHeader>

            {/* Recent incidents list */}
            <div className="mt-4 flex flex-col gap-3 max-h-[35vh] overflow-y-auto">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  className={cn(
                    "rounded-lg border p-4 cursor-pointer transition",
                    selectedIncident?.id === inc.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted"
                  )}
                  onClick={() => {
                    setSelectedIncident(inc);
                    setNewTitle(inc.label);
                    setNewDescription(inc.summaryLocal);
                    setNewLocation(inc.cameraName);
                    setNewCategory("other");
                    setNewUrgency(
                      inc.threatLevel === "low"
                        ? "low"
                        : inc.threatLevel === "medium"
                        ? "medium"
                        : "high"
                    );
                  }}
                >
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-semibold text-foreground">{inc.label}</p>
                    <Badge
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-lg",
                        inc.threatLevel === "low"
                          ? "bg-success/10 text-success"
                          : inc.threatLevel === "medium"
                          ? "bg-warning/10 text-warning"
                          : "bg-destructive/10 text-destructive"
                      )}
                    >
                      {inc.threatLevel.charAt(0).toUpperCase() + inc.threatLevel.slice(1)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    {inc.summaryLocal}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Location: {inc.cameraName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Threat Score: {inc.threatScore}
                  </p>
                </div>
              ))}
            </div>

            <div className="my-4 border-t border-border" />

            {/* New Report Form */}
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="post-title" className="mb-1 block text-sm font-medium text-foreground">
                  What did you see?
                </label>
                <input
                  id="post-title"
                  type="text"
                  placeholder="Suspicious person near park"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label htmlFor="post-desc" className="mb-1 block text-sm font-medium text-foreground">
                  Details
                </label>
                <textarea
                  id="post-desc"
                  rows={3}
                  placeholder="Describe what happened, what they looked like, direction they went..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label htmlFor="post-loc" className="mb-1 block text-sm font-medium text-foreground">
                  Location
                </label>
                <input
                  id="post-loc"
                  type="text"
                  placeholder="Corner of Elm St & 3rd Ave"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label htmlFor="post-cat" className="mb-1 block text-sm font-medium text-foreground">
                    Category
                  </label>
                  <select
                    id="post-cat"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as Category)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="person">Person</option>
                    <option value="vehicle">Vehicle</option>
                    <option value="noise">Noise</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="flex-1">
                  <label htmlFor="post-urg" className="mb-1 block text-sm font-medium text-foreground">
                    Urgency
                  </label>
                  <select
                    id="post-urg"
                    value={newUrgency}
                    onChange={(e) => setNewUrgency(e.target.value as Urgency)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!newTitle.trim() || !newDescription.trim()}
                className="rounded-xl"
              >
                Post Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Tabs */}
      <div className="mt-5 flex gap-2">
        {filters.map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Post List */}
      <div className="mt-5 flex flex-col gap-5">
        {filteredPosts.map((p) => (
          <PostCard key={p.id} post={p} onUpvote={handleUpvote} />
        ))}
      </div>
    </div>
  );
}