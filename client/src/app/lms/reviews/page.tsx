"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Star, ThumbsUp, BookOpen, Plus, Filter } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/use-page-title";

interface Review {
  id: string;
  courseId: string;
  courseName: string;
  author: string;
  initials: string;
  rating: number;
  title: string;
  content: string;
  helpful: number;
  markedHelpful: boolean;
  createdAt: Date;
}

const REVIEWS: Review[] = [
  {
    id: "1",
    courseId: "1",
    courseName: "Intro to SignApps",
    author: "Alice M.",
    initials: "AM",
    rating: 5,
    title: "Excellent onboarding course!",
    content:
      "Very well structured and easy to follow. The hands-on exercises really help solidify the concepts. Highly recommend for all new employees.",
    helpful: 24,
    markedHelpful: false,
    createdAt: new Date(Date.now() - 3 * 86400000),
  },
  {
    id: "2",
    courseId: "1",
    courseName: "Intro to SignApps",
    author: "Bob K.",
    initials: "BK",
    rating: 4,
    title: "Good course, could use more examples",
    content:
      "The content is solid and the instructor explains things clearly. I would love to see more real-world examples in the document management section.",
    helpful: 12,
    markedHelpful: false,
    createdAt: new Date(Date.now() - 7 * 86400000),
  },
  {
    id: "3",
    courseId: "2",
    courseName: "Advanced Documents",
    author: "Carol P.",
    initials: "CP",
    rating: 5,
    title: "Transformed how our team works!",
    content:
      "This course completely changed how I use SignApps Docs. The template system and workflow automation sections are pure gold. Worth every minute.",
    helpful: 31,
    markedHelpful: false,
    createdAt: new Date(Date.now() - 14 * 86400000),
  },
  {
    id: "4",
    courseId: "3",
    courseName: "Security Essentials",
    author: "Dave L.",
    initials: "DL",
    rating: 5,
    title: "Must-take for any admin",
    content:
      "The section on RBAC and audit logs is extremely thorough. I implemented several recommendations immediately after finishing. Our security posture improved significantly.",
    helpful: 18,
    markedHelpful: false,
    createdAt: new Date(Date.now() - 21 * 86400000),
  },
  {
    id: "5",
    courseId: "1",
    courseName: "Intro to SignApps",
    author: "Eve S.",
    initials: "ES",
    rating: 3,
    title: "Good but a bit slow-paced",
    content:
      "The content is accurate and helpful, but I felt the first two lessons could be condensed. Would be great to have an advanced track option.",
    helpful: 8,
    markedHelpful: false,
    createdAt: new Date(Date.now() - 5 * 86400000),
  },
];

const COURSES = [
  "All",
  "Intro to SignApps",
  "Advanced Documents",
  "Security Essentials",
  "Calendar Mastery",
];

