"use client"

import { useState } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MonitorSmartphone, Shield, Server, Plug, Settings, History, Lock, Eye, Terminal } from "lucide-react"

export default function RemoteAccessDashboard() {
    const [connections, setConnections] = useState([
        { id: 1, name: "WKST-JDOE-01", type: "RDP", user: "jdoe", status: "Offline", last_accessed: "2 hours ago" },
        { id: 2, name: "SRV-WEB-01", type: "SSH", user: "root", status: "Active", last_accessed: "Just now" },
        { id: 3, name: "Ubuntu-Desktop", type: "VNC", user: "admin", status: "Offline", last_accessed: "Yesterday" },
    ])

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">Remote Access</h1>
                        <p className="text-muted-foreground mt-1 text-sm">Secure, browser-based access to your infrastructure via RDP, VNC, and SSH.</p>
                    </div>
                    <Button className="shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white">
                        <Plug className="mr-2 h-4 w-4" /> New Connection
                    </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-border/50 bg-card overflow-hidden relative group">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500 transform translate-y-1 group-hover:translate-y-0 transition-transform"></div>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Gateway Status</CardTitle>
                            <Shield className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-600">Secure & Online</div>
                            <p className="text-xs text-muted-foreground mt-1">Guacamole translation layer active</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-card overflow-hidden relative group">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 transform translate-y-1 group-hover:translate-y-0 transition-transform"></div>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                            <MonitorSmartphone className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold font-mono">1</div>
                            <p className="text-xs text-muted-foreground mt-1">Currently connected users</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-card overflow-hidden relative group">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 transform translate-y-1 group-hover:translate-y-0 transition-transform"></div>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Saved Endpoints</CardTitle>
                            <Server className="h-4 w-4 text-muted-foreground group-hover:text-purple-500 transition-colors" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{connections.length}</div>
                            <p className="text-xs text-muted-foreground mt-1">Configured for quick access</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-card overflow-hidden relative group">
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500 transform translate-y-1 group-hover:translate-y-0 transition-transform"></div>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Audit Logs</CardTitle>
                            <History className="h-4 w-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">14</div>
                            <p className="text-xs text-muted-foreground mt-1">Events recorded today</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {connections.map((conn) => (
                        <Card key={conn.id} className="group hover:border-blue-500/50 transition-colors cursor-pointer overflow-hidden relative">
                            <div className={`absolute top-0 right-0 w-16 h-16 transform translate-x-8 -translate-y-8 rotate-45 ${conn.type === 'RDP' ? 'bg-blue-500/10' : conn.type === 'SSH' ? 'bg-zinc-500/10' : 'bg-purple-500/10'}`}></div>
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-2 rounded-md ${conn.type === 'RDP' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                                            conn.type === 'SSH' ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' :
                                                'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                                            }`}>
                                            {conn.type === 'SSH' ? <Terminal className="h-5 w-5" /> : <MonitorSmartphone className="h-5 w-5" />}
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">{conn.name}</CardTitle>
                                            <CardDescription className="flex items-center gap-1 mt-0.5">
                                                <Lock className="h-3 w-3" /> {conn.user}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <span className="text-xs font-semibold px-2 py-1 rounded bg-muted/60 text-muted-foreground border">
                                        {conn.type}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="pb-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <span className={`relative flex h-2 w-2`}>
                                            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${conn.status === 'Active' ? 'animate-ping bg-emerald-400' : ''}`}></span>
                                            <span className={`relative inline-flex rounded-full h-2 w-2 ${conn.status === 'Active' ? 'bg-emerald-500' : 'bg-zinc-400'}`}></span>
                                        </span>
                                        {conn.status}
                                    </span>
                                    <span className="text-muted-foreground text-xs">{conn.last_accessed}</span>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-2 border-t mt-4 flex justify-between bg-muted/20">
                                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                                    <Settings className="h-4 w-4 mr-2" />
                                    Configure
                                </Button>
                                <Button size="sm" className="bg-primary/90 hover:bg-primary shadow-sm">
                                    <Eye className="h-4 w-4 mr-2" />
                                    Connect
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </div>
        </AppLayout>
    )
}
