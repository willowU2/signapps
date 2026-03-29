"use client";

import { useState } from "react";
import { FileText, Check, Calendar, User } from "lucide-react";

interface NDASigning {
  signatoryName: string;
  signatoryEmail: string;
  signatoryRole: string;
  signedAt: string | null;
  isSigned: boolean;
}

const NDA_PREVIEW = `MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of the date below between SignApps Platform ("Disclosing Party") and the signatory ("Receiving Party").

1. CONFIDENTIAL INFORMATION
Confidential Information means all non-public information disclosed by one party to the other, including but not limited to:
- Technical data and specifications
- Business plans and strategies
- Financial information
- Customer lists and trade secrets
- Any information marked as confidential

2. OBLIGATIONS
The Receiving Party agrees to:
- Keep Confidential Information strictly confidential
- Limit disclosure to employees with a need to know
- Implement reasonable security measures
- Not use the information for any purpose other than the intended purpose

3. TERM
This Agreement shall remain in effect for three (3) years from the date of signature.

4. GOVERNING LAW
This Agreement shall be governed by applicable laws.`;

export function NDAAutoSign() {
  const [signatories, setSignatories] = useState<NDASigning[]>([
    {
      signatoryName: "John Smith",
      signatoryEmail: "john.smith@company.com",
      signatoryRole: "Business Development Manager",
      signedAt: "2026-03-20 14:30",
      isSigned: true,
    },
    {
      signatoryName: "Sarah Johnson",
      signatoryEmail: "sarah.johnson@company.com",
      signatoryRole: "Legal Counsel",
      signedAt: null,
      isSigned: false,
    },
  ]);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("");
  const [showPreview, setShowPreview] = useState(true);

  const handleAddSignatory = () => {
    if (newName && newEmail && newRole) {
      const newSignatory: NDASigning = {
        signatoryName: newName,
        signatoryEmail: newEmail,
        signatoryRole: newRole,
        signedAt: null,
        isSigned: false,
      };
      setSignatories([...signatories, newSignatory]);
      setNewName("");
      setNewEmail("");
      setNewRole("");
    }
  };

  const handleSign = (index: number) => {
    const updated = [...signatories];
    updated[index].isSigned = true;
    updated[index].signedAt = new Date().toLocaleString();
    setSignatories(updated);
  };

  const signedCount = signatories.filter((s) => s.isSigned).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">NDA Auto-Sign</h2>
          <p className="text-muted-foreground">
            Digital signature tracking for mutual NDAs
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700 font-medium">Signature Progress</p>
        <p className="text-2xl font-bold text-blue-900">
          {signedCount}/{signatories.length} Signed
        </p>
        <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${(signedCount / signatories.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="border rounded-lg overflow-hidden bg-card">
          <div className="bg-muted border-b p-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">NDA Template</h3>
          </div>

          <div className="p-4 max-h-96 overflow-y-auto">
            <div className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
              {NDA_PREVIEW}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="border rounded-lg p-4 bg-card">
            <h3 className="font-semibold text-foreground mb-4">Add Signatory</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Full Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
              <input
                type="email"
                placeholder="Email Address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Job Title/Role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAddSignatory}
                disabled={!newName || !newEmail || !newRole}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg text-sm"
              >
                Add Signatory
              </button>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden bg-card">
            <div className="bg-muted border-b p-4">
              <h3 className="font-semibold text-foreground">Signatories</h3>
            </div>

            <div className="divide-y max-h-64 overflow-y-auto">
              {signatories.map((sig, idx) => (
                <div key={idx} className="p-4 hover:bg-muted">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-foreground">{sig.signatoryName}</p>
                      <p className="text-xs text-muted-foreground">{sig.signatoryEmail}</p>
                      <p className="text-xs text-muted-foreground mt-1">{sig.signatoryRole}</p>
                    </div>
                    {sig.isSigned ? (
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-green-600 mb-1">
                          <Check className="w-4 h-4" />
                          <span className="text-xs font-medium">Signed</span>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {sig.signedAt}
                        </p>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSign(idx)}
                        className="text-blue-600 hover:text-blue-700 text-xs font-medium px-3 py-1 border border-blue-600 rounded hover:bg-blue-50"
                      >
                        Sign
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-green-50 border-green-200">
        <div className="flex items-center gap-2 mb-2">
          <Check className="w-5 h-5 text-green-600" />
          <p className="font-semibold text-green-900">Signed Documents</p>
        </div>
        <p className="text-sm text-green-800">
          All signed documents are timestamped and legally binding. Downloads are watermarked.
        </p>
      </div>
    </div>
  );
}