function StarRating({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: "sm" | "md";
}) {
  const [hover, setHover] = useState(0);
  const sz = size === "sm" ? "h-3.5 w-3.5" : "h-6 w-6";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          className={cn(!onChange && "cursor-default")}
        >
          <Star
            className={cn(
              sz,
              (hover || value) >= n
                ? "text-yellow-500 fill-yellow-500"
                : "text-muted-foreground",
            )}
          />
        </button>
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  usePageTitle("Evaluations");
  const [reviews, setReviews] = useState<Review[]>(REVIEWS);
  const [courseFilter, setCourseFilter] = useState("All");
  const [ratingFilter, setRatingFilter] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    courseId: "1",
    courseName: "Intro to SignApps",
    rating: 0,
    title: "",
    content: "",
  });

  const filtered = reviews.filter((r) => {
    const matchCourse = courseFilter === "All" || r.courseName === courseFilter;
    const matchRating = ratingFilter === 0 || r.rating === ratingFilter;
    return matchCourse && matchRating;
  });

  const avgRating = (rs: Review[]) =>
    rs.length
      ? (rs.reduce((a, r) => a + r.rating, 0) / rs.length).toFixed(1)
      : "—";
  const ratingDist = [5, 4, 3, 2, 1].map((n) => ({
    stars: n,
    count: filtered.filter((r) => r.rating === n).length,
  }));

  const markHelpful = (id: string) => {
    setReviews((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              helpful: r.markedHelpful ? r.helpful - 1 : r.helpful + 1,
              markedHelpful: !r.markedHelpful,
            }
          : r,
      ),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.rating || !form.title.trim() || !form.content.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    const rev: Review = {
      id: Date.now().toString(),
      courseId: form.courseId,
      courseName: form.courseName,
      author: "You",
      initials: "ME",
      rating: form.rating,
      title: form.title,
      content: form.content,
      helpful: 0,
      markedHelpful: false,
      createdAt: new Date(),
    };
    setReviews([rev, ...reviews]);
    setForm({
      courseId: "1",
      courseName: "Intro to SignApps",
      rating: 0,
      title: "",
      content: "",
    });
    setOpen(false);
    toast.success("Avis soumis !");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Star className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Course Ratings & Reviews</h1>
              <p className="text-sm text-muted-foreground">
                5-star ratings and written feedback for courses
              </p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Write Review
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Write a Review</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Course</label>
                  <select
                    value={form.courseName}
                    onChange={(e) =>
                      setForm({ ...form, courseName: e.target.value })
                    }
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {COURSES.slice(1).map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Rating</label>
                  <div className="mt-2">
                    <StarRating
                      value={form.rating}
                      onChange={(r) => setForm({ ...form, rating: r })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Review Title</label>
                  <input
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    placeholder="Sum up your experience..."
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Detailed Review</label>
                  <Textarea
                    value={form.content}
                    onChange={(e) =>
                      setForm({ ...form, content: e.target.value })
                    }
                    placeholder="Share your experience..."
                    rows={4}
                    className="mt-1"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit">Submit Review</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Summary */}
          <Card>
            <CardContent className="p-5 text-center space-y-3">
              <div className="text-5xl font-bold">{avgRating(filtered)}</div>
              <StarRating
                value={Math.round(parseFloat(avgRating(filtered) || "0"))}
                size="sm"
              />
              <p className="text-xs text-muted-foreground">
                {filtered.length} reviews
              </p>
              <div className="space-y-1.5">
                {ratingDist.map(({ stars, count }) => (
                  <div key={stars} className="flex items-center gap-2 text-xs">
                    <span className="w-2 text-right">{stars}</span>
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />
                    <Progress
                      value={
                        filtered.length ? (count / filtered.length) * 100 : 0
                      }
                      className="h-1.5 flex-1"
                    />
                    <span className="w-4 text-right text-muted-foreground">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Reviews */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex flex-wrap gap-2">
              {COURSES.map((c) => (
                <Button
                  key={c}
                  size="sm"
                  variant={courseFilter === c ? "default" : "outline"}
                  onClick={() => setCourseFilter(c)}
                >
                  {c}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <span className="text-sm text-muted-foreground self-center flex items-center gap-1">
                <Filter className="h-3.5 w-3.5" />
                Stars:
              </span>
              {[0, 5, 4, 3, 2, 1].map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={ratingFilter === n ? "default" : "outline"}
                  onClick={() => setRatingFilter(n)}
                  className="h-7 px-2 text-xs"
                >
                  {n === 0 ? "All" : `${n}★`}
                </Button>
              ))}
            </div>
            {filtered.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs">
                        {r.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          {r.author}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          <BookOpen className="h-3 w-3 mr-1" />
                          {r.courseName}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatDistanceToNow(r.createdAt, {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <StarRating value={r.rating} size="sm" />
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{r.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {r.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <button
                      onClick={() => markHelpful(r.id)}
                      className={cn(
                        "flex items-center gap-1 hover:text-foreground transition-colors",
                        r.markedHelpful && "text-primary",
                      )}
                    >
                      <ThumbsUp
                        className={cn(
                          "h-3.5 w-3.5",
                          r.markedHelpful && "fill-current",
                        )}
                      />
                      Helpful ({r.helpful})
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
                  <Star className="h-8 w-8 mb-2 opacity-30" />
                  <p>No reviews match your filters</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
