/**
 * Direct Database Seed for Workforce
 *
 * Seeds workforce data directly into PostgreSQL, bypassing the API.
 */

import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://signapps:signapps_dev@127.0.0.1:5432/signapps';
const TENANT_ID = '1c1c220e-690e-40c0-965e-a8b7d83e01a4';

interface OrgNode {
  code: string;
  name: string;
  nodeType: string;
  parentCode?: string;
  id?: string;
}

interface Employee {
  firstName: string;
  lastName: string;
  email: string;
  nodeCode: string;
  functions: string[];
  contractType: string;
  fteRatio: number;
}

// Org node types
const NODE_TYPES = [
  { code: 'enterprise', name: 'Entreprise', level: 1 },
  { code: 'division', name: 'Division', level: 2 },
  { code: 'department', name: 'Département', level: 3 },
  { code: 'team', name: 'Équipe', level: 4 },
  { code: 'unit', name: 'Unité', level: 5 },
];

// Function definitions
const FUNCTIONS = [
  { code: 'MANAGER', name: 'Manager', category: 'leadership', requiresCertification: false },
  { code: 'DEV', name: 'Développeur', category: 'engineering', requiresCertification: false },
  { code: 'DEVOPS', name: 'DevOps Engineer', category: 'engineering', requiresCertification: false },
  { code: 'QA', name: 'QA Engineer', category: 'engineering', requiresCertification: false },
  { code: 'DESIGN', name: 'Designer', category: 'design', requiresCertification: false },
  { code: 'PM', name: 'Product Manager', category: 'product', requiresCertification: false },
  { code: 'HR', name: 'RH', category: 'hr', requiresCertification: false },
  { code: 'SALES', name: 'Commercial', category: 'sales', requiresCertification: false },
  { code: 'SUPPORT', name: 'Support Client', category: 'support', requiresCertification: false },
  { code: 'ADMIN', name: 'Administratif', category: 'admin', requiresCertification: false },
];

// Org structure
const ORG_STRUCTURE: OrgNode[] = [
  // Root
  { code: 'SA-TECH', name: 'SignApps Technologies', nodeType: 'enterprise' },

  // Divisions
  { code: 'ENG', name: 'Engineering', nodeType: 'division', parentCode: 'SA-TECH' },
  { code: 'OPS', name: 'Opérations', nodeType: 'division', parentCode: 'SA-TECH' },
  { code: 'BIZ', name: 'Business', nodeType: 'division', parentCode: 'SA-TECH' },

  // Engineering departments
  { code: 'ENG-PLATFORM', name: 'Platform Engineering', nodeType: 'department', parentCode: 'ENG' },
  { code: 'ENG-PRODUCT', name: 'Product Engineering', nodeType: 'department', parentCode: 'ENG' },

  // Platform teams
  { code: 'ENG-BACK', name: 'Backend', nodeType: 'team', parentCode: 'ENG-PLATFORM' },
  { code: 'ENG-FRONT', name: 'Frontend', nodeType: 'team', parentCode: 'ENG-PLATFORM' },
  { code: 'ENG-DEVOPS', name: 'DevOps', nodeType: 'team', parentCode: 'ENG-PLATFORM' },

  // Product teams
  { code: 'ENG-DESIGN', name: 'Design', nodeType: 'team', parentCode: 'ENG-PRODUCT' },
  { code: 'ENG-QA', name: 'QA', nodeType: 'team', parentCode: 'ENG-PRODUCT' },

  // Operations departments
  { code: 'OPS-SUPPORT', name: 'Support Client', nodeType: 'department', parentCode: 'OPS' },
  { code: 'OPS-ADMIN', name: 'Administration', nodeType: 'department', parentCode: 'OPS' },

  // Support teams
  { code: 'OPS-N1', name: 'Support N1', nodeType: 'team', parentCode: 'OPS-SUPPORT' },
  { code: 'OPS-N2', name: 'Support N2', nodeType: 'team', parentCode: 'OPS-SUPPORT' },

  // Business departments
  { code: 'BIZ-SALES', name: 'Ventes', nodeType: 'department', parentCode: 'BIZ' },
  { code: 'BIZ-HR', name: 'Ressources Humaines', nodeType: 'department', parentCode: 'BIZ' },

  // Sales teams
  { code: 'BIZ-FR', name: 'France', nodeType: 'team', parentCode: 'BIZ-SALES' },
  { code: 'BIZ-INT', name: 'International', nodeType: 'team', parentCode: 'BIZ-SALES' },
];

