"use client";

import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export type AdvCondRule =
  | {
      id: string;
      type: "basic";
      condType: "gt" | "lt" | "eq" | "between" | "text" | "empty" | "notEmpty";
      value: string;
      value2?: string;
      color: string;
    }
  | {
      id: string;
      type: "color_scale";
      minColor: string;
      midColor?: string;
      maxColor: string;
    }
  | { id: string; type: "data_bar"; color: string; showValue: boolean }
  | {
      id: string;
      type: "icon_set";
      iconSet: "arrows" | "traffic" | "stars";
      thresholds: [number, number];
    };

interface AdvCondFormatDialogProps {
  rules: AdvCondRule[];
  onAdd: (rule: AdvCondRule) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 9);

export function AdvancedCondFormatDialog({
  rules,
  onAdd,
  onRemove,
  onClose,
}: AdvCondFormatDialogProps) {
  const [activeTab, setActiveTab] = useState<
    "basic" | "color_scale" | "data_bar" | "icon_set"
  >("basic");

  // basic state
  const [condType, setCondType] = useState<
    "gt" | "lt" | "eq" | "between" | "text" | "empty" | "notEmpty"
  >("gt");
  const [val, setVal] = useState("");
  const [val2, setVal2] = useState("");
  const [color, setColor] = useState("#34a853");

  // color scale state
  const [csMin, setCsMin] = useState("#ea4335");
  const [csMid, setCsMid] = useState("#fbbc04");
  const [csMax, setCsMax] = useState("#34a853");
  const [useMid, setUseMid] = useState(false);

  // data bar state
  const [dbColor, setDbColor] = useState("#4a86e8");
  const [showVal, setShowVal] = useState(true);

  // icon set state
  const [iconSet, setIconSet] = useState<"arrows" | "traffic" | "stars">(
    "traffic",
  );
  const [th1, setTh1] = useState("33");
  const [th2, setTh2] = useState("67");

  const handleAdd = () => {
    if (activeTab === "basic") {
      if (condType !== "empty" && condType !== "notEmpty" && !val) {
        toast.error("Valeur requise");
        return;
      }
      onAdd({
        id: uid(),
        type: "basic",
        condType,
        value: val,
        value2: val2 || undefined,
        color,
      });
    } else if (activeTab === "color_scale") {
      onAdd({
        id: uid(),
        type: "color_scale",
        minColor: csMin,
        midColor: useMid ? csMid : undefined,
        maxColor: csMax,
      });
    } else if (activeTab === "data_bar") {
      onAdd({
        id: uid(),
        type: "data_bar",
        color: dbColor,
        showValue: showVal,
      });
    } else if (activeTab === "icon_set") {
      const t1 = Number(th1),
        t2 = Number(th2);
      if (isNaN(t1) || isNaN(t2)) {
        toast.error("Seuils invalides");
        return;
      }
      onAdd({ id: uid(), type: "icon_set", iconSet, thresholds: [t1, t2] });
    }
    toast.success("Règle ajoutée");
  };

  const TABS = [
    { id: "basic", label: "Couleur" },
    { id: "color_scale", label: "Échelle couleurs" },
    { id: "data_bar", label: "Barres données" },
    { id: "icon_set", label: "Jeux d'icônes" },
  ] as const;

  const ruleLabel = (rule: AdvCondRule) => {
    if (rule.type === "basic")
      return `${rule.condType} ${rule.value} → ${rule.color}`;
    if (rule.type === "color_scale")
      return `Échelle: ${rule.minColor} → ${rule.maxColor}`;
    if (rule.type === "data_bar") return `Barre: ${rule.color}`;
    return `Icônes: ${rule.iconSet}`;
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-[200]"
      onClick={onClose}
    >
      <div
        className="bg-background dark:bg-[#2d2e30] rounded-xl shadow-2xl p-4 w-[440px] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm">
            Mise en forme conditionnelle avancée
          </span>
          <button onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Existing rules */}
        {rules.length > 0 && (
          <div className="mb-3 space-y-1 max-h-28 overflow-y-auto">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-2 px-2 py-1 bg-muted rounded text-[11px]"
              >
                {rule.type === "data_bar" && (
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: rule.color }}
                  />
                )}
                {rule.type === "color_scale" && (
                  <div
                    className="w-12 h-3 rounded-sm"
                    style={{
                      background: `linear-gradient(to right, ${rule.minColor}, ${rule.maxColor})`,
                    }}
                  />
                )}
                <span className="flex-1 truncate">{ruleLabel(rule)}</span>
                <button
                  onClick={() => onRemove(rule.id)}
                  className="text-red-400 hover:text-red-600 shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-3 bg-muted rounded-lg p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`flex-1 text-[11px] py-1 rounded-md font-medium transition-colors ${activeTab === tab.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "basic" && (
          <div className="space-y-2">
            <select
              className="w-full h-8 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none"
              value={condType}
              onChange={(e) => setCondType(e.target.value as typeof condType)}
            >
              <option value="gt">Supérieur à</option>
              <option value="lt">Inférieur à</option>
              <option value="eq">Égal à</option>
              <option value="between">Entre</option>
              <option value="text">Contient</option>
              <option value="empty">Est vide</option>
              <option value="notEmpty">N'est pas vide</option>
            </select>
            {condType !== "empty" && condType !== "notEmpty" && (
              <div className="flex gap-2">
                <input
                  className="flex-1 h-8 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none"
                  placeholder="Valeur"
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                />
                {condType === "between" && (
                  <input
                    className="flex-1 h-8 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none"
                    placeholder="Valeur 2"
                    value={val2}
                    onChange={(e) => setVal2(e.target.value)}
                  />
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[12px]">Couleur de fond :</span>
              <div className="flex gap-1">
                {[
                  "#34a853",
                  "#ea4335",
                  "#fbbc04",
                  "#4a86e8",
                  "#ff6d01",
                  "#9334e6",
                  "#46bdc6",
                  "#f06292",
                ].map((c) => (
                  <button
                    key={c}
                    className={`w-5 h-5 rounded-sm border-2 ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer"
                title="Couleur personnalisée"
              />
            </div>
          </div>
        )}

        {activeTab === "color_scale" && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Min</span>
                <input
                  type="color"
                  value={csMin}
                  onChange={(e) => setCsMin(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border"
                />
              </div>
              <div className="flex flex-col items-center gap-1">
                <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useMid}
                    onChange={(e) => setUseMid(e.target.checked)}
                    className="accent-[#1a73e8]"
                  />
                  Mid
                </label>
                <input
                  type="color"
                  value={csMid}
                  onChange={(e) => setCsMid(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border"
                  disabled={!useMid}
                />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Max</span>
                <input
                  type="color"
                  value={csMax}
                  onChange={(e) => setCsMax(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border"
                />
              </div>
            </div>
            <div
              className="h-4 rounded-sm"
              style={{
                background: useMid
                  ? `linear-gradient(to right, ${csMin}, ${csMid}, ${csMax})`
                  : `linear-gradient(to right, ${csMin}, ${csMax})`,
              }}
            />
          </div>
        )}

        {activeTab === "data_bar" && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-[12px]">Couleur :</span>
              <input
                type="color"
                value={dbColor}
                onChange={(e) => setDbColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border"
              />
            </div>
            <label className="flex items-center gap-2 text-[12px] cursor-pointer">
              <input
                type="checkbox"
                checked={showVal}
                onChange={(e) => setShowVal(e.target.checked)}
                className="accent-[#1a73e8]"
              />
              Afficher la valeur dans la cellule
            </label>
            <div className="h-6 rounded flex items-center px-1 text-[10px] text-white font-medium overflow-hidden bg-muted dark:bg-gray-800">
              <div
                className="h-full rounded"
                style={{ width: "60%", backgroundColor: dbColor }}
              />
              {showVal && (
                <span className="ml-1 text-foreground text-[10px]">60</span>
              )}
            </div>
          </div>
        )}

        {activeTab === "icon_set" && (
          <div className="space-y-2">
            <select
              className="w-full h-8 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none"
              value={iconSet}
              onChange={(e) => setIconSet(e.target.value as typeof iconSet)}
            >
              <option value="traffic">Feux tricolores (🔴 🟡 🟢)</option>
              <option value="arrows">Flèches (↓ → ↑)</option>
              <option value="stars">Étoiles (★★★)</option>
            </select>
            <div className="flex items-center gap-2 text-[12px]">
              <span>Seuil bas :</span>
              <input
                type="number"
                className="w-16 h-7 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none"
                value={th1}
                onChange={(e) => setTh1(e.target.value)}
              />
              <span>% | Seuil haut :</span>
              <input
                type="number"
                className="w-16 h-7 bg-[#f1f3f4] dark:bg-[#3c4043] rounded px-2 text-[12px] outline-none"
                value={th2}
                onChange={(e) => setTh2(e.target.value)}
              />
              <span>%</span>
            </div>
            <div className="flex gap-2 text-lg">
              {iconSet === "traffic" && (
                <>
                  <span>🔴</span>
                  <span className="text-[11px] self-end text-muted-foreground">
                    ≤{th1}%
                  </span>
                  <span>🟡</span>
                  <span className="text-[11px] self-end text-muted-foreground">
                    {th1}–{th2}%
                  </span>
                  <span>🟢</span>
                  <span className="text-[11px] self-end text-muted-foreground">
                    ≥{th2}%
                  </span>
                </>
              )}
              {iconSet === "arrows" && (
                <>
                  <span>↓</span>
                  <span className="text-[11px] self-end text-muted-foreground">
                    ≤{th1}%
                  </span>
                  <span>→</span>
                  <span className="text-[11px] self-end text-muted-foreground">
                    {th1}–{th2}%
                  </span>
                  <span>↑</span>
                  <span className="text-[11px] self-end text-muted-foreground">
                    ≥{th2}%
                  </span>
                </>
              )}
              {iconSet === "stars" && (
                <>
                  <span>☆</span>
                  <span className="text-[11px] self-end text-muted-foreground">
                    ≤{th1}%
                  </span>
                  <span>★</span>
                  <span className="text-[11px] self-end text-muted-foreground">
                    {th1}–{th2}%
                  </span>
                  <span>★★</span>
                  <span className="text-[11px] self-end text-muted-foreground">
                    ≥{th2}%
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleAdd}
          className="w-full h-8 mt-3 bg-[#1a73e8] text-white rounded text-[13px] font-medium hover:bg-[#1557b0] flex items-center justify-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Ajouter la règle
        </button>
      </div>
    </div>
  );
}
