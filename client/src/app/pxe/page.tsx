"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Terminal, Upload, Play, Settings, RefreshCw, HardDrive, Cpu, FileJson, CheckCircle2 } from "lucide-react"

export default function PXEDashboard() {
    const [profiles, setProfiles] = useState<any[]>([])

    useEffect(() => {
        // Fetch PXE profiles (mocking for initial empty DB)
        setProfiles([
            { id: 1, name: "Ubuntu 24.04 LTS (Auto-Install)", os_type: "Linux", status: "Active", is_default: true, updated_at: "Just now" },
            { id: 2, name: "Windows Server 2022 (Unattended)", os_type: "Windows", status: "Active", is_default: false, updated_at: "2 days ago" },
            { id: 3, name: "Memtest86+ Diagnostics", os_type: "Tool", status: "Active", is_default: false, updated_at: "1 week ago" }
        ])
    }, [])

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-500 to-amber-700 bg-clip-text text-transparent">PXE Deployment Server</h1>
                        <p className="text-muted-foreground mt-1 text-sm">Manage network boot profiles, ISO images, and automated installations.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="shadow-sm">
                            <Upload className="mr-2 h-4 w-4" /> Upload ISO
                        </Button>
                        <Button className="shadow-lg shadow-amber-500/20 bg-amber-600 hover:bg-amber-700 text-white">
                            <Terminal className="mr-2 h-4 w-4" /> Create Profile
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="border-border/50 bg-card overflow-hidden relative group">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 transform translate-y-1 group-hover:translate-y-0 transition-transform"></div>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">TFTP Status</CardTitle>
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold font-mono">Online</div>
                            <p className="text-xs text-muted-foreground mt-1">Listening on UDP port 69</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-card overflow-hidden relative group">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500 transform translate-y-1 group-hover:translate-y-0 transition-transform"></div>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Active Boot Profiles</CardTitle>
                            <FileJson className="h-4 w-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{profiles.length}</div>
                            <p className="text-xs text-muted-foreground mt-1">Configured iPXE scripts</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-card overflow-hidden relative group">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 transform translate-y-1 group-hover:translate-y-0 transition-transform"></div>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Recent Deployments</CardTitle>
                            <Cpu className="h-4 w-4 text-muted-foreground group-hover:text-purple-500 transition-colors" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">0</div>
                            <p className="text-xs text-muted-foreground mt-1">In the last 7 days</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Boot Profiles</CardTitle>
                        <CardDescription>Network boot configurations available to clients.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Profile Name</TableHead>
                                        <TableHead>OS Type</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Last Updated</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {profiles.map(profile => (
                                        <TableRow key={profile.id} className="group cursor-pointer">
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <Terminal className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                    {profile.name}
                                                    {profile.is_default && (
                                                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-primary/20 text-primary font-semibold uppercase">Default</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{profile.os_type}</TableCell>
                                            <TableCell>
                                                <span className="flex w-fit items-center gap-1.5 px-2 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 font-medium text-xs">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    {profile.status}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{profile.updated_at}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Settings className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Play className="h-4 w-4" />
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
