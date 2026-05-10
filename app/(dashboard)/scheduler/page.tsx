"use client";
import { useState, useRef } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

type ContentType = "short_video" | "carousel" | "post";

const contentTypes: { id: ContentType; label: string; icon: string; note: string }[] = [
  {
    id: "short_video",
    label: "Short-Form Video",
    icon: "🎬",
    note: "Reels, TikToks, Shorts — vertical 9:16 format",
  },
  {
    id: "carousel",
    label: "Carousel",
    icon: "🖼️",
    note: "Up to 10 slides, square or portrait format",
  },
  {
    id: "post",
    label: "Post / Static Image",
    icon: "🖼",
    note: "Single image or graphic — keep your grid layout in mind",
  },
];

const bestTimes = [
  { day: "Mon", time: "7–9 AM", score: 82 },
  { day: "Tue", time: "6–8 PM", score: 91 },
  { day: "Wed", time: "11 AM–1 PM", score: 78 },
  { day: "Thu", time: "7–9 PM", score: 95 },
  { day: "Fri", time: "12–2 PM", score: 88 },
  { day: "Sat", time: "10 AM–12 PM", score: 74 },
  { day: "Sun", time: "6–8 PM", score: 70 },
];

export default function SchedulerPage() {
  const [selectedType, setSelectedType] = useState<ContentType | null>(null);
  const [contentDesc, setContentDesc] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState<"upload" | "insights">("upload");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setCsvFile(e.target.files[0]);
  };

  const removeFile = (idx: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType) return;
    setSubmitted(true);
  };

  const maxScore = Math.max(...bestTimes.map((t) => t.score));

  if (submitted) {
    return (
      <div className="p-5 md:p-7 max-w-4xl mx-auto">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-10 text-center">
          <div className="text-5xl mb-4">🚀</div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Content Queued!</h2>
          <p className="text-text-secondary text-sm max-w-md mx-auto mb-6">
            Your content is being processed by the AI — captions, hashtags, and titles will be generated
            and uploaded to Google Drive, then published via Make.com at the optimal time.
          </p>
          <Button variant="primary" onClick={() => { setSubmitted(false); setUploadedFiles([]); setCsvFile(null); setContentDesc(""); setSelectedType(null); }}>
            Schedule More Content →
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-7 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Content</p>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Smart Scheduler</h1>
        <p className="text-sm text-text-secondary mt-1">
          Upload your content, describe the topic, and let AI handle captions, hashtags &amp; titles — then we post it for you.
        </p>
      </div>

      {/* Workflow explainer */}
      <div className="rounded-xl border border-border bg-surface-elevated p-4 flex flex-col sm:flex-row items-start gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xl">📤</span>
          <span className="text-xs text-text-muted">Upload</span>
        </div>
        <div className="hidden sm:block text-text-muted text-lg mt-0.5">→</div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xl">🤖</span>
          <span className="text-xs text-text-muted">AI (n8n + OpenAI) adds captions, hashtags &amp; titles, saves to Drive</span>
        </div>
        <div className="hidden sm:block text-text-muted text-lg mt-0.5">→</div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xl">📅</span>
          <span className="text-xs text-text-muted">Make.com posts at peak time</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-0">
        {[
          { id: "upload" as const, label: "Schedule Content", icon: "📤" },
          { id: "insights" as const, label: "Best Times to Post", icon: "📊" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text-secondary"
              }`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: Schedule Content */}
      {activeTab === "upload" && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Step 1: Content type */}
          <Card header={<h2 className="text-sm font-semibold text-text-primary">1 · What are you posting?</h2>}>
            <div className="grid sm:grid-cols-3 gap-3">
              {contentTypes.map((ct) => (
                <button
                  key={ct.id}
                  type="button"
                  onClick={() => setSelectedType(ct.id)}
                  className={`flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all
                    ${selectedType === ct.id
                      ? "border-primary/40 bg-primary/8 shadow-[0_0_16px_rgba(123,63,242,0.08)]"
                      : "border-border bg-surface hover:border-primary/20"
                    }`}
                >
                  <span className="text-2xl">{ct.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{ct.label}</p>
                    <p className="text-[11px] text-text-muted mt-0.5 leading-snug">{ct.note}</p>
                  </div>
                  {selectedType === ct.id && (
                    <span className="text-xs text-primary font-semibold">✓ Selected</span>
                  )}
                </button>
              ))}
            </div>

            {selectedType === "post" && (
              <div className="mt-3 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3 flex gap-2">
                <span className="text-warning shrink-0">⚠</span>
                <p className="text-xs text-warning leading-relaxed">
                  <strong>Grid reminder:</strong> Posts are permanent on your profile grid. Make sure your image is properly formatted (square 1:1 or portrait 4:5) and fits your overall grid aesthetic before scheduling.
                </p>
              </div>
            )}
          </Card>

          {/* Step 2: Upload */}
          <Card header={<h2 className="text-sm font-semibold text-text-primary">2 · Upload your content</h2>}>
            <div className="space-y-4">
              {/* Drag & drop area */}
              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="text-3xl mb-2">📁</div>
                <p className="text-sm font-medium text-text-primary">Drop photos or videos here</p>
                <p className="text-xs text-text-muted mt-1">JPG, PNG, MP4, MOV — up to 500MB per file</p>
                <button type="button" className="mt-3 text-xs text-primary border border-primary/30 rounded-lg px-4 py-1.5 hover:bg-primary/5 transition-colors">
                  Browse Files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* CSV upload */}
              <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
                <span className="text-2xl shrink-0">📊</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">Bulk schedule via CSV</p>
                  <p className="text-xs text-text-muted">Upload a CSV with content URLs, captions &amp; schedule times</p>
                  {csvFile && <p className="text-xs text-primary mt-1">✓ {csvFile.name}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => csvInputRef.current?.click()}
                  className="shrink-0 text-xs text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
                >
                  Upload CSV
                </button>
                <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvChange} />
              </div>

              {/* Uploaded files preview */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Queued files</p>
                  {uploadedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                      <span className="text-lg">{file.type.startsWith("video") ? "🎬" : "🖼️"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-primary truncate">{file.name}</p>
                        <p className="text-[10px] text-text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                      <button type="button" onClick={() => removeFile(idx)} className="text-text-muted hover:text-error transition-colors text-sm">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Step 3: Content description for AI */}
          <Card header={<h2 className="text-sm font-semibold text-text-primary">3 · Tell the AI what this content is about</h2>}>
            <p className="text-xs text-text-muted mb-3">
              Describe the topic, message, or goal — the AI will write captions, titles, and hashtags based on your brand voice.
            </p>
            <textarea
              value={contentDesc}
              onChange={(e) => setContentDesc(e.target.value)}
              placeholder="e.g. 'This video shows our new summer collection launch — target audience is women 25–35 who love fashion. Vibe is aspirational but approachable. Include a CTA to shop the link in bio.'"
              rows={4}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted outline-none focus:border-primary/40 transition-colors resize-none"
            />
            <div className="mt-3 rounded-lg border border-border bg-surface-elevated px-4 py-3">
              <p className="text-[11px] text-text-muted font-medium uppercase tracking-wider mb-1.5">AI will generate:</p>
              <div className="flex flex-wrap gap-2">
                {["Caption", "Title / Hook", "30+ Hashtags", "Alt text", "Best posting time"].map((item) => (
                  <span key={item} className="text-[11px] bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-full">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          {/* Submit */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-text-muted">
              Content → n8n (AI formats) → Google Drive → Make.com → Posted ✓
            </p>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!selectedType || (uploadedFiles.length === 0 && !csvFile)}
            >
              Queue for Posting →
            </Button>
          </div>
        </form>
      )}

      {/* TAB: Best Times to Post */}
      {activeTab === "insights" && (
        <div className="space-y-5">
          <Card header={
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Optimal Posting Windows</h2>
              <span className="text-[10px] bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold">Based on your followers</span>
            </div>
          }>
            <p className="text-xs text-text-muted mb-4">
              Engagement windows are calculated by scanning your connected platforms — we analyze your current followers&apos; active hours and similar audience segments to find your peak reach windows.
            </p>
            <div className="space-y-2.5">
              {bestTimes.map((slot) => (
                <div key={slot.day} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-text-secondary w-8 shrink-0">{slot.day}</span>
                  <div className="flex-1 h-7 bg-surface rounded-lg overflow-hidden relative">
                    <div
                      className={`h-full rounded-lg transition-all duration-700 flex items-center px-3 ${
                        slot.score === maxScore ? "bg-primary shadow-[0_0_12px_rgba(123,63,242,0.3)]" : "bg-primary/30"
                      }`}
                      style={{ width: `${slot.score}%` }}
                    >
                      <span className="text-[10px] text-white font-semibold whitespace-nowrap">{slot.time}</span>
                    </div>
                  </div>
                  <span className={`text-xs font-bold w-8 text-right shrink-0 ${slot.score === maxScore ? "text-primary" : "text-text-muted"}`}>
                    {slot.score}
                  </span>
                  {slot.score === maxScore && <span className="text-[10px] text-primary font-bold shrink-0">🔥 Best</span>}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">📡</span>
              <div>
                <p className="text-sm font-semibold text-text-primary mb-1">How we calculate your best times</p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Autom8 scans insights from all your connected platforms — Instagram, Facebook, TikTok, and more — to identify when your specific audience is most active. We also analyze engagement patterns from similar follower market segments to maximize your reach beyond your current followers.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["Follower activity heatmap", "Competitor audience overlap", "Hashtag peak windows", "Content-type engagement rates"].map((item) => (
                    <span key={item} className="text-[11px] bg-surface border border-border text-text-muted px-2 py-0.5 rounded-full">{item}</span>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center">
            <p className="text-sm font-semibold text-text-primary mb-1">Ready to post at the perfect time?</p>
            <p className="text-xs text-text-secondary mb-4">Switch to the Schedule tab and upload your content — we&apos;ll auto-select the best window.</p>
            <Button variant="primary" size="md" onClick={() => setActiveTab("upload")}>
              Schedule Content →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
