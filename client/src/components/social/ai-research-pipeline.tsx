"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Search,
  Tags,
  TrendingUp,
  Sparkles,
  PenTool,
  Target,
  Check,
  Circle,
  Loader2,
  Image,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  ALL_PLATFORMS,
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  getPlatformCharLimit,
} from "./platform-utils";
import { socialApi } from "@/lib/api/social";
import type { SocialAccount } from "@/lib/api/social";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OutputFormat = "short" | "long" | "thread-short" | "thread-long";
type VoiceTone = "personal" | "company";

interface PipelineStep {
  label: string;
  icon: React.ElementType;
  delay: number;
  resultSummary: string;
}

const PIPELINE_STEPS: Omit<PipelineStep, "resultSummary">[] = [
  { label: "Researching topic...", icon: Search, delay: 2000 },
  { label: "Analyzing category...", icon: Tags, delay: 1500 },
  { label: "Finding popular posts...", icon: TrendingUp, delay: 2000 },
  { label: "Generating hook...", icon: Sparkles, delay: 1500 },
  { label: "Writing content...", icon: PenTool, delay: 2000 },
  { label: "Optimizing for platform...", icon: Target, delay: 1000 },
];

// ---------------------------------------------------------------------------
// Mock content generation helpers
// ---------------------------------------------------------------------------

const HASHTAG_POOL: Record<string, string[]> = {
  tech: ["#Tech", "#Innovation", "#AI", "#DigitalTransformation", "#Future"],
  marketing: ["#Marketing", "#Growth", "#Branding", "#ContentStrategy", "#ROI"],
  business: ["#Business", "#Leadership", "#Startup", "#Entrepreneurship", "#Strategy"],
  lifestyle: ["#Lifestyle", "#Wellness", "#Motivation", "#MindfulLiving", "#Growth"],
  default: ["#Trending", "#MustRead", "#Insights", "#Community", "#Inspiration"],
};

