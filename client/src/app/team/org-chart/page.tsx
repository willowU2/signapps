'use client'

import React, { useMemo } from 'react'
import { useTeamMembers, useTeamMember, useOrgTree } from '@/lib/scheduling/api/team'
import { TalentCardNode } from '@/components/team/TalentCardNode'
import { ReactFlow, Controls, Background, MiniMap, Node, Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AppLayout } from '@/components/layout/app-layout'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AtSign, Briefcase, Calendar } from 'lucide-react'
import { useState } from 'react'
import type { BackendOrgTreeNode } from '@/lib/scheduling/api/team'

const nodeTypes = {
    talentCard: TalentCardNode
}

// Helper to flatten the orgTree and build a map of orgNodeId -> parentOrgNodeId
function flattenOrgTree(nodes: BackendOrgTreeNode[], parentId: string | null = null, acc: Map<string, string | null> = new Map(), names: Map<string, string> = new Map()) {
    nodes.forEach(node => {
        acc.set(node.id, parentId);
        names.set(node.id, node.name);
        if (node.children) {
            flattenOrgTree(node.children, node.id, acc, names);
        }
    });
    return { acc, names };
}

export default function OrgChartPage() {
    const { data: members = [], isLoading: loadingMembers } = useTeamMembers()
    const { data: orgTree = [], isLoading: loadingTree } = useOrgTree()
    
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
    const { data: selectedMember } = useTeamMember(selectedMemberId || '')

    // Transform team members into ReactFlow nodes and edges
    const { nodes, edges } = useMemo(() => {
        const flowNodes: Node[] = []
        const flowEdges: Edge[] = []

        if (!members.length || !orgTree.length) return { nodes: flowNodes, edges: flowEdges }

        const { acc: orgParents, names: orgNames } = flattenOrgTree(orgTree);

        // Group members by orgNodeId
        const membersByOrg = new Map<string, typeof members>();
        members.forEach(m => {
            if (m.orgNodeId) {
                if (!membersByOrg.has(m.orgNodeId)) membersByOrg.set(m.orgNodeId, []);
                membersByOrg.get(m.orgNodeId)!.push(m);
            }
        });

        const HORIZONTAL_SPACING = 350;
        const VERTICAL_SPACING = 300;

        // Naive BFS layout
        const queue: { orgNodeId: string, depth: number, xStart: number }[] = [];
        
        // Find root org nodes (those whose parent is null)
        const rootOrgs = orgTree.map(o => o.id);

        let currentDepth = 0;
        let xOffset = 0;

        // Very naive layout: we simply assign positions by depth
        const depthCounts = new Map<number, number>();

        members.forEach(member => {
            if (!member.orgNodeId) return;
            
            // Calculate depth by traversing up orgParents
            let depth = 0;
            let currentOrg = member.orgNodeId;
            while (currentOrg && orgParents.get(currentOrg)) {
                depth++;
                currentOrg = orgParents.get(currentOrg)!;
            }

            const countAtDepth = depthCounts.get(depth) || 0;
            const x = countAtDepth * HORIZONTAL_SPACING + 100;
            const y = depth * VERTICAL_SPACING + 50;

            // Enrich member with department name
            const enrichedMember = {
                ...member,
                department: orgNames.get(member.orgNodeId) || member.department
            };

            flowNodes.push({
                id: member.id,
                type: 'talentCard',
                position: { x, y },
                data: { member: enrichedMember }
            });

            depthCounts.set(depth, countAtDepth + 1);

            // Connect to parent OrgNode's first member (Pseudo manager connection)
            const parentOrgId = orgParents.get(member.orgNodeId);
            if (parentOrgId) {
                const parentMembers = membersByOrg.get(parentOrgId);
                if (parentMembers && parentMembers.length > 0) {
                    // Just connect to the first person in the parent department
                    const manager = parentMembers[0];
                    flowEdges.push({
                        id: `e-${manager.id}-${member.id}`,
                        source: manager.id,
                        target: member.id,
                        animated: true
                    });
                }
            }
        });

        return { nodes: flowNodes, edges: flowEdges }
    }, [members, orgTree])

    const isLoading = loadingMembers || loadingTree;

    return (
        <AppLayout>
            <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] w-full">
                <div className="flex items-center text-sm text-muted-foreground p-6 pb-2">
                    Team &gt; Workforce Explorer
                </div>
                <div className="flex items-center justify-between px-6 pb-6 border-b">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Organigramme Interactif</h1>
                        <p className="text-muted-foreground mt-1">Explorez la structure de l'entreprise via une vue cartographique.</p>
                    </div>
                </div>

                <div className="flex-1 w-full bg-muted/20 relative">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center">Chargement...</div>
                    ) : (
                        <ReactFlow 
                            nodes={nodes} 
                            edges={edges}
                            nodeTypes={nodeTypes}
                            fitView
                            minZoom={0.2}
                            onNodeClick={(_, node) => setSelectedMemberId(node.id)}
                        >
                            <Controls />
                            <MiniMap />
                            <Background gap={12} size={1} />
                        </ReactFlow>
                    )}
                </div>
            </div>

            {/* User Details Sidebar */}
            <Sheet open={!!selectedMemberId} onOpenChange={(open) => !open && setSelectedMemberId(null)}>
                <SheetContent className="sm:max-w-md overflow-y-auto">
                    {selectedMember ? (
                        <>
                            <SheetHeader className="text-left space-y-4">
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-16 w-16">
                                        <AvatarImage src={selectedMember.avatarUrl} alt={selectedMember.name} />
                                        <AvatarFallback>{selectedMember.name.substring(0,2)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <SheetTitle className="text-2xl">{selectedMember.name}</SheetTitle>
                                        <SheetDescription className="text-base text-primary font-medium">
                                            {selectedMember.role}
                                        </SheetDescription>
                                    </div>
                                </div>
                            </SheetHeader>
                            
                            <div className="py-6 space-y-6">
                                {/* Details list */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 text-sm">
                                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <p className="font-medium">Département</p>
                                            <p className="text-muted-foreground">{selectedMember.department || 'Non assigné'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <AtSign className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <p className="font-medium">Adresse Email</p>
                                            <a href={`mailto:${selectedMember.email}`} className="text-primary hover:underline">{selectedMember.email}</a>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <p className="font-medium">Zone horaire</p>
                                            <p className="text-muted-foreground">{selectedMember.workingHours?.timezone || 'Europe/Paris'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Placeholder for Tasks/Schedule */}
                                <div className="border-t pt-6">
                                    <h4 className="font-semibold mb-4">Emploi du temps (Aujourd'hui)</h4>
                                    <div className="bg-muted/50 rounded-lg p-4 text-sm text-center text-muted-foreground">
                                        Aucune réunion planifiée pour ce collaborateur aujourd'hui.
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                            Chargement du profil...
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </AppLayout>
    )
}
