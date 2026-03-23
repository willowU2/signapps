"use client";

import { useState } from "react";
import { Home, Info } from "lucide-react";

interface Room {
  id: string;
  name: string;
  area: number;
  description: string;
  floor: number;
}

const ROOMS: Room[] = [
  { id: "1", name: "Reception", area: 25, description: "Main entrance and reception area", floor: 1 },
  { id: "2", name: "Conference Room", area: 40, description: "Large meeting space", floor: 1 },
  { id: "3", name: "Office 1", area: 20, description: "Individual workspace", floor: 1 },
  { id: "4", name: "Office 2", area: 20, description: "Individual workspace", floor: 1 },
  { id: "5", name: "Break Room", area: 30, description: "Kitchen and break area", floor: 1 },
  { id: "6", name: "Server Room", area: 15, description: "IT infrastructure", floor: 1 },
  { id: "7", name: "Storage", area: 50, description: "General storage", floor: 2 },
  { id: "8", name: "Office 3", area: 25, description: "Individual workspace", floor: 2 },
  { id: "9", name: "Restrooms", area: 20, description: "Facilities", floor: 2 },
];

export function BuildingPlans() {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const selectedRoom = ROOMS.find((r) => r.id === selectedRoomId);

  const floors = [1, 2];
  const roomsPerFloor = (floor: number) => ROOMS.filter((r) => r.floor === floor);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Building Floor Plans</h2>
          <p className="text-gray-600">View and manage building layout and rooms</p>
        </div>
        <Home className="w-8 h-8 text-blue-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Floor Plans */}
        <div className="lg:col-span-2 space-y-6">
          {floors.map((floor) => (
            <div key={floor} className="rounded-lg border bg-white p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Floor {floor}</h3>
              <div className="grid grid-cols-3 gap-3">
                {roomsPerFloor(floor).map((room) => (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedRoomId === room.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 bg-gray-50"
                    }`}
                  >
                    <p className="font-semibold text-gray-900 text-sm">{room.name}</p>
                    <p className="text-xs text-gray-600 mt-1">{room.area} m²</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Room Details */}
        <div className="space-y-4">
          {selectedRoom ? (
            <div className="rounded-lg border bg-white p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedRoom.name}</h3>
                  <p className="text-sm text-gray-600">Floor {selectedRoom.floor}</p>
                </div>
                <Info className="w-5 h-5 text-blue-600" />
              </div>

              <div className="space-y-3">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase">Area</p>
                  <p className="text-2xl font-bold text-gray-900">{selectedRoom.area} m²</p>
                </div>

                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase">Description</p>
                  <p className="text-sm text-gray-900 mt-1">{selectedRoom.description}</p>
                </div>

                <div className="rounded-lg bg-green-50 p-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase">Status</p>
                  <p className="text-sm text-green-900 font-semibold mt-1">Available</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors">
                  Edit Room Details
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-gray-50 p-6 text-center">
              <Home className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Select a room to view details</p>
            </div>
          )}

          {/* Stats */}
          <div className="rounded-lg border bg-white p-4">
            <p className="text-xs font-semibold text-gray-600 uppercase mb-3">Building Stats</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Rooms</span>
                <span className="font-semibold text-gray-900">{ROOMS.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Area</span>
                <span className="font-semibold text-gray-900">{ROOMS.reduce((sum, r) => sum + r.area, 0)} m²</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Floors</span>
                <span className="font-semibold text-gray-900">{floors.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
