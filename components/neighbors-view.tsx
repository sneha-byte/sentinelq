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
  {
    id: "np-3",
    author: "Linda R.",
    initials: "LR",
    avatarColor: "bg-chart-3",
    location: "Elm Park",
    timeAgo: "1 hour ago",
    category: "other",
    urgency: "low",
    title: "Broken streetlight near the park",
    description:
      "The streetlight at the south entrance of Elm Park has been out for two nights now. Makes the whole corner really dark. Already reported to the city.",
    upvotes: 22,
    comments: 4,
    sightings: 0,
  },
  {
    id: "np-4",
    author: "Carlos D.",
    initials: "CD",
    avatarColor: "bg-chart-5",
    location: "Birch Lane",
    timeAgo: "2 hours ago",
    category: "noise",
    urgency: "medium",
    title: "Loud banging noises from vacant house",
    description:
      "The house at 42 Birch Lane has been vacant for months, but I've been hearing banging noises from inside around midnight the last two nights. Could be animals, could be squatters.",
    upvotes: 11,
    comments: 8,
    sightings: 2,
  },
  {
    id: "np-5",
    author: "Priya K.",
    initials: "PK",
    avatarColor: "bg-primary",
    location: "Cedar Ave & 2nd St",
    timeAgo: "3 hours ago",
    category: "person",
    urgency: "low",
    title: "Door-to-door solicitor without ID",
    description:
      "Someone claiming to be from a utility company knocked on my door but didn't have a badge or ID when I asked. Politely declined and they moved on. Just a heads up.",
    upvotes: 6,
    comments: 2,
    sightings: 1,
  },
  {
    id: "np-6",
    author: "Mike B.",
    initials: "MB",
    avatarColor: "bg-chart-2",
    location: "Parking Lot behind Main St",
    timeAgo: "5 hours ago",
    category: "vehicle",
    urgency: "low",
    title: "Car with out-of-state plates idling",
    description:
      "Blue sedan with out-of-state plates has been idling in the Main Street lot for about an hour. Probably nothing, but figured I'd mention it since we had break-ins last week.",
    upvotes: 3,
    comments: 1,
    sightings: 0,
  },
];

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
      {/* Header: avatar, author, time, badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback
              className={cn(
                post.avatarColor,
                "text-[11px] font-semibold text-primary-foreground",
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
              urgency.className,
            )}
          >
            {urgency.label}
          </Badge>
        </div>
      </div>

      {/* Title and description */}
      <h3 className="mt-3 text-sm font-semibold text-foreground leading-snug">
        {post.title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {post.description}
      </p>

      {/* Location */}
      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3" />
        <span>{post.location}</span>
      </div>

      {/* Actions */}
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

export function NeighborsView() {
  const [posts, setPosts] = useState(MOCK_POSTS);
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  // New post form state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("other");
  const [newUrgency, setNewUrgency] = useState<Urgency>("low");

  const filteredPosts =
    filter === "all" ? posts : posts.filter((p) => p.category === filter);

  function handleUpvote(id: string) {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, upvotes: p.upvotes + 1 } : p)),
    );
  }

  function handleSubmit() {
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
    setDialogOpen(false);
  }

  const filters: { value: "all" | Category; label: string }[] = [
    { value: "all", label: "All" },
    { value: "person", label: "People" },
    { value: "vehicle", label: "Vehicles" },
    { value: "noise", label: "Noise" },
    { value: "other", label: "Other" },
  ];

  return (
    <div>
      {/* Page header */}
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

          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Report Something Suspicious</DialogTitle>
              <DialogDescription>
                Your neighbors will see this post. Be specific about what you
                saw and where.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
              {/* Title */}
              <div>
                <label
                  htmlFor="post-title"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  What did you see?
                </label>
                <input
                  id="post-title"
                  type="text"
                  placeholder="e.g., Suspicious person near park"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="post-desc"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
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

              {/* Location */}
              <div>
                <label
                  htmlFor="post-loc"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Location
                </label>
                <input
                  id="post-loc"
                  type="text"
                  placeholder="e.g., Corner of Elm St & 3rd Ave"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Category + urgency row */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label
                    htmlFor="post-cat"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
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
                  <label
                    htmlFor="post-urg"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
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
                    <option value="high">Urgent</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="rounded-xl"
              >
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

      {/* Filters */}
      <div className="mt-5 flex items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              filter === f.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Posts grid */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filteredPosts.map((post) => (
          <PostCard key={post.id} post={post} onUpvote={handleUpvote} />
        ))}
      </div>

      {filteredPosts.length === 0 && (
        <div className="mt-16 flex flex-col items-center justify-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Eye className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-medium text-foreground">
            No reports yet
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing in this category. Be the first to report something.
          </p>
        </div>
      )}
    </div>
  );
}
