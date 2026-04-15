"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Coins,
  Send,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TokenTransaction {
  id: string;
  type: "send" | "receive";
  amount: number;
  from: string;
  to: string;
  timestamp: string;
  status: "completed" | "pending";
}

interface EmployeeTokensProps {
  balance?: number;
  employeeId?: string;
  transactions?: TokenTransaction[];
  onSend?: (recipientId: string, amount: number) => Promise<void>;
  onReceive?: () => Promise<void>;
}

export function EmployeeTokens({
  balance = 0,
  employeeId = "emp-001",
  transactions = [],
  onSend,
  onReceive,
}: EmployeeTokensProps) {
  const [sendOpen, setSendOpen] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [amount, setAmount] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!recipientId || !amount) return;

    setIsSending(true);
    try {
      await onSend?.(recipientId, parseFloat(amount));
      setRecipientId("");
      setAmount("");
      setSendOpen(false);
    } finally {
      setIsSending(false);
    }
  };

  const getTransactionColor = (transaction: TokenTransaction) => {
    if (transaction.type === "send") {
      return "text-red-600 bg-red-50";
    }
    return "text-green-600 bg-green-50";
  };

  return (
    <div className="space-y-4">
      {/* Balance Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-blue-900">
              Token Balance
            </CardTitle>
            <Coins className="w-5 h-5 text-blue-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-4xl font-bold text-blue-900">
                {balance.toLocaleString()}
              </p>
              <p className="text-xs text-blue-700 mt-1">Tokens Available</p>
            </div>

            <div className="flex gap-2">
              <Dialog open={sendOpen} onOpenChange={setSendOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    size="sm"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send Tokens</DialogTitle>
                    <DialogDescription>
                      Transfer tokens to another employee
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">
                        Recipient ID
                      </label>
                      <Input
                        placeholder="emp-xxx"
                        value={recipientId}
                        onChange={(e) => setRecipientId(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Amount</label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="mt-1"
                        min="0"
                      />
                    </div>
                    <Button
                      onClick={handleSend}
                      disabled={isSending || !recipientId || !amount}
                      className="w-full"
                    >
                      {isSending ? "Sending..." : "Send Tokens"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onReceive?.()}
              >
                <Download className="w-4 h-4 mr-2" />
                Receive
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction History</CardTitle>
          <CardDescription className="text-xs">
            Your recent token transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-6">
              <Coins className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className={cn(
                    "p-3 rounded-lg border flex items-center justify-between",
                    getTransactionColor(transaction),
                  )}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {transaction.type === "send" ? (
                      <ArrowUpRight className="w-5 h-5 flex-shrink-0" />
                    ) : (
                      <ArrowDownLeft className="w-5 h-5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {transaction.type === "send" ? "To" : "From"}{" "}
                        <span className="font-mono text-xs">
                          {transaction.type === "send"
                            ? transaction.to
                            : transaction.from}
                        </span>
                      </p>
                      <p className="text-xs opacity-75 mt-1">
                        {new Date(transaction.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <span className="text-sm font-semibold">
                      {transaction.type === "send" ? "-" : "+"}
                      {transaction.amount}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-xs capitalize whitespace-nowrap"
                    >
                      {transaction.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
