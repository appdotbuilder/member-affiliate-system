
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { affiliatesTable, usersTable } from '../db/schema';
import { type CreateAffiliateInput, type CreateUserInput } from '../schema';
import { 
  createAffiliate, 
  getAffiliateByUserId, 
  getAffiliateByCode, 
  getAffiliates, 
  updateAffiliateStats, 
  deactivateAffiliate 
} from '../handlers/affiliates';
import { eq } from 'drizzle-orm';

// Test data
const testUserInput: CreateUserInput = {
  email: 'affiliate@test.com',
  password: 'testpassword123',
  first_name: 'Test',
  last_name: 'Affiliate',
  phone: '+1234567890'
};

const testAffiliateInput: CreateAffiliateInput = {
  user_id: 1,
  commission_rate: 0.1,
  is_active: true
};

describe('Affiliate handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create a test user
  const createTestUser = async () => {
    const result = await db.insert(usersTable)
      .values({
        email: testUserInput.email,
        password_hash: 'hashed_password_123',
        first_name: testUserInput.first_name,
        last_name: testUserInput.last_name,
        phone: testUserInput.phone,
        is_active: true,
        is_admin: false
      })
      .returning()
      .execute();
    
    return result[0];
  };

  describe('createAffiliate', () => {
    it('should create an affiliate', async () => {
      // Create prerequisite user
      const user = await createTestUser();
      const input = { ...testAffiliateInput, user_id: user.id };

      const result = await createAffiliate(input);

      expect(result.user_id).toEqual(user.id);
      expect(result.commission_rate).toEqual(0.1);
      expect(typeof result.commission_rate).toBe('number');
      expect(result.total_earnings).toEqual(0);
      expect(typeof result.total_earnings).toBe('number');
      expect(result.total_referrals).toEqual(0);
      expect(result.is_active).toBe(true);
      expect(result.affiliate_code).toMatch(/^AFF\d+\d+$/);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save affiliate to database', async () => {
      const user = await createTestUser();
      const input = { ...testAffiliateInput, user_id: user.id };

      const result = await createAffiliate(input);

      const affiliates = await db.select()
        .from(affiliatesTable)
        .where(eq(affiliatesTable.id, result.id))
        .execute();

      expect(affiliates).toHaveLength(1);
      expect(affiliates[0].user_id).toEqual(user.id);
      expect(parseFloat(affiliates[0].commission_rate)).toEqual(0.1);
      expect(parseFloat(affiliates[0].total_earnings)).toEqual(0);
      expect(affiliates[0].total_referrals).toEqual(0);
      expect(affiliates[0].is_active).toBe(true);
    });

    it('should generate unique affiliate codes', async () => {
      const user1 = await createTestUser();
      const user2Input = {
        email: 'affiliate2@test.com',
        password: 'testpassword123',
        first_name: 'Test2',
        last_name: 'Affiliate2'
      };
      const user2Result = await db.insert(usersTable)
        .values({
          email: user2Input.email,
          password_hash: 'hashed_password_456',
          first_name: user2Input.first_name,
          last_name: user2Input.last_name,
          is_active: true,
          is_admin: false
        })
        .returning()
        .execute();
      const user2 = user2Result[0];

      const affiliate1 = await createAffiliate({ ...testAffiliateInput, user_id: user1.id });
      const affiliate2 = await createAffiliate({ ...testAffiliateInput, user_id: user2.id });

      expect(affiliate1.affiliate_code).not.toEqual(affiliate2.affiliate_code);
      expect(affiliate1.affiliate_code).toMatch(/^AFF\d+\d+$/);
      expect(affiliate2.affiliate_code).toMatch(/^AFF\d+\d+$/);
    });
  });

  describe('getAffiliateByUserId', () => {
    it('should return affiliate by user ID', async () => {
      const user = await createTestUser();
      const input = { ...testAffiliateInput, user_id: user.id };
      const created = await createAffiliate(input);

      const result = await getAffiliateByUserId(user.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(created.id);
      expect(result!.user_id).toEqual(user.id);
      expect(result!.commission_rate).toEqual(0.1);
      expect(typeof result!.commission_rate).toBe('number');
      expect(result!.total_earnings).toEqual(0);
      expect(typeof result!.total_earnings).toBe('number');
    });

    it('should return null for non-existent user', async () => {
      const result = await getAffiliateByUserId(999);
      expect(result).toBeNull();
    });
  });

  describe('getAffiliateByCode', () => {
    it('should return affiliate by code', async () => {
      const user = await createTestUser();
      const input = { ...testAffiliateInput, user_id: user.id };
      const created = await createAffiliate(input);

      const result = await getAffiliateByCode(created.affiliate_code);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(created.id);
      expect(result!.affiliate_code).toEqual(created.affiliate_code);
      expect(result!.commission_rate).toEqual(0.1);
      expect(typeof result!.commission_rate).toBe('number');
    });

    it('should return null for non-existent code', async () => {
      const result = await getAffiliateByCode('INVALID_CODE');
      expect(result).toBeNull();
    });
  });

  describe('getAffiliates', () => {
    it('should return all affiliates', async () => {
      const user1 = await createTestUser();
      const user2Input = {
        email: 'affiliate2@test.com',
        password: 'testpassword123',
        first_name: 'Test2',
        last_name: 'Affiliate2'
      };
      const user2Result = await db.insert(usersTable)
        .values({
          email: user2Input.email,
          password_hash: 'hashed_password_789',
          first_name: user2Input.first_name,
          last_name: user2Input.last_name,
          is_active: true,
          is_admin: false
        })
        .returning()
        .execute();
      const user2 = user2Result[0];

      await createAffiliate({ ...testAffiliateInput, user_id: user1.id });
      await createAffiliate({ ...testAffiliateInput, user_id: user2.id, commission_rate: 0.15 });

      const result = await getAffiliates();

      expect(result).toHaveLength(2);
      expect(result[0].commission_rate).toEqual(0.1);
      expect(typeof result[0].commission_rate).toBe('number');
      expect(result[1].commission_rate).toEqual(0.15);
      expect(typeof result[1].commission_rate).toBe('number');
    });

    it('should return empty array when no affiliates exist', async () => {
      const result = await getAffiliates();
      expect(result).toHaveLength(0);
    });
  });

  describe('updateAffiliateStats', () => {
    it('should update affiliate earnings and referrals', async () => {
      const user = await createTestUser();
      const input = { ...testAffiliateInput, user_id: user.id };
      const created = await createAffiliate(input);

      await updateAffiliateStats(created.id, 150.75, 3);

      const updated = await getAffiliateByUserId(user.id);
      expect(updated!.total_earnings).toEqual(150.75);
      expect(typeof updated!.total_earnings).toBe('number');
      expect(updated!.total_referrals).toEqual(3);
      expect(updated!.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('deactivateAffiliate', () => {
    it('should deactivate affiliate', async () => {
      const user = await createTestUser();
      const input = { ...testAffiliateInput, user_id: user.id };
      const created = await createAffiliate(input);

      await deactivateAffiliate(created.id);

      const updated = await getAffiliateByUserId(user.id);
      expect(updated!.is_active).toBe(false);
      expect(updated!.updated_at).toBeInstanceOf(Date);
    });
  });
});
