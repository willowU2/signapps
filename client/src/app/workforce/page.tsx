'use client';

/**
 * Workforce Management Page
 *
 * Main dashboard for organizational structure, employees, and coverage.
 * P0 Feature - Critical gap identified in brainstorming session.
 */

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Users,
  Calendar,
  AlertTriangle,
  Plus,
  Search,
  ChevronRight,
  Network,
  LayoutGrid,
  List,
  Filter,
  Download,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { OrgTreeList } from '@/components/workforce/org-tree-list';
import { EmployeeList } from '@/components/workforce/employee-list';
import { ValidationDashboard } from '@/components/workforce/validation-dashboard';
import { OrgNodeSheet } from '@/components/workforce/org-node-sheet';
import { EmployeeSheet } from '@/components/workforce/employee-sheet';
import { CoverageEditor } from '@/components/workforce/coverage-editor';
import { orgNodesApi, employeesApi, validationApi } from '@/lib/api/workforce';
import type { OrgNodeWithStats, EmployeeWithDetails, ValidateCoverageResponse, WeeklyPattern } from '@/types/workforce';

// Empty pattern for coverage editor
const EMPTY_COVERAGE_PATTERN: WeeklyPattern = {
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
};

type ActiveTab = 'org-tree' | 'employees' | 'validation' | 'coverage';

