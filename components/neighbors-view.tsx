"use client";

import { useState, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

interface NeighborPost {
  id: number;
  videoUrl: string;
  timestamp: string;
  description?: string;
}

export function NeighborsView() {
  const [posts, setPosts] = useState<NeighborPost[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [time, setTime] = useState("");

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (!selectedFile || !time) return;

    const url = URL.createObjectURL(selectedFile);
    const newPost: NeighborPost = {
      id: Date.now(),
      videoUrl: url,
      timestamp: time,
      description: description.trim() || undefined,
    };

    setPosts([newPost, ...posts]);
    // reset form
    setSelectedFile(null);
    setDescription("");
    setTime("");
  };

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-base font-semibold text-foreground">Neighbors</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Report Suspicious Activity</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              Video Footage
            </label>
            <Input type="file" accept="video/*" onChange={handleFileChange} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              Time
            </label>
            <Input
              type="datetime-local"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              Description (optional)
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!selectedFile || !time}
            className="self-end"
          >
            Post
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {posts.map((p) => (
          <Card key={p.id} className="space-y-2">
            <CardContent className="flex flex-col gap-2">
              <video
                src={p.videoUrl}
                controls
                className="max-h-48 w-full rounded-md"
              />
              <p className="text-xs text-muted-foreground">
                {format(new Date(p.timestamp), "PPpp")}
              </p>
              {p.description && (
                <p className="text-sm text-foreground">{p.description}</p>
              )}
            </CardContent>
          </Card>
        ))}
        {posts.length === 0 && (
          <p className="text-sm text-muted-foreground">No reports yet.</p>
        )}
      </div>
    </div>
  );
}