// Employees
const EMPLOYEES: Employee[] = [
  // Backend team
  { firstName: 'Thomas', lastName: 'Martin', email: 'thomas.martin@signapps.io', nodeCode: 'ENG-BACK', functions: ['DEV', 'MANAGER'], contractType: 'full-time', fteRatio: 1.0 },
  { firstName: 'Sophie', lastName: 'Bernard', email: 'sophie.bernard@signapps.io', nodeCode: 'ENG-BACK', functions: ['DEV'], contractType: 'full-time', fteRatio: 1.0 },
  { firstName: 'Lucas', lastName: 'Dubois', email: 'lucas.dubois@signapps.io', nodeCode: 'ENG-BACK', functions: ['DEV'], contractType: 'full-time', fteRatio: 1.0 },
  { firstName: 'Emma', lastName: 'Leroy', email: 'emma.leroy@signapps.io', nodeCode: 'ENG-BACK', functions: ['DEV'], contractType: 'part-time', fteRatio: 0.8 },

  // Frontend team
  { firstName: 'Hugo', lastName: 'Moreau', email: 'hugo.moreau@signapps.io', nodeCode: 'ENG-FRONT', functions: ['DEV', 'MANAGER'], contractType: 'full-time', fteRatio: 1.0 },
  { firstName: 'Léa', lastName: 'Simon', email: 'lea.simon@signapps.io', nodeCode: 'ENG-FRONT', functions: ['DEV'], contractType: 'full-time', fteRatio: 1.0 },
  { firstName: 'Nathan', lastName: 'Laurent', email: 'nathan.laurent@signapps.io', nodeCode: 'ENG-FRONT', functions: ['DEV'], contractType: 'full-time', fteRatio: 1.0 },
  { firstName: 'Chloé', lastName: 'Michel', email: 'chloe.michel@signapps.io', nodeCode: 'ENG-FRONT', functions: ['DEV'], contractType: 'intern', fteRatio: 1.0 },

  // DevOps team
  { firstName: 'Maxime', lastName: 'Garcia', email: 'maxime.garcia@signapps.io', nodeCode: 'ENG-DEVOPS', functions: ['DEVOPS', 'MANAGER'], contractType: 'full-time', fteRatio: 1.0 },
  { firstName: 'Camille', lastName: 'Roux', email: 'camille.roux@signapps.io', nodeCode: 'ENG-DEVOPS', functions: ['DEVOPS'], contractType: 'full-time', fteRatio: 1.0 },

  // Design team
  { firstName: 'Julie', lastName: 'Fournier', email: 'julie.fournier@signapps.io', nodeCode: 'ENG-DESIGN', functions: ['DESIGN', 'MANAGER'], contractType: 'full-time', fteRatio: 1.0 },
  { firstName: 'Antoine', lastName: 'Girard', email: 'antoine.girard@signapps.io', nodeCode: 'ENG-DESIGN', functions: ['DESIGN'], contractType: 'full-time', fteRatio: 1.0 },

  // QA team
  { firstName: 'Marine', lastName: 'Bonnet', email: 'marine.bonnet@signapps.io', nodeCode: 'ENG-QA', functions: ['QA', 'MANAGER'], contractType: 'full-time', fteRatio: 1.0 },
  { firstName: 'Alexandre', lastName: 'Dupont', email: 'alexandre.dupont@signapps.io', nodeCode: 'ENG-QA', functions: ['QA'], contractType: 'full-time', fteRatio: 1.0 },

  // Product
  { firstName: 'Pauline', lastName: 'Robert', email: 'pauline.robert@signapps.io', nodeCode: 'ENG-PRODUCT', functions: ['PM', 'MANAGER'], contractType: 'full-time', fteRatio: 1.0 },

  // Support N1
  { firstName: 'Romain', lastName: 'Petit', email: 'romain.petit@signapps.io', nodeCode: 'OPS-N1', functions: ['SUPPORT'], contractType: 'full-time', fteRatio: 1.0 },
  { firstName: 'Clara', lastName: 'Durand', email: 'clara.durand@signapps.io', nodeCode: 'OPS-N1', functions: ['SUPPORT'], contractType: 'full-time', fteRatio: 1.0 },
  { firstName: 'Théo', lastName: 'Lemoine', email: 'theo.lemoine@signapps.io', nodeCode: 'OPS-N1', functions: ['SUPPORT'], contractType: 'part-time', fteRatio: 0.5 },

  // Support N2
  { firstName: 'Manon', lastName: 'Mercier', email: 'manon.mercier@signapps.io', nodeCode: 'OPS-N2', functions: ['SUPPORT', 'MANAGER'], contractType: 'full-time', fteRatio: 1.0 },

  // Admin
  { firstName: 'Isabelle', lastName: 'Faure', email: 'isabelle.faure@signapps.io', nodeCode: 'OPS-ADMIN', functions: ['ADMIN', 'MANAGER'], contractType: 'full-time', fteRatio: 1.0 },

  // Sales France
  { firstName: 'Pierre', lastName: 'Andre', email: 'pierre.andre@signapps.io', nodeCode: 'BIZ-FR', functions: ['SALES', 'MANAGER'], contractType: 'full-time', fteRatio: 1.0 },
  { firstName: 'Elise', lastName: 'Blanc', email: 'elise.blanc@signapps.io', nodeCode: 'BIZ-FR', functions: ['SALES'], contractType: 'full-time', fteRatio: 1.0 },
  { firstName: 'Julien', lastName: 'Gauthier', email: 'julien.gauthier@signapps.io', nodeCode: 'BIZ-FR', functions: ['SALES'], contractType: 'contract', fteRatio: 1.0 },

  // Sales International
  { firstName: 'Sarah', lastName: 'Meyer', email: 'sarah.meyer@signapps.io', nodeCode: 'BIZ-INT', functions: ['SALES', 'MANAGER'], contractType: 'full-time', fteRatio: 1.0 },

  // HR
  { firstName: 'Caroline', lastName: 'Vincent', email: 'caroline.vincent@signapps.io', nodeCode: 'BIZ-HR', functions: ['HR', 'MANAGER'], contractType: 'full-time', fteRatio: 1.0 },
];

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('🔌 Connected to database\n');

    // 1. Create org node types (use existing or add new)
    console.log('📁 Creating node types...');
    for (const nodeType of NODE_TYPES) {
      try {
        await client.query(
          `INSERT INTO workforce_org_node_types (tenant_id, code, name, sort_order)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (tenant_id, code) DO NOTHING`,
          [TENANT_ID, nodeType.code, nodeType.name, nodeType.level]
        );
        console.log(`  ✓ ${nodeType.name}`);
      } catch (err: any) {
        console.log(`  ✗ ${nodeType.name}: ${err.message}`);
      }
    }

    // 2. Create function definitions
    console.log('\n👔 Creating function definitions...');
    for (const func of FUNCTIONS) {
      try {
        await client.query(
          `INSERT INTO workforce_function_definitions (tenant_id, code, name)
           VALUES ($1, $2, $3)
           ON CONFLICT (tenant_id, code) DO NOTHING`,
          [TENANT_ID, func.code, func.name]
        );
        console.log(`  ✓ ${func.name}`);
      } catch (err: any) {
        console.log(`  ✗ ${func.name}: ${err.message}`);
      }
    }

    // 3. Create org structure
    console.log('\n🏢 Creating org structure...');
    const nodeIdMap: Record<string, string> = {};

    for (const node of ORG_STRUCTURE) {
      try {
        const parentId = node.parentCode ? nodeIdMap[node.parentCode] : null;

        // First try to find existing node
        const existing = await client.query(
          `SELECT id FROM workforce_org_nodes WHERE tenant_id = $1 AND code = $2`,
          [TENANT_ID, node.code]
        );

        if (existing.rows.length > 0) {
          nodeIdMap[node.code] = existing.rows[0].id;
          console.log(`  ✓ ${node.name} (existing)`);
        } else {
          const result = await client.query(
            `INSERT INTO workforce_org_nodes (tenant_id, parent_id, node_type, code, name, is_active)
             VALUES ($1, $2, $3, $4, $5, true)
             RETURNING id`,
            [TENANT_ID, parentId, node.nodeType, node.code, node.name]
          );
          nodeIdMap[node.code] = result.rows[0].id;
          console.log(`  ✓ ${node.name}`);
        }
      } catch (err: any) {
        console.log(`  ✗ ${node.name}: ${err.message}`);
      }
    }

    // 4. Create employees
    console.log('\n👥 Creating employees...');
    let employeeCount = 0;
    for (const emp of EMPLOYEES) {
      try {
        const nodeId = nodeIdMap[emp.nodeCode];
        if (!nodeId) {
          console.log(`  ✗ ${emp.firstName} ${emp.lastName}: org node ${emp.nodeCode} not found`);
          continue;
        }

        await client.query(
          `INSERT INTO workforce_employees (tenant_id, org_node_id, first_name, last_name, email, functions, contract_type, fte_ratio, status, hire_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', CURRENT_DATE)
           ON CONFLICT DO NOTHING`,
          [TENANT_ID, nodeId, emp.firstName, emp.lastName, emp.email, JSON.stringify(emp.functions), emp.contractType, emp.fteRatio]
        );
        console.log(`  ✓ ${emp.firstName} ${emp.lastName}`);
        employeeCount++;
      } catch (err: any) {
        console.log(`  ✗ ${emp.firstName} ${emp.lastName}: ${err.message}`);
      }
    }

    console.log('\n✅ Seed complete!');
    console.log(`\nSummary:`);
    console.log(`  - ${NODE_TYPES.length} node types`);
    console.log(`  - ${FUNCTIONS.length} function definitions`);
    console.log(`  - ${Object.keys(nodeIdMap).length} org nodes`);
    console.log(`  - ${employeeCount} employees`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
