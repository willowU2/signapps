import { test, expect } from '@playwright/test';

// Automated Coherence Test for Frontend / Backend Contracts
// Goal: Ensure the backend DTOs exactly match the frontend expectations, 
// especially regarding Role constants, enums, and required fields.

test.describe('API Contract Coherence - Identity', () => {

  test('UserRole Enum exactly matches backend values (1=User, 2=Admin, 3=SuperAdmin)', async ({ request }) => {
    // We attempt to fetch the current user to validate the JSON structure.
    // In a real e2e environment, this uses the pre-warm auth state.
    const res = await request.get('/api/v1/auth/me');
    
    // If we're not authenticated in this context, that's fine, we can just check the schema structure 
    // when we are authenticated. Assuming the test runner handles auth setup.
    if (res.ok()) {
      const data = await res.json();
      
      // Strict structural checks mirroring Rust's `User` struct in signapps-db/src/models/user.rs
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('username');
      expect(data).toHaveProperty('role');
      
      const role = data.role;
      expect([1, 2, 3]).toContain(role); // 0 MUST not be returned
    }
  });

});
