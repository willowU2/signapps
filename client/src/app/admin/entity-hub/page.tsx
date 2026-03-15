"use client";

import { useEffect } from "react";
import { useEntityStore } from "@/stores/entity-hub-store";
import { useUIStore } from "@/lib/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Calendar as CalendarIcon, Server, FolderRoot, CheckSquare, Clock, Plus } from "lucide-react";

export default function EntityHubAdminPage() {
  const {
    workspaces,
    calendars,
    resources,
    projects,
    tasks,
    events,
    isLoading,
    fetchWorkspaces,
    fetchCalendars,
    fetchResources,
    fetchProjects,
    fetchTasks,
    fetchEvents,
  } = useEntityStore();

  const {
    setCreateWorkspaceModalOpen,
    setCreateProjectModalOpen,
    setCreateTaskModalOpen,
  } = useUIStore();

  useEffect(() => {
    fetchWorkspaces();
    fetchCalendars();
    fetchResources();
    fetchProjects();
    fetchTasks();
    fetchEvents();
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Entity Hub</h1>
        <p className="text-muted-foreground mt-2">
          Manage unified calendars, projects, workspaces, and resources across the tenant.
        </p>
      </div>

      <Tabs defaultValue="workspaces" className="w-full">
        <TabsList className="grid grid-cols-6 w-full lg:w-[800px]">
          <TabsTrigger value="workspaces"><Building2 className="w-4 h-4 mr-2" /> Workspaces</TabsTrigger>
          <TabsTrigger value="calendars"><CalendarIcon className="w-4 h-4 mr-2" /> Calendars</TabsTrigger>
          <TabsTrigger value="resources"><Server className="w-4 h-4 mr-2" /> Resources</TabsTrigger>
          <TabsTrigger value="projects"><FolderRoot className="w-4 h-4 mr-2" /> Projects</TabsTrigger>
          <TabsTrigger value="tasks"><CheckSquare className="w-4 h-4 mr-2" /> Tasks</TabsTrigger>
          <TabsTrigger value="events"><Clock className="w-4 h-4 mr-2" /> Events</TabsTrigger>
        </TabsList>

        <TabsContent value="workspaces" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Workspaces</CardTitle>
                <CardDescription>Logical groups within the tenant.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setCreateWorkspaceModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Workspace
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p>Loading workspaces...</p>
              ) : workspaces.length === 0 ? (
                <p className="text-sm text-muted-foreground">No workspaces found.</p>
              ) : (
                <ul className="space-y-2">
                  {workspaces.map((w) => (
                    <li key={w.id} className="border p-3 rounded-md">{w.name}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendars" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Calendars</CardTitle>
              <CardDescription>Unified calendars context.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p>Loading calendars...</p>
              ) : calendars.length === 0 ? (
                <p className="text-sm text-muted-foreground">No calendars found.</p>
              ) : (
                <ul className="space-y-2">
                  {calendars.map((c) => (
                    <li key={c.id} className="border p-3 rounded-md">{c.name}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ... Similar TabsContent for Resources, Projects, Tasks, Events ... */}
        <TabsContent value="resources" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Resources (Rooms & Equipment)</CardTitle>
              <CardDescription>Manage bookable equipment and meeting rooms.</CardDescription>
            </CardHeader>
            <CardContent>
              {resources.length === 0 ? <p className="text-sm text-muted-foreground">No resources found.</p> : null}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="projects" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Projects</CardTitle>
                <CardDescription>Manage agile projects and roadmaps.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setCreateProjectModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? <p className="text-sm text-muted-foreground">No projects found.</p> : (
                <ul className="space-y-2">
                  {projects.map((p) => (
                    <li key={p.id} className="border p-3 rounded-md">{p.name}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tasks" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Tasks</CardTitle>
                <CardDescription>Manage detailed project steps.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setCreateTaskModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Task
              </Button>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? <p className="text-sm text-muted-foreground">No tasks found.</p> : (
                <ul className="space-y-2">
                  {tasks.map((t) => (
                    <li key={t.id} className="border p-3 rounded-md">{t.title}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="events" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Events</CardTitle>
              <CardDescription>Browse active calendar events.</CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? <p className="text-sm text-muted-foreground">No events found.</p> : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
