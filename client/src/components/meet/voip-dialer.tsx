"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, PhoneOff, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  number: string;
}

const DIALPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

const QUICK_CONTACTS: Contact[] = [
  { id: "1", name: "Support", number: "+33123456789" },
  { id: "2", name: "Accueil", number: "+33987654321" },
  { id: "3", name: "Facturation", number: "+33456789123" },
];

export function VoIPDialer() {
  const [dialedNumber, setDialedNumber] = useState("");
  const [isCallActive, setIsCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const handleDialKey = (key: string) => {
    setDialedNumber((prev) => prev + key);
  };

  const handleBackspace = () => {
    setDialedNumber((prev) => prev.slice(0, -1));
  };

  const handleCall = (number?: string) => {
    const numberToCall = number || dialedNumber;
    if (!numberToCall.trim()) return;
    setIsCallActive(true);
    setCallDuration(0);
  };

  const handleHangup = () => {
    setIsCallActive(false);
    setDialedNumber("");
    setCallDuration(0);
  };

  const handleQuickDial = (contact: Contact) => {
    setDialedNumber(contact.number);
    handleCall(contact.number);
  };

  return (
    <div className="w-full max-w-sm space-y-4 p-4 border border-border/50 rounded-lg bg-card">
      {/* Display */}
      <div className="text-center space-y-2">
        <div className="bg-muted rounded-lg p-4">
          <div className="text-3xl font-mono font-bold tracking-widest text-primary min-h-10">
            {dialedNumber || "-"}
          </div>
        </div>

        {/* Call Timer */}
        {isCallActive && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {String(Math.floor(callDuration / 60)).padStart(2, "0")}:
              {String(callDuration % 60).padStart(2, "0")}
            </span>
          </div>
        )}
      </div>

      {/* Dialpad Grid */}
      <div className="grid grid-cols-3 gap-2">
        {DIALPAD.map((key) => (
          <Button
            key={key}
            variant="outline"
            size="lg"
            onClick={() => handleDialKey(key)}
            disabled={isCallActive}
            className="h-12 text-lg font-semibold"
          >
            {key}
          </Button>
        ))}
      </div>

      {/* Control Buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1 h-10"
          onClick={handleBackspace}
          disabled={isCallActive || dialedNumber.length === 0}
        >
          ← Effacer
        </Button>
      </div>

      {/* Call/Hangup Buttons */}
      <div className="flex gap-2">
        {!isCallActive ? (
          <Button
            onClick={() => handleCall()}
            disabled={!dialedNumber.trim()}
            className="flex-1 gap-2 bg-green-600 hover:bg-green-700 h-10"
          >
            <Phone className="h-4 w-4" />
            Appeler
          </Button>
        ) : (
          <Button
            onClick={handleHangup}
            className="flex-1 gap-2 bg-destructive hover:bg-destructive/90 h-10"
          >
            <PhoneOff className="h-4 w-4" />
            Raccrocher
          </Button>
        )}
      </div>

      {/* Quick Contacts */}
      <div className="space-y-2 pt-2 border-t border-border/50">
        <p className="text-xs font-medium text-muted-foreground">
          Contacts rapides
        </p>
        <div className="space-y-1">
          {QUICK_CONTACTS.map((contact) => (
            <Button
              key={contact.id}
              variant="ghost"
              className="w-full h-9 justify-start text-sm"
              onClick={() => handleQuickDial(contact)}
              disabled={isCallActive}
            >
              <span className="flex-1 text-left">{contact.name}</span>
              <Badge variant="secondary" className="text-xs font-mono">
                {contact.number.slice(-4)}
              </Badge>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
