"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Server, MonitorSmartphone, Target, Cpu, HardDrive, Network, Plus, ShieldCheck, Download, Trash, Webhook } from "lucide-react"
import { itAssetsApi, HardwareAsset, CreateHardwareRequest } from "@/lib/api/it-assets"

// Extended type for UI compatibility
interface HardwareDisplay extends HardwareAsset {
    hardware_type?: string;
    mac_address?: string;
    ip_address?: string;
}

export default function ITAssetsDashboard() {
    const [hardwareList, setHardwareList] = useState<HardwareDisplay[]>([])
    const [isCreating, setIsCreating] = useState(false)
    const [newDevice, setNewDevice] = useState<Partial<HardwareDisplay>>({
        hardware_type: "laptop",
        status: "active"
    })

    useEffect(() => {
        loadHardware()
    }, [])

    const loadHardware = async () => {
        try {
            const response = await itAssetsApi.listHardware()
            // Map backend type field to hardware_type for UI
            const mapped = (response.data || []).map(h => ({
                ...h,
                hardware_type: h.type,
            }))
            setHardwareList(mapped)
        } catch (error) {
            console.error("Failed to load hardware:", error)
        }
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newDevice.name) return

        try {
            const createData: CreateHardwareRequest = {
                name: newDevice.name,
                type: newDevice.hardware_type || 'laptop',
                location: newDevice.location,
                notes: newDevice.notes,
            }
            await itAssetsApi.createHardware(createData)
            setIsCreating(false)
            setNewDevice({ hardware_type: "laptop", status: "active" })
            loadHardware()
        } catch (error) {
            console.error("Failed to create", error)
            alert("Failed to create device. Check if backend is running.")
        }
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'server': return <Server className="h-5 w-5 text-blue-500" />
            case 'switch': return <Network className="h-5 w-5 text-purple-500" />
            case 'workstation': return <Cpu className="h-5 w-5 text-indigo-500" />
            default: return <MonitorSmartphone className="h-5 w-5 text-emerald-500" />
        }
    }

    const activeCount = hardwareList.filter(h => h.status === 'active').length
    const serverCount = hardwareList.filter(h => h.hardware_type === 'server').length

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">IT Assets</h1>
                        <p className="text-muted-foreground mt-1 text-sm">Manage your hardware inventory and deployments.</p>
                    </div>
                    <Button onClick={() => setIsCreating(!isCreating)} className="shadow-lg shadow-primary/20">
                        <Plus className="h-4 w-4 mr-2" />
                        {isCreating ? "Cancel" : "Add Device"}
                    </Button>
                </div>

                {/* Dashboard Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-border/50 bg-card overflow-hidden relative group">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 transform translate-y-1 group-hover:translate-y-0 transition-transform"></div>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
                            <Target className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{hardwareList.length}</div>
                            <p className="text-xs text-muted-foreground mt-1">Recorded physical devices</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-card overflow-hidden relative group">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 transform translate-y-1 group-hover:translate-y-0 transition-transform"></div>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Active Status</CardTitle>
                            <ShieldCheck className="h-4 w-4 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{activeCount}</div>
                            <p className="text-xs text-muted-foreground mt-1">Devices currently deployed</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-card overflow-hidden relative group">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-purple-500 to-fuchsia-500 transform translate-y-1 group-hover:translate-y-0 transition-transform"></div>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Datacenter</CardTitle>
                            <Server className="h-4 w-4 text-muted-foreground group-hover:text-purple-500 transition-colors" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{serverCount}</div>
                            <p className="text-xs text-muted-foreground mt-1">Rack servers and appliances</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-card overflow-hidden relative group">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-orange-500 to-amber-500 transform translate-y-1 group-hover:translate-y-0 transition-transform"></div>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">PXE Deployments</CardTitle>
                            <Download className="h-4 w-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">0</div>
                            <p className="text-xs text-muted-foreground mt-1">Pending automated installs</p>
                        </CardContent>
                    </Card>
                </div>

                {isCreating && (
                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="text-lg">Register New Hardware</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Name / Hostname</Label>
                                    <Input required placeholder="E.g. WKST-JDOE-01" value={newDevice.name || ''} onChange={e => setNewDevice({ ...newDevice, name: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <select
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={newDevice.hardware_type} onChange={e => setNewDevice({ ...newDevice, hardware_type: e.target.value })}
                                    >
                                        <option value="laptop">Laptop / Notebook</option>
                                        <option value="workstation">Desktop Workstation</option>
                                        <option value="server">Server Rack</option>
                                        <option value="switch">Network Switch</option>
                                        <option value="printer">Printer</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label>MAC Address</Label>
                                    <Input placeholder="00:11:22:33:44:55" value={newDevice.mac_address || ''} onChange={e => setNewDevice({ ...newDevice, mac_address: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>IP Address</Label>
                                    <Input placeholder="192.168.1.50" value={newDevice.ip_address || ''} onChange={e => setNewDevice({ ...newDevice, ip_address: e.target.value })} />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label>Status</Label>
                                    <select
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={newDevice.status} onChange={e => setNewDevice({ ...newDevice, status: e.target.value })}
                                    >
                                        <option value="active">Active (Deployed)</option>
                                        <option value="stock">In Stock (Available)</option>
                                        <option value="maintenance">Maintenance required</option>
                                        <option value="decommissioned">Decommissioned</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2 flex justify-end">
                                    <Button type="submit">Save Asset</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Hardware Inventory</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Asset Name</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Network</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {hardwareList.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                                                No hardware found in inventory.
                                            </TableCell>
                                        </TableRow>
                                    ) : hardwareList.map((device) => (
                                        <TableRow key={device.id} className="group">
                                            <TableCell className="font-medium flex items-center gap-2">
                                                {getIcon(device.hardware_type || '')}
                                                {device.name}
                                            </TableCell>
                                            <TableCell className="capitalize">{device.hardware_type}</TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${device.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                                        device.status === 'stock' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                                                            device.status === 'maintenance' ? 'bg-orange-500/10 text-orange-600 border-orange-500/20' :
                                                                'bg-muted text-muted-foreground border-border'
                                                    }`}>
                                                    {device.status}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-xs font-mono">{device.ip_address || "DHCP"}</div>
                                                <div className="text-xs text-muted-foreground font-mono">{device.mac_address || "No MAC"}</div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Remote Connect">
                                                    <Webhook className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" title="PXE Deploy">
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    )
}
