"use client";

import { cn } from "@/lib/utils";
import { Bot, User, Lock, Sparkles } from "lucide-react";

const CONCEPT_CONVERSATIONS = [
  {
    id: 1,
    title: "Visitor Context",
    messages: [
      { role: "user", text: "My friend Jake is coming over at 7pm tonight. He drives a grey Honda Civic." },
      { role: "ai",   text: "Got it. I've noted Jake's arrival at 7pm and flagged a grey Honda Civic as expected. I won't send you any alerts when he arrives, but I'll send a quiet notification once I detect him so you know he's there." },
      { role: "user", text: "Perfect. Also a DoorDash delivery sometime between 6 and 6:30." },
      { role: "ai",   text: "Noted. Any vehicle or person approaching the front door between 6:00–6:30pm will be treated as the delivery. I'll notify you when they arrive and when they leave, and won't flag the package." },
    ],
  },
  {
    id: 2,
    title: "False Alert Explanation",
    messages: [
      { role: "user", text: "Why did you flag the backyard camera at 2am?" },
      { role: "ai",   text: "At 2:04am I detected motion near the back fence. Confidence was 71% on a person-shaped silhouette moving slowly along the perimeter. Wind conditions were calm so it wasn't foliage. I escalated because the movement pattern didn't match any known visitor and it was outside normal activity hours for your home." },
      { role: "user", text: "That was probably a raccoon. It happens every night." },
      { role: "ai",   text: "Understood. I'll lower the sensitivity for that camera zone between midnight and 4am and cross-reference with animal detection before escalating. If it keeps happening I'll ask if you want to fully suppress those alerts." },
    ],
  },
  {
    id: 3,
    title: "Smart Home Learning",
    messages: [
      { role: "ai",   text: "I noticed you manually turned on the porch light at 8:47pm last night after I hadn't. Would you like me to automatically turn it on at sunset each evening going forward?" },
      { role: "user", text: "Yes, but only when someone is home." },
      { role: "ai",   text: "Done. Porch light will activate at sunset only when the home is occupied. I'll also dim it after midnight since you've been turning it off around that time. Let me know if you want to adjust." },
    ],
  },
];

function ChatBubble({ role, text }: { role: "user" | "ai"; text: string }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex items-end gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
        isUser ? "bg-primary text-primary-foreground" : "bg-secondary border border-border"
      )}>
        {isUser
          ? <User className="h-3.5 w-3.5" />
          : <Bot className="h-3.5 w-3.5 text-primary" />}
      </div>
      <div className={cn(
        "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
        isUser
          ? "rounded-br-sm bg-primary text-primary-foreground"
          : "rounded-bl-sm bg-secondary text-foreground border border-border"
      )}>
        {text}
      </div>
    </div>
  );
}

export function AIAssistantView() {
  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto">

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 text-center">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/8 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-primary/6 blur-xl" />
        <div className="relative">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <h2 className="text-2xl font-bold text-foreground">AI Assistant</h2>
            <span className="flex items-center gap-1 rounded-full bg-warning/10 border border-warning/20 px-2.5 py-0.5 text-xs font-semibold text-warning">
              <Lock className="h-3 w-3" /> Coming Soon
            </span>
          </div>
          
        </div>
      </div>

      {/* Concept conversations */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Concept Conversations</h3>
        </div>

        <div className="flex flex-col gap-4">
          {CONCEPT_CONVERSATIONS.map(convo => (
            <div key={convo.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border bg-secondary/30 px-4 py-2.5">
                <span className="text-xs font-medium text-muted-foreground">{convo.title}</span>
              </div>
              <div className="flex flex-col gap-3 p-4">
                {convo.messages.map((msg, i) => (
                  <ChatBubble key={i} role={msg.role as "user" | "ai"} text={msg.text} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Locked input */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3 opacity-50 pointer-events-none select-none">
          <div className="flex-1 rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
            Ask SentinelQ anything about your home...
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <Lock className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          AI chat will be available in a future update
        </p>
      </div>
    </div>
  );
}