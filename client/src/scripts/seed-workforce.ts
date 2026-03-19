/**
 * Workforce Seed Script
 *
 * Run with: npx tsx src/scripts/seed-workforce.ts
 */

const WORKFORCE_API = 'http://localhost:3019/api/v1/workforce';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

// Helper for API calls
async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }
  const res = await fetch(`${WORKFORCE_API}${endpoint}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error ${res.status}: ${text}`);
  }
  return res.json();
}

// ============================================
// FUNCTION DEFINITIONS (Roles)
// ============================================
const FUNCTIONS = [
  { code: 'MGR', name: 'Manager', description: 'Responsable d\'équipe', category: 'management' },
  { code: 'DEV', name: 'Développeur', description: 'Développeur logiciel', category: 'technique' },
  { code: 'DEVOPS', name: 'DevOps Engineer', description: 'Ingénieur DevOps/SRE', category: 'technique' },
  { code: 'QA', name: 'QA Engineer', description: 'Ingénieur qualité', category: 'technique' },
  { code: 'DESIGN', name: 'Designer', description: 'Designer UX/UI', category: 'creative' },
  { code: 'PM', name: 'Product Manager', description: 'Chef de produit', category: 'management' },
  { code: 'HR', name: 'RH', description: 'Ressources humaines', category: 'support' },
  { code: 'SALES', name: 'Commercial', description: 'Commercial/Ventes', category: 'business' },
  { code: 'SUPPORT', name: 'Support Client', description: 'Support technique client', category: 'support' },
  { code: 'ADMIN', name: 'Administratif', description: 'Assistant administratif', category: 'support' },
];

// ============================================
// ORG NODE TYPES
// ============================================
const NODE_TYPES = [
  { code: 'company', name: 'Entreprise', level: 0, color: '#06b6d4' },
  { code: 'division', name: 'Division', level: 1, color: '#8b5cf6' },
  { code: 'department', name: 'Département', level: 2, color: '#3b82f6' },
  { code: 'team', name: 'Équipe', level: 3, color: '#22c55e' },
  { code: 'unit', name: 'Unité', level: 4, color: '#f59e0b' },
];

// ============================================
// ORG STRUCTURE
// ============================================
interface OrgNodeSeed {
  node_type: string;
  name: string;
  code: string;
  description?: string;
  children?: OrgNodeSeed[];
}

const ORG_TREE: OrgNodeSeed = {
  node_type: 'company',
  name: 'SignApps Technologies',
  code: 'SIGNAPPS',
  description: 'Siège social - Plateforme SaaS nouvelle génération',
  children: [
    {
      node_type: 'division',
      name: 'Engineering',
      code: 'ENG',
      description: 'Division technique et développement',
      children: [
        {
          node_type: 'department',
          name: 'Plateforme',
          code: 'ENG-PLATFORM',
          description: 'Équipe plateforme et infrastructure',
          children: [
            { node_type: 'team', name: 'Backend', code: 'ENG-BACK', description: 'Services Rust/API' },
            { node_type: 'team', name: 'Frontend', code: 'ENG-FRONT', description: 'Next.js/React' },
            { node_type: 'team', name: 'DevOps', code: 'ENG-DEVOPS', description: 'CI/CD et Infrastructure' },
          ],
        },
        {
          node_type: 'department',
          name: 'Produit',
          code: 'ENG-PRODUCT',
          description: 'Gestion produit et design',
          children: [
            { node_type: 'team', name: 'Design', code: 'ENG-DESIGN', description: 'UX/UI Design' },
            { node_type: 'team', name: 'QA', code: 'ENG-QA', description: 'Qualité et tests' },
          ],
        },
      ],
    },
    {
      node_type: 'division',
      name: 'Operations',
      code: 'OPS',
      description: 'Division opérations et support',
      children: [
        {
          node_type: 'department',
          name: 'Support Client',
          code: 'OPS-SUPPORT',
          description: 'Support technique niveau 1-3',
          children: [
            { node_type: 'team', name: 'Support N1', code: 'OPS-N1', description: 'Premier niveau' },
            { node_type: 'team', name: 'Support N2', code: 'OPS-N2', description: 'Support avancé' },
          ],
        },
        {
          node_type: 'department',
          name: 'Administration',
          code: 'OPS-ADMIN',
          description: 'Services administratifs',
        },
      ],
    },
    {
      node_type: 'division',
      name: 'Business',
      code: 'BIZ',
      description: 'Division commerciale',
      children: [
        {
          node_type: 'department',
          name: 'Ventes',
          code: 'BIZ-SALES',
          description: 'Équipe commerciale',
          children: [
            { node_type: 'team', name: 'France', code: 'BIZ-FR', description: 'Marché français' },
            { node_type: 'team', name: 'International', code: 'BIZ-INT', description: 'Marchés internationaux' },
          ],
        },
        {
          node_type: 'department',
          name: 'RH',
          code: 'BIZ-HR',
          description: 'Ressources humaines',
        },
      ],
    },
  ],
};

// ============================================
// EMPLOYEES
// ============================================
interface EmployeeSeed {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  employee_number: string;
  org_code: string; // Will be resolved to org_node_id
  functions: string[]; // Function codes
  contract_type: 'full-time' | 'part-time' | 'contract' | 'intern' | 'temporary';
  fte_ratio: number;
  hire_date: string;
}

const EMPLOYEES: EmployeeSeed[] = [
  // Engineering - Backend
  { first_name: 'Thomas', last_name: 'Martin', email: 'thomas.martin@signapps.io', employee_number: 'EMP-001', org_code: 'ENG-BACK', functions: ['MGR', 'DEV'], contract_type: 'full-time', fte_ratio: 1, hire_date: '2022-01-15' },
  { first_name: 'Sophie', last_name: 'Bernard', email: 'sophie.bernard@signapps.io', employee_number: 'EMP-002', org_code: 'ENG-BACK', functions: ['DEV'], contract_type: 'full-time', fte_ratio: 1, hire_date: '2022-03-01' },
  { first_name: 'Lucas', last_name: 'Dubois', email: 'lucas.dubois@signapps.io', employee_number: 'EMP-003', org_code: 'ENG-BACK', functions: ['DEV'], contract_type: 'full-time', fte_ratio: 1, hire_date: '2023-02-14' },
  { first_name: 'Emma', last_name: 'Leroy', email: 'emma.leroy@signapps.io', employee_number: 'EMP-004', org_code: 'ENG-BACK', functions: ['DEV'], contract_type: 'contract', fte_ratio: 1, hire_date: '2024-01-08' },

  // Engineering - Frontend
  { first_name: 'Hugo', last_name: 'Moreau', email: 'hugo.moreau@signapps.io', employee_number: 'EMP-005', org_code: 'ENG-FRONT', functions: ['MGR', 'DEV'], contract_type: 'full-time', fte_ratio: 1, hire_date: '2022-02-01' },
  { first_name: 'Léa', last_name: 'Simon', email: 'lea.simon@signapps.io', employee_number: 'EMP-006', org_code: 'ENG-FRONT', functions: ['DEV'], contract_type: 'full-time', fte_ratio: 1, hire_date: '2022-06-15' },
  { first_name: 'Nathan', last_name: 'Laurent', email: 'nathan.laurent@signapps.io', employee_number: 'EMP-007', org_code: 'ENG-FRONT', functions: ['DEV'], contract_type: 'part-time', fte_ratio: 0.8, hire_date: '2023-09-01' },
  { first_name: 'Chloé', last_name: 'Michel', email: 'chloe.michel@signapps.io', employee_number: 'EMP-008', org_code: 'ENG-FRONT', functions: ['DEV'], contract_type: 'intern', fte_ratio: 1, hire_date: '2024-02-01' },

  // Engineering - DevOps
  { first_name: 'Maxime', last_name: 'Garcia', email: 'maxime.garcia@signapps.io', employee_number: 'EMP-009', org_code: 'ENG-DEVOPS', functions: ['DEVOPS'], contract_type: 'full-time', fte_ratio: 1, hire_date: '2022-04-01' },
  { first_name: 'Camille', last_name: 'Roux', email: 'camille.roux@signapps.io', employee_number: 'EMP-010', org_code: 'ENG-DEVOPS', functions: ['DEVOPS'], contract_type: 'full-time', fte_ratio: 1, hire_date: '2023-03-15' },

  // Engineering - Design
  { first_name: 'Julie', last_name: 'Fournier', email: 'julie.fournier@signapps.io', employee_number: 'EMP-011', org_code: 'ENG-DESIGN', functions: ['DESIGN'], contract_type: 'full-time', fte_ratio: 1, hire_date: '2022-05-01' },
  { first_name: 'Antoine', last_name: 'Girard', email: 'antoine.girard@signapps.io', employee_number: 'EMP-012', org_code: 'ENG-DESIGN', functions: ['DESIGN'], contract_type: 'full-time', fte_ratio: 1, hire_date: '2023-07-01' },

  // Engineering - QA
  { first_name: 'Marine', last_name: 'Bonnet', email: 'marine.bonnet@signapps.io', employee_number: 'EMP-013', org_code: 'ENG-QA', functions: ['QA'], contract_type: 'full-time', fte_ratio: 1, hire_date: '2022-08-01' },
  { first_name: 'Alexandre', last_name: 'Dupont', email: 'alexandre.dupont@signapps.io', employee_number: 'EMP-014', org_code: 'ENG-QA', functions: ['QA'], contract_type: 'part-time', fte_ratio: 0.6, hire_date: '2023-11-01' },

  // Product
  { first_name: 'Pauline', last_name: 'Robert', email: 'pauline.robert@signapps.io', employee_number: 'EMP-015', org_code: 'ENG-PRODUCT', functions: ['PM'], contract_type: 'full-time', fte_ratio: 1, hire_date: '2022-01-10' },

  // Support N1
  { first_name: 'Romain', last_name: 'Petit', email: 'romain.petit@signapps.io', employee_number: 'EMP-016', org_code: 'OPS-N1', functions: ['SUPPORT'], contract_type: 'full-time', fte_ratio: 1, hire_date: '2022-09-01' },
  { first_name: 'Clara', last_name: 'Durand', email: 'clara.durand@signapps.io', employee_number: 'EMP-017', org_code: 'OPS-N1', functions: ['SUPPORT'], contract_type: 'full-time', fte_ratio: 1, hire_date: '2023-01-15' },
  { first_name: 'Théo', last_name: 'Lemoine', email: 'theo.lemoine@signapps.io', employee_number: 'EMP-018', org_code: 'OPS-N1', functions: ['SUPPORT'], contract_type: 'temporary', fte_ratio: 1, hire_date: '2024-01-02' },

  // Support N2
  { first_name: 'Manon', last_name: 'Mercier', email: 'manon.mercier@signapps.io', employee_number: 'EMP-019', org_code: 'OPS-N2', functions: ['SUPPORT', 'DEV'], contract_type: 'full-time', fte_ratio: 1, hire_date: '2022-06-01' },

  // Admin
  { first_name: 'Isabelle', last_name: 'Faure', email: 'isabelle.faure@signapps.io', employee_number: 'EMP-020', org_code: 'OPS-ADMIN', functions: ['ADMIN'], contract_type: 'full-time', fte_ratio: 1, hire_date: '2022-01-05' },

  // Sales France
  { first_name: 'Pierre', last_name: 'Andre', email: 'pierre.andre@signapps.io', employee_number: 'EMP-021', org_code: 'BIZ-FR', functions: ['MGR', 'SALES'], contract_type: 'full-time', fte_ratio: 1, hire_date: '2022-02-15' },
  { first_name: 'Elise', last_name: 'Blanc', email: 'elise.blanc@signapps.io', employee_number: 'EMP-022', org_code: 'BIZ-FR', functions: ['SALES'], contract_type: 'full-time', fte_ratio: 1, hire_date: '2022-10-01' },
  { first_name: 'Julien', last_name: 'Gauthier', email: 'julien.gauthier@signapps.io', employee_number: 'EMP-023', org_code: 'BIZ-FR', functions: ['SALES'], contract_type: 'full-time', fte_ratio: 1, hire_date: '2023-04-01' },

  // Sales International
  { first_name: 'Sarah', last_name: 'Meyer', email: 'sarah.meyer@signapps.io', employee_number: 'EMP-024', org_code: 'BIZ-INT', functions: ['SALES'], contract_type: 'full-time', fte_ratio: 1, hire_date: '2023-06-01' },

  // HR
  { first_name: 'Caroline', last_name: 'Vincent', email: 'caroline.vincent@signapps.io', employee_number: 'EMP-025', org_code: 'BIZ-HR', functions: ['HR'], contract_type: 'full-time', fte_ratio: 1, hire_date: '2022-01-20' },
];

// ============================================
// COVERAGE TEMPLATES
// ============================================
interface CoverageSlotSeed {
  start_time: string;
  end_time: string;
  min_employees: number;
  required_functions?: string[];
}

interface CoverageTemplateSeed {
  name: string;
  description: string;
  org_code: string;
  slots: { [day: number]: CoverageSlotSeed[] };
}

const COVERAGE_TEMPLATES: CoverageTemplateSeed[] = [
  {
    name: 'Support 24/7',
    description: 'Couverture support client continue',
    org_code: 'OPS-SUPPORT',
    slots: {
      1: [ // Monday
        { start_time: '08:00', end_time: '16:00', min_employees: 2, required_functions: ['SUPPORT'] },
        { start_time: '16:00', end_time: '00:00', min_employees: 1, required_functions: ['SUPPORT'] },
      ],
      2: [ // Tuesday
        { start_time: '08:00', end_time: '16:00', min_employees: 2, required_functions: ['SUPPORT'] },
        { start_time: '16:00', end_time: '00:00', min_employees: 1, required_functions: ['SUPPORT'] },
      ],
      3: [ // Wednesday
        { start_time: '08:00', end_time: '16:00', min_employees: 2, required_functions: ['SUPPORT'] },
        { start_time: '16:00', end_time: '00:00', min_employees: 1, required_functions: ['SUPPORT'] },
      ],
      4: [ // Thursday
        { start_time: '08:00', end_time: '16:00', min_employees: 2, required_functions: ['SUPPORT'] },
        { start_time: '16:00', end_time: '00:00', min_employees: 1, required_functions: ['SUPPORT'] },
      ],
      5: [ // Friday
        { start_time: '08:00', end_time: '16:00', min_employees: 2, required_functions: ['SUPPORT'] },
        { start_time: '16:00', end_time: '00:00', min_employees: 1, required_functions: ['SUPPORT'] },
      ],
      6: [ // Saturday
        { start_time: '10:00', end_time: '18:00', min_employees: 1, required_functions: ['SUPPORT'] },
      ],
      0: [ // Sunday
        { start_time: '10:00', end_time: '18:00', min_employees: 1, required_functions: ['SUPPORT'] },
      ],
    },
  },
  {
    name: 'Dev Standard',
    description: 'Horaires développement standard',
    org_code: 'ENG-PLATFORM',
    slots: {
      1: [{ start_time: '09:00', end_time: '18:00', min_employees: 3, required_functions: ['DEV'] }],
      2: [{ start_time: '09:00', end_time: '18:00', min_employees: 3, required_functions: ['DEV'] }],
      3: [{ start_time: '09:00', end_time: '18:00', min_employees: 3, required_functions: ['DEV'] }],
      4: [{ start_time: '09:00', end_time: '18:00', min_employees: 3, required_functions: ['DEV'] }],
      5: [{ start_time: '09:00', end_time: '17:00', min_employees: 2, required_functions: ['DEV'] }],
    },
  },
];

// ============================================
// MAIN SEED FUNCTION
// ============================================
async function seed() {
  console.log('🌱 Starting workforce seed...\n');

  // 1. Create node types
  console.log('📁 Creating node types...');
  for (const nodeType of NODE_TYPES) {
    try {
      await api('/org/types', {
        method: 'POST',
        body: JSON.stringify(nodeType),
      });
      console.log(`  ✓ ${nodeType.name}`);
    } catch (e: any) {
      if (e.message.includes('409') || e.message.includes('already exists')) {
        console.log(`  ~ ${nodeType.name} (exists)`);
      } else {
        console.log(`  ✗ ${nodeType.name}: ${e.message}`);
      }
    }
  }

  // 2. Create function definitions
  console.log('\n👔 Creating function definitions...');
  for (const fn of FUNCTIONS) {
    try {
      await api('/functions', {
        method: 'POST',
        body: JSON.stringify(fn),
      });
      console.log(`  ✓ ${fn.name}`);
    } catch (e: any) {
      if (e.message.includes('409') || e.message.includes('already exists')) {
        console.log(`  ~ ${fn.name} (exists)`);
      } else {
        console.log(`  ✗ ${fn.name}: ${e.message}`);
      }
    }
  }

  // 3. Create org tree
  console.log('\n🏢 Creating org structure...');
  const nodeIdByCode: Record<string, string> = {};

  async function createNode(node: OrgNodeSeed, parentId?: string) {
    try {
      const result = await api<{ id: string }>('/org', {
        method: 'POST',
        body: JSON.stringify({
          parent_id: parentId,
          node_type: node.node_type,
          name: node.name,
          code: node.code,
          description: node.description,
        }),
      });
      nodeIdByCode[node.code] = result.id;
      console.log(`  ✓ ${node.name} (${node.code})`);

      // Create children
      if (node.children) {
        for (const child of node.children) {
          await createNode(child, result.id);
        }
      }
    } catch (e: any) {
      if (e.message.includes('409') || e.message.includes('already exists')) {
        // Try to get existing node
        try {
          const existing = await api<{ data: { id: string; code: string }[] }>('/org?code=' + node.code);
          if (existing.data?.[0]) {
            nodeIdByCode[node.code] = existing.data[0].id;
            console.log(`  ~ ${node.name} (exists)`);
            // Still create children
            if (node.children) {
              for (const child of node.children) {
                await createNode(child, existing.data[0].id);
              }
            }
          }
        } catch {
          console.log(`  ✗ ${node.name}: ${e.message}`);
        }
      } else {
        console.log(`  ✗ ${node.name}: ${e.message}`);
      }
    }
  }

  await createNode(ORG_TREE);

  // Fetch all nodes to get IDs
  console.log('\n📍 Fetching org node IDs...');
  try {
    const tree = await api<{ data: any[] }>('/org/tree?max_depth=10');
    function collectIds(nodes: any[]) {
      for (const node of nodes) {
        if (node.code) nodeIdByCode[node.code] = node.id;
        if (node.children) collectIds(node.children);
      }
    }
    collectIds(tree.data || []);
    console.log(`  Found ${Object.keys(nodeIdByCode).length} nodes`);
  } catch (e: any) {
    console.log(`  ✗ Failed to fetch tree: ${e.message}`);
  }

  // 4. Create employees
  console.log('\n👥 Creating employees...');
  for (const emp of EMPLOYEES) {
    const orgNodeId = nodeIdByCode[emp.org_code];
    if (!orgNodeId) {
      console.log(`  ✗ ${emp.first_name} ${emp.last_name}: org node ${emp.org_code} not found`);
      continue;
    }

    try {
      await api('/employees', {
        method: 'POST',
        body: JSON.stringify({
          first_name: emp.first_name,
          last_name: emp.last_name,
          email: emp.email,
          phone: emp.phone,
          employee_number: emp.employee_number,
          org_node_id: orgNodeId,
          functions: emp.functions,
          contract_type: emp.contract_type,
          fte_ratio: emp.fte_ratio,
          hire_date: emp.hire_date,
        }),
      });
      console.log(`  ✓ ${emp.first_name} ${emp.last_name} → ${emp.org_code}`);
    } catch (e: any) {
      if (e.message.includes('409') || e.message.includes('already exists')) {
        console.log(`  ~ ${emp.first_name} ${emp.last_name} (exists)`);
      } else {
        console.log(`  ✗ ${emp.first_name} ${emp.last_name}: ${e.message}`);
      }
    }
  }

  // 5. Create coverage templates
  console.log('\n📅 Creating coverage templates...');
  for (const template of COVERAGE_TEMPLATES) {
    const orgNodeId = nodeIdByCode[template.org_code];
    if (!orgNodeId) {
      console.log(`  ✗ ${template.name}: org node ${template.org_code} not found`);
      continue;
    }

    try {
      await api('/coverage/templates', {
        method: 'POST',
        body: JSON.stringify({
          org_node_id: orgNodeId,
          name: template.name,
          description: template.description,
          pattern: template.slots,
        }),
      });
      console.log(`  ✓ ${template.name}`);
    } catch (e: any) {
      if (e.message.includes('409') || e.message.includes('already exists')) {
        console.log(`  ~ ${template.name} (exists)`);
      } else {
        console.log(`  ✗ ${template.name}: ${e.message}`);
      }
    }
  }

  console.log('\n✅ Seed complete!\n');
  console.log('Summary:');
  console.log(`  - ${NODE_TYPES.length} node types`);
  console.log(`  - ${FUNCTIONS.length} function definitions`);
  console.log(`  - ${Object.keys(nodeIdByCode).length} org nodes`);
  console.log(`  - ${EMPLOYEES.length} employees`);
  console.log(`  - ${COVERAGE_TEMPLATES.length} coverage templates`);
}

// Run
seed().catch(console.error);