function pickHashtags(topic: string, count: number): string[] {
  const lower = topic.toLowerCase();
  let pool = HASHTAG_POOL.default;
  for (const [key, tags] of Object.entries(HASHTAG_POOL)) {
    if (lower.includes(key)) {
      pool = tags;
      break;
    }
  }
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateStepSummaries(topic: string): string[] {
  return [
    `Found 12 relevant sources about "${topic.slice(0, 40)}..."`,
    "Categorized as Technology / Innovation",
    "Identified 3 viral patterns from top-performing posts",
    "Created attention-grabbing opening hook",
    "Drafted content with optimized structure",
    "Adjusted length, hashtags, and formatting for platform",
  ];
}

function generateMockContent(
  topic: string,
  format: OutputFormat,
  tone: VoiceTone,
  platform: SocialAccount["platform"]
): string[] {
  const pronoun = tone === "personal" ? "I" : "We";
  const possessive = tone === "personal" ? "my" : "our";
  const verb = tone === "personal" ? "I've been" : "We've been";
  const hashtags = pickHashtags(topic, 3).join(" ");
  const limit = getPlatformCharLimit(platform);

  const hooks = [
    `${pronoun} spent the last month diving deep into ${topic}, and here's what most people get wrong:`,
    `Everyone talks about ${topic}, but nobody mentions this crucial detail:`,
    `After ${tone === "personal" ? "years of" : "extensive"} research on ${topic}, the data finally speaks for itself.`,
  ];
  const hook = hooks[Math.floor(Math.random() * hooks.length)];

  if (format === "short") {
    const body = `${hook}\n\nThe key insight? Success comes from consistency, not complexity. ${verb} testing this approach and the results are remarkable.\n\n${hashtags}`;
    return [body.slice(0, limit)];
  }

  if (format === "long") {
    const body = `${hook}\n\nHere's what ${pronoun} discovered:\n\n1. Most strategies around ${topic} focus on the wrong metrics. Instead, ${pronoun === "I" ? "focus" : "we focus"} on leading indicators that predict outcomes weeks in advance.\n\n2. The 80/20 rule applies heavily. About 20% of ${possessive} efforts drove 80% of the results. Identifying those high-leverage activities was a game-changer.\n\n3. Consistency beats intensity every single time. Small daily actions compound into extraordinary results over 90 days.\n\nThe bottom line: Stop overcomplicating ${topic}. Start with one clear goal, measure what matters, and iterate weekly.\n\nWhat's ${possessive === "my" ? "your" : "your team's"} experience with this? ${pronoun === "I" ? "I'd" : "We'd"} love to hear your perspective.\n\n${hashtags}`;
    return [body.slice(0, limit)];
  }

  // Thread formats
  const threadPosts: string[] = [];
  const isLong = format === "thread-long";

  threadPosts.push(
    `${hook}\n\nA thread on what ${pronoun === "I" ? "I learned" : "we learned"} ${String.fromCodePoint(0x1F9F5)}`
  );

  if (isLong) {
    threadPosts.push(
      `First, let's establish why ${topic} matters right now.\n\nThe landscape has shifted dramatically. What worked 2 years ago is now outdated. ${verb} tracking these changes closely, and the data tells a compelling story.\n\nHere are the numbers that caught ${possessive} attention...`
    );
    threadPosts.push(
      `The strategy that's working:\n\n${String.fromCodePoint(0x2705)} Focus on quality over quantity\n${String.fromCodePoint(0x2705)} Build systems, not just goals\n${String.fromCodePoint(0x2705)} Measure leading indicators\n${String.fromCodePoint(0x2705)} Iterate weekly based on data\n\nThis framework has transformed ${possessive} approach to ${topic} entirely.`
    );
    threadPosts.push(
      `The biggest mistake ${pronoun} see people make?\n\nTrying to do everything at once. Start with ONE thing. Master it. Then expand.\n\n${topic} rewards depth over breadth. Every successful case ${verb} studying confirms this.`
    );
    threadPosts.push(
      `TL;DR:\n\n1. The old playbook for ${topic} is broken\n2. Focus on leading indicators\n3. Consistency > intensity\n4. Start small, iterate fast\n\nSave this thread and revisit it in 30 days. You'll thank yourself.\n\n${hashtags}`
    );
  } else {
    threadPosts.push(
      `Why it matters: The landscape around ${topic} changed. Old tactics don't work anymore.`
    );
    threadPosts.push(
      `The fix: Focus on systems over goals. Measure what moves the needle. Iterate weekly.`
    );
    threadPosts.push(
      `Bottom line: Start small, stay consistent, and let compounding do the work.\n\nSave this. ${hashtags}`
    );
  }

  return threadPosts.map((p) => p.slice(0, limit));
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AiResearchPipelineProps {
  onUseContent?: (content: string) => void;
  connectedPlatforms?: SocialAccount["platform"][];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiResearchPipeline({
  onUseContent,
  connectedPlatforms = ["twitter", "linkedin", "instagram"],
}: AiResearchPipelineProps) {
  // Form state
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState<OutputFormat>("short");
  const [tone, setTone] = useState<VoiceTone>("personal");
  const [platform, setPlatform] = useState<SocialAccount["platform"]>(
    connectedPlatforms[0] ?? "twitter"
  );
  const [withPictures, setWithPictures] = useState(false);

  // Pipeline state
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [stepSummaries, setStepSummaries] = useState<string[]>([]);
  const [generatedContent, setGeneratedContent] = useState<string[]>([]);
  const [displayedContent, setDisplayedContent] = useState<string[]>([]);
  const [editedContent, setEditedContent] = useState<string[]>([]);
  const [pipelineComplete, setPipelineComplete] = useState(false);

  const abortRef = useRef(false);

  // Reset pipeline
  const reset = useCallback(() => {
    setRunning(false);
    setCurrentStep(-1);
    setStepSummaries([]);
    setGeneratedContent([]);
    setDisplayedContent([]);
    setEditedContent([]);
    setPipelineComplete(false);
    abortRef.current = false;
  }, []);

  // Streaming effect for content display
  useEffect(() => {
    if (generatedContent.length === 0 || pipelineComplete) return;
    if (displayedContent.length === generatedContent.length) {
      // Check if all fully streamed
      const allDone = generatedContent.every(
        (c, i) => (displayedContent[i] ?? "").length >= c.length
      );
      if (allDone) {
        setPipelineComplete(true);
        setEditedContent([...generatedContent]);
      }
      return;
    }

    // Start streaming the next post that isn't fully displayed yet
    let postIdx = 0;
    for (let i = 0; i < generatedContent.length; i++) {
      if ((displayedContent[i] ?? "").length < generatedContent[i].length) {
        postIdx = i;
        break;
      }
    }

    const fullText = generatedContent[postIdx];
    const current = displayedContent[postIdx] ?? "";
    if (current.length >= fullText.length) return;

    const timer = setTimeout(() => {
      const charsToAdd = Math.min(3, fullText.length - current.length);
      const next = fullText.slice(0, current.length + charsToAdd);
      setDisplayedContent((prev) => {
        const updated = [...prev];
        while (updated.length <= postIdx) updated.push("");
        updated[postIdx] = next;
        return updated;
      });
    }, 12);

    return () => clearTimeout(timer);
  }, [generatedContent, displayedContent, pipelineComplete]);

  // Run pipeline
  const runPipeline = useCallback(async () => {
    if (topic.trim().length < 10) {
      toast.error("Please enter at least 10 characters for the topic");
      return;
    }

    reset();
    setRunning(true);
    abortRef.current = false;

    const summaries = generateStepSummaries(topic);

    // Start the API call in parallel with step animation
    let apiContent: string | null = null;
    let apiHashtags: string[] = [];
    let apiError = false;

    const apiPromise = (async () => {
      try {
        const res = await socialApi.ai.generate({
          topic,
          tone,
          platform,
        });
        apiContent = res.data.content;
        apiHashtags = res.data.hashtags ?? [];

        // Also fetch hashtags if not returned by generate
        if (apiHashtags.length === 0) {
          try {
            const hashRes = await socialApi.ai.hashtags(apiContent || topic);
            apiHashtags = hashRes.data.hashtags ?? [];
          } catch {
            // Hashtag fetch failed, continue without
          }
        }
      } catch {
        apiError = true;
      }
    })();

    // Run step animations (visual UX)
    for (let i = 0; i < PIPELINE_STEPS.length; i++) {
      if (abortRef.current) return;
      setCurrentStep(i);
      await new Promise((r) => setTimeout(r, PIPELINE_STEPS[i].delay));
      if (abortRef.current) return;
      setStepSummaries((prev) => [...prev, summaries[i]]);
    }

    // Wait for API to complete if it hasn't already
    await apiPromise;

    if (abortRef.current) return;

    // Use real API content or fall back to mock
    let content: string[];
    if (!apiError && apiContent) {
      // Append hashtags if we got them
      const hashtagSuffix = apiHashtags.length > 0 ? `\n\n${apiHashtags.join(" ")}` : "";
      const limit = getPlatformCharLimit(platform);
      const isThread = format === "thread-short" || format === "thread-long";

      if (isThread) {
        // Split API content into thread-sized pieces
        const fullText = apiContent + hashtagSuffix;
        const chunkSize = Math.floor(limit * 0.9);
        const posts: string[] = [];
        let remaining = fullText;
        while (remaining.length > 0) {
          if (remaining.length <= limit) {
            posts.push(remaining);
            break;
          }
          // Find a good break point
          let breakPoint = remaining.lastIndexOf("\n", chunkSize);
          if (breakPoint < chunkSize * 0.3) breakPoint = remaining.lastIndexOf(" ", chunkSize);
          if (breakPoint < chunkSize * 0.3) breakPoint = chunkSize;
          posts.push(remaining.slice(0, breakPoint).trim());
          remaining = remaining.slice(breakPoint).trim();
        }
        content = posts;
      } else {
        content = [(apiContent + hashtagSuffix).slice(0, limit)];
      }
    } else {
      // Fallback to mock
      content = generateMockContent(topic, format, tone, platform);
      if (apiError) {
        toast.error("AI service unavailable, using locally generated content");
      }
    }

    setGeneratedContent(content);
    setDisplayedContent(content.map(() => ""));
    setCurrentStep(PIPELINE_STEPS.length); // all done
    setRunning(false);
  }, [topic, format, tone, platform, reset]);

  const handleCancel = () => {
    abortRef.current = true;
    setRunning(false);
  };

  const handleUseInComposer = () => {
    const final = editedContent.join("\n\n---\n\n");
    onUseContent?.(final);
    toast.success("Content sent to composer");
  };

  const handleEditPost = (idx: number, value: string) => {
    setEditedContent((prev) => {
      const updated = [...prev];
      updated[idx] = value;
      return updated;
    });
  };

  const isThread = format === "thread-short" || format === "thread-long";

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wand2 className="w-5 h-5 text-purple-500" />
          AI Research Pipeline
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Multi-step AI content generation with research, analysis, and optimization.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ---------- Input Form ---------- */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pipeline-topic">Topic Description</Label>
            <Textarea
              id="pipeline-topic"
              placeholder="Describe what you want to post about (min 10 characters)..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              disabled={running}
            />
            <p className="text-xs text-muted-foreground">
              {topic.length} characters
              {topic.length > 0 && topic.length < 10 && (
                <span className="text-orange-500 ml-1">(need at least 10)</span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Output format */}
            <div className="space-y-2">
              <Label>Output Format</Label>
              <Select
                value={format}
                onValueChange={(v) => setFormat(v as OutputFormat)}
                disabled={running}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short post</SelectItem>
                  <SelectItem value="long">Long post</SelectItem>
                  <SelectItem value="thread-short">Thread (short posts)</SelectItem>
                  <SelectItem value="thread-long">Thread (long posts)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Platform */}
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select
                value={platform}
                onValueChange={(v) => setPlatform(v as SocialAccount["platform"])}
                disabled={running}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {connectedPlatforms.map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full inline-block"
                          style={{ backgroundColor: PLATFORM_COLORS[p] }}
                        />
                        {PLATFORM_LABELS[p]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tone */}
          <div className="space-y-2">
            <Label>Tone</Label>
            <RadioGroup
              value={tone}
              onValueChange={(v) => setTone(v as VoiceTone)}
              className="flex gap-6"
              disabled={running}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="personal" id="tone-personal" />
                <Label htmlFor="tone-personal" className="font-normal cursor-pointer">
                  Personal voice <span className="text-muted-foreground">(I / me)</span>
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="company" id="tone-company" />
                <Label htmlFor="tone-company" className="font-normal cursor-pointer">
                  Company voice <span className="text-muted-foreground">(We / us)</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Generate with pictures */}
          <div className="flex items-center gap-3">
            <Switch
              id="with-pictures"
              checked={withPictures}
              onCheckedChange={setWithPictures}
              disabled={running}
            />
            <Label htmlFor="with-pictures" className="cursor-pointer flex items-center gap-2">
              <Image className="w-4 h-4" />
              Generate with pictures
            </Label>
          </div>
        </div>

        <Separator />

        {/* ---------- Action buttons ---------- */}
        <div className="flex gap-2">
          <Button
            onClick={runPipeline}
            disabled={running || topic.trim().length < 10}
            className="flex-1"
          >
            {running ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {running ? "Generating..." : "Start Research Pipeline"}
          </Button>
          {running && (
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          )}
          {pipelineComplete && (
            <Button variant="outline" onClick={reset}>
              Reset
            </Button>
          )}
        </div>

        {/* ---------- Pipeline Steps ---------- */}
        {(running || currentStep >= 0) && (
          <div className="space-y-1">
            {PIPELINE_STEPS.map((step, i) => {
              const StepIcon = step.icon;
              const isDone = i < currentStep || currentStep === PIPELINE_STEPS.length;
              const isActive = i === currentStep && running;
              const isPending = i > currentStep;

              return (
                <div key={i} className="flex items-start gap-3 py-2">
                  {/* Status indicator */}
                  <div className="flex-shrink-0 mt-0.5">
                    {isDone ? (
                      <div className="w-6 h-6 rounded-full bg-green-500/15 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      </div>
                    ) : isActive ? (
                      <div className="w-6 h-6 rounded-full bg-purple-500/15 flex items-center justify-center">
                        <Loader2 className="w-3.5 h-3.5 text-purple-600 animate-spin" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        <Circle className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Step content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <StepIcon
                        className={`w-4 h-4 ${
                          isDone
                            ? "text-green-600"
                            : isActive
                              ? "text-purple-600"
                              : "text-muted-foreground"
                        }`}
                      />
                      <span
                        className={`text-sm font-medium ${
                          isPending ? "text-muted-foreground" : ""
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {isDone && stepSummaries[i] && (
                      <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                        {stepSummaries[i]}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ---------- Generated Content ---------- */}
        {generatedContent.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {isThread
                    ? `Generated Thread (${generatedContent.length} posts)`
                    : "Generated Content"}
                </h3>
                {pipelineComplete && (
                  <Badge variant="secondary" className="text-xs">
                    <Check className="w-3 h-3 mr-1" />
                    Ready
                  </Badge>
                )}
              </div>

              {generatedContent.map((_, idx) => {
                const displayed = displayedContent[idx] ?? "";
                const edited = editedContent[idx] ?? "";
                const showEditable = pipelineComplete;
                const text = showEditable ? edited : displayed;
                const charLimit = getPlatformCharLimit(platform);
                const isOver = text.length > charLimit;

                return (
                  <Card key={idx} className="border">
                    <CardHeader className="py-2 px-4">
                      <CardTitle className="text-xs flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: PLATFORM_COLORS[platform] }}
                          />
                          {isThread ? `Post ${idx + 1} of ${generatedContent.length}` : PLATFORM_LABELS[platform]}
                        </span>
                        {showEditable && (
                          <span
                            className={`font-normal ${isOver ? "text-red-500" : "text-muted-foreground"}`}
                          >
                            {text.length}/{charLimit}
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      {showEditable ? (
                        <Textarea
                          value={edited}
                          onChange={(e) => handleEditPost(idx, e.target.value)}
                          rows={Math.max(3, Math.ceil(edited.length / 80))}
                          className={isOver ? "border-red-400" : ""}
                        />
                      ) : (
                        <div className="text-sm whitespace-pre-wrap min-h-[60px] p-3 rounded-md bg-muted/50">
                          {displayed}
                          {displayed.length < (generatedContent[idx]?.length ?? 0) && (
                            <span className="inline-block w-0.5 h-4 bg-purple-500 animate-pulse ml-0.5 align-text-bottom" />
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {pipelineComplete && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={runPipeline}>
                    <Sparkles className="w-4 h-4 mr-1" />
                    Regenerate
                  </Button>
                  <Button size="sm" onClick={handleUseInComposer}>
                    <PenTool className="w-4 h-4 mr-1" />
                    Use in Composer
                  </Button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ---------- Pictures note ---------- */}
        {withPictures && pipelineComplete && (
          <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
            Image generation will be available in the AI Image Generator tab.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
