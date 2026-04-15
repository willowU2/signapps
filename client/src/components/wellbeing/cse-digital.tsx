"use client";

import { useEffect, useState } from "react";
import { Heart, Gift, ShoppingBag, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BenefitCard {
  id: string;
  name: string;
  description: string;
  provider: string;
  discount: number;
  category: string;
}

export default function CseDigital() {
  const [myBenefits, setMyBenefits] = useState<string[]>(["gym", "dental"]);
  const [activeTab, setActiveTab] = useState<"all" | "my">("all");

  const benefits: BenefitCard[] = [
    {
      id: "gym",
      name: "Fitness Premium",
      description: "Access to all fitness centers nationwide",
      provider: "FitnessPro",
      discount: 30,
      category: "Health",
    },
    {
      id: "dental",
      name: "Dental Care",
      description: "Comprehensive dental coverage and treatments",
      provider: "SmileCare",
      discount: 25,
      category: "Health",
    },
    {
      id: "vision",
      name: "Vision Care",
      description: "Eye exams and prescription glasses",
      provider: "ClearView",
      discount: 20,
      category: "Health",
    },
    {
      id: "spa",
      name: "Wellness Spa",
      description: "Massage, sauna, and relaxation services",
      provider: "RelaxZone",
      discount: 40,
      category: "Wellness",
    },
    {
      id: "travel",
      name: "Travel Insurance",
      description: "International travel protection plan",
      provider: "SafeJourney",
      discount: 15,
      category: "Travel",
    },
    {
      id: "culture",
      name: "Culture & Cinema",
      description: "Movie tickets and cultural events",
      provider: "EntertainGo",
      discount: 35,
      category: "Entertainment",
    },
    {
      id: "online",
      name: "Online Learning",
      description: "Courses and professional development",
      provider: "SkillMaster",
      discount: 50,
      category: "Education",
    },
    {
      id: "nutrition",
      name: "Nutrition Coach",
      description: "Personalized meal plans and coaching",
      provider: "NutriWell",
      discount: 45,
      category: "Wellness",
    },
  ];

  const toggleBenefit = (id: string) => {
    setMyBenefits((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
    );
  };

  const displayedBenefits =
    activeTab === "all"
      ? benefits
      : benefits.filter((b) => myBenefits.includes(b.id));

  const categories = Array.from(
    new Set(benefits.map((b) => b.category)),
  ).sort();

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-2xl font-bold">CSE Digital Benefits</h2>

      {/* My Benefits Summary */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Gift className="w-5 h-5 text-pink-500" />
          Your Benefits
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          You have {myBenefits.length} active benefit
          {myBenefits.length !== 1 ? "s" : ""}
        </p>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {myBenefits.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No benefits selected yet
            </p>
          ) : (
            myBenefits.map((id) => {
              const benefit = benefits.find((b) => b.id === id);
              return benefit ? (
                <div
                  key={id}
                  className="flex justify-between items-center bg-card p-2 rounded border border-purple-100"
                >
                  <span className="text-sm font-medium">{benefit.name}</span>
                  <span className="text-sm font-bold text-pink-600">
                    -{benefit.discount}%
                  </span>
                </div>
              ) : null;
            })
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 font-medium border-b-2 transition-all ${
            activeTab === "all"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          All Benefits ({benefits.length})
        </button>
        <button
          onClick={() => setActiveTab("my")}
          className={`px-4 py-2 font-medium border-b-2 transition-all ${
            activeTab === "my"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          My Benefits ({myBenefits.length})
        </button>
      </div>

      {/* Benefits Grid */}
      <div className="grid grid-cols-1 gap-3">
        {displayedBenefits.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No benefits in this category</p>
          </div>
        ) : (
          displayedBenefits.map((benefit) => (
            <div
              key={benefit.id}
              className={`p-4 rounded-lg border-2 transition-all ${
                myBenefits.includes(benefit.id)
                  ? "border-green-400 bg-green-50"
                  : "border-border bg-card hover:border-blue-300"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h4 className="font-bold text-foreground">{benefit.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {benefit.description}
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs bg-muted px-2 py-1 rounded">
                      <ShoppingBag className="w-3 h-3 inline mr-1" />
                      {benefit.provider}
                    </span>
                    <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-bold">
                      -{benefit.discount}%
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => toggleBenefit(benefit.id)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    myBenefits.includes(benefit.id)
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-muted-foreground hover:bg-blue-200 hover:text-blue-600"
                  }`}
                >
                  {myBenefits.includes(benefit.id) ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                </button>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" className="flex-1 text-xs">
                  View Details
                </Button>
                <Button
                  size="sm"
                  className="flex-1 text-xs bg-blue-600 hover:bg-blue-700"
                >
                  Claim Discount
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <Heart className="w-5 h-5" />
          About CSE Digital
        </h3>
        <p className="text-sm text-blue-800">
          Access exclusive employee benefits and discounts through our CSE
          Digital platform. Select your favorite benefits to start saving today.
        </p>
      </div>
    </div>
  );
}

function Plus({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}
