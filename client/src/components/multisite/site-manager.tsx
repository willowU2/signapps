"use client";

import { useEffect, useState } from "react";
import { MapPin, Users, Plus, Edit2, ToggleLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Site {
  id: string;
  name: string;
  address: string;
  employeeCount: number;
  status: "active" | "inactive";
}

export function SiteManager() {
  const [sites, setSites] = useState<Site[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newSite, setNewSite] = useState({ name: "", address: "", employeeCount: 0 });

  useEffect(() => {
    setSites([
      { id: "s1", name: "New York HQ", address: "123 Park Ave, New York, NY 10001", employeeCount: 450, status: "active" },
      { id: "s2", name: "San Francisco Office", address: "456 Market St, San Francisco, CA 94102", employeeCount: 280, status: "active" },
      { id: "s3", name: "Chicago Branch", address: "789 Michigan Ave, Chicago, IL 60611", employeeCount: 120, status: "inactive" },
      { id: "s4", name: "Boston Tech Center", address: "321 Newbury St, Boston, MA 02115", employeeCount: 95, status: "active" },
    ]);
  }, []);

  const handleAddSite = () => {
    if (newSite.name && newSite.address) {
      setSites([
        ...sites,
        {
          id: `s${sites.length + 1}`,
          ...newSite,
          status: "active",
        },
      ]);
      setNewSite({ name: "", address: "", employeeCount: 0 });
      setShowForm(false);
    }
  };

  const toggleStatus = (id: string) => {
    setSites(
      sites.map((site) =>
        site.id === id
          ? { ...site, status: site.status === "active" ? "inactive" : "active" }
          : site
      )
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Site Management</h2>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Site
        </Button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 bg-blue-50">
          <h3 className="font-semibold mb-3">Add New Site</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Site Name</label>
              <input
                type="text"
                value={newSite.name}
                onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                placeholder="e.g., New York HQ"
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Address</label>
              <input
                type="text"
                value={newSite.address}
                onChange={(e) => setNewSite({ ...newSite, address: e.target.value })}
                placeholder="Street address"
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Employee Count</label>
              <input
                type="number"
                value={newSite.employeeCount}
                onChange={(e) => setNewSite({ ...newSite, employeeCount: parseInt(e.target.value) || 0 })}
                placeholder="0"
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddSite} size="sm">
                Save Site
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sites.map((site) => (
          <div key={site.id} className="border rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-lg">{site.name}</h3>
                <div className="flex items-center space-x-1 mt-1 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{site.address}</span>
                </div>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded ${
                site.status === "active"
                  ? "bg-green-100 text-green-800"
                  : "bg-muted text-gray-800"
              }`}>
                {site.status === "active" ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="flex items-center space-x-2 mb-4">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="font-medium">{site.employeeCount} employees</span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Edit2 className="w-4 h-4" />
                Edit
              </Button>
              <Button
                variant={site.status === "active" ? "outline" : "default"}
                size="sm"
                onClick={() => toggleStatus(site.id)}
                className="gap-2"
              >
                <ToggleLeft className="w-4 h-4" />
                {site.status === "active" ? "Deactivate" : "Activate"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