export default function WorkforcePage() {
  const [activeTab, setActiveTab] = React.useState<ActiveTab>('org-tree');
  const [selectedNode, setSelectedNode] = React.useState<OrgNodeWithStats | null>(null);
  const [selectedEmployee, setSelectedEmployee] = React.useState<EmployeeWithDetails | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [coveragePattern, setCoveragePattern] = React.useState<WeeklyPattern>(EMPTY_COVERAGE_PATTERN);

  // Sheet states
  const [isNodeSheetOpen, setIsNodeSheetOpen] = React.useState(false);
  const [isEmployeeSheetOpen, setIsEmployeeSheetOpen] = React.useState(false);
  const [isCoverageSheetOpen, setIsCoverageSheetOpen] = React.useState(false);
  const [nodeSheetParentId, setNodeSheetParentId] = React.useState<string | undefined>();

  // Queries
  const { data: treeData, isLoading: isTreeLoading } = useQuery({
    queryKey: ['workforce', 'tree'],
    queryFn: () => orgNodesApi.getTree({ max_depth: 10 }),
  });

  const { data: employeesData, isLoading: isEmployeesLoading } = useQuery({
    queryKey: ['workforce', 'employees', selectedNode?.id, searchQuery],
    queryFn: () => employeesApi.list({
      org_node_id: selectedNode?.id,
      include_descendants: true,
      search: searchQuery || undefined,
      page_size: 100,
    }),
  });

  // Stats for header cards
  const stats = React.useMemo(() => {
    const nodes = treeData?.data || [];
    const totalNodes = nodes.reduce((acc, node) => acc + 1 + (node.descendant_count || 0), 0);
    const totalEmployees = employeesData?.data?.total || 0;

    return {
      totalNodes,
      totalEmployees,
      activeEmployees: employeesData?.data?.employees?.filter(e => e.status === 'active').length || 0,
    };
  }, [treeData, employeesData]);

  // Handlers
  const handleSelectNode = (node: OrgNodeWithStats) => {
    setSelectedNode(node);
  };

  const handleAddNode = (parentId?: string) => {
    setNodeSheetParentId(parentId);
    setSelectedNode(null);
    setIsNodeSheetOpen(true);
  };

  const handleEditNode = (node: OrgNodeWithStats) => {
    setSelectedNode(node);
    setNodeSheetParentId(node.parent_id || undefined);
    setIsNodeSheetOpen(true);
  };

  const handleAddEmployee = () => {
    setSelectedEmployee(null);
    setIsEmployeeSheetOpen(true);
  };

  const handleEditEmployee = (employee: EmployeeWithDetails) => {
    setSelectedEmployee(employee);
    setIsEmployeeSheetOpen(true);
  };

  const handleEditCoverage = (node: OrgNodeWithStats) => {
    setSelectedNode(node);
    setIsCoverageSheetOpen(true);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Gestion des Effectifs
            </h1>
            <p className="text-sm text-muted-foreground">
              Structure organisationnelle, employés et couverture
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Exporter
            </Button>
            <Button variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" />
              Importer
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unités</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalNodes}</div>
              <p className="text-xs text-muted-foreground">
                Nœuds organisationnels
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Employés</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEmployees}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeEmployees} actifs
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Couverture</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">87%</div>
              <p className="text-xs text-muted-foreground">
                Taux de couverture global
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertes</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">3</div>
              <p className="text-xs text-muted-foreground">
                Gaps de couverture
              </p>
            </CardContent>
          </Card>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Org Tree */}
        <aside className="hidden w-80 flex-shrink-0 border-r lg:block">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-medium">Organisation</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleAddNode()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {isTreeLoading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <OrgTreeList
                  selectedNodeId={selectedNode?.id}
                  onSelectNode={handleSelectNode}
                  onAddNode={handleAddNode}
                  onEditNode={handleEditNode}
                  showEmployeeCounts
                />
              )}
            </div>
          </div>
        </aside>

        {/* Main Panel */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)} className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-4">
              <TabsList className="h-12">
                <TabsTrigger value="org-tree" className="gap-2">
                  <Network className="h-4 w-4" />
                  <span className="hidden sm:inline">Structure</span>
                </TabsTrigger>
                <TabsTrigger value="employees" className="gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Employés</span>
                </TabsTrigger>
                <TabsTrigger value="validation" className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="hidden sm:inline">Validation</span>
                </TabsTrigger>
                <TabsTrigger value="coverage" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">Couverture</span>
                </TabsTrigger>
              </TabsList>

              {/* Context: Selected Node */}
              {selectedNode && (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="gap-1">
                    <Building2 className="h-3 w-3" />
                    {selectedNode.name}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedNode(null)}
                  >
                    Effacer
                  </Button>
                </div>
              )}
            </div>

            <TabsContent value="org-tree" className="flex-1 overflow-auto p-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(treeData?.data || []).map((node) => (
                  <Card
                    key={node.id}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-muted/50',
                      selectedNode?.id === node.id && 'ring-2 ring-primary'
                    )}
                    onClick={() => handleSelectNode(node)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{node.name}</CardTitle>
                        <Badge variant="secondary">{node.node_type}</Badge>
                      </div>
                      {node.code && (
                        <CardDescription>{node.code}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Network className="h-3.5 w-3.5" />
                          {node.descendant_count} sous-unités
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {node.employee_count} employés
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="employees" className="flex-1 overflow-hidden p-0">
              <div className="flex h-full flex-col">
                {/* Toolbar */}
                <div className="flex items-center justify-between border-b px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-64 pl-8"
                      />
                    </div>
                    <Button variant="outline" size="sm">
                      <Filter className="mr-2 h-4 w-4" />
                      Filtres
                    </Button>
                  </div>
                  <Button size="sm" onClick={handleAddEmployee}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nouvel employé
                  </Button>
                </div>

                {/* Employee List */}
                <div className="flex-1 overflow-auto">
                  {isEmployeesLoading ? (
                    <div className="space-y-2 p-4">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : (
                    <EmployeeList
                      employees={employeesData?.data?.employees || []}
                      onEdit={handleEditEmployee}
                      onSelect={setSelectedEmployee}
                    />
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="validation" className="flex-1 overflow-auto p-4">
              <ValidationDashboard
                orgNodeId={selectedNode?.id}
                onSelectNode={handleSelectNode}
              />
            </TabsContent>

            <TabsContent value="coverage" className="flex-1 overflow-auto p-4">
              {selectedNode ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">{selectedNode.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Définissez les créneaux de couverture requis
                      </p>
                    </div>
                  </div>
                  <CoverageEditor
                    value={coveragePattern}
                    onChange={setCoveragePattern}
                  />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-4 text-lg font-medium">Sélectionnez une unité</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Choisissez une unité dans l'arbre pour gérer sa couverture
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Sheets */}
      <OrgNodeSheet
        isOpen={isNodeSheetOpen}
        onClose={() => {
          setIsNodeSheetOpen(false);
          setSelectedNode(null);
          setNodeSheetParentId(undefined);
        }}
        node={selectedNode}
        parentId={nodeSheetParentId}
      />

      <EmployeeSheet
        isOpen={isEmployeeSheetOpen}
        onClose={() => {
          setIsEmployeeSheetOpen(false);
          setSelectedEmployee(null);
        }}
        employee={selectedEmployee}
        defaultOrgNodeId={selectedNode?.id}
      />
    </div>
  );
}
