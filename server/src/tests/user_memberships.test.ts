
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, membershipLevelsTable, userMembershipsTable } from '../db/schema';
import { type CreateUserMembershipInput } from '../schema';
import { getUserMemberships, createUserMembership, getActiveMembership, expireMembership } from '../handlers/user_memberships';
import { eq } from 'drizzle-orm';

describe('User Memberships', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testMembershipLevelId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Test',
        last_name: 'User',
        is_active: true,
        is_admin: false
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create test membership level
    const membershipResult = await db.insert(membershipLevelsTable)
      .values({
        name: 'Premium',
        description: 'Premium membership',
        price: '29.99',
        duration_days: 30,
        features: ['feature1', 'feature2'],
        is_active: true
      })
      .returning()
      .execute();
    testMembershipLevelId = membershipResult[0].id;
  });

  describe('getUserMemberships', () => {
    it('should return empty array for user with no memberships', async () => {
      const result = await getUserMemberships(testUserId);
      expect(result).toEqual([]);
    });

    it('should return all memberships for a user', async () => {
      // Create test membership
      await db.insert(userMembershipsTable)
        .values({
          user_id: testUserId,
          membership_level_id: testMembershipLevelId,
          start_date: new Date(),
          end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          is_active: true
        })
        .execute();

      const result = await getUserMemberships(testUserId);

      expect(result).toHaveLength(1);
      expect(result[0].user_id).toEqual(testUserId);
      expect(result[0].membership_level_id).toEqual(testMembershipLevelId);
      expect(result[0].is_active).toBe(true);
      expect(result[0].start_date).toBeInstanceOf(Date);
      expect(result[0].end_date).toBeInstanceOf(Date);
      expect(result[0].created_at).toBeInstanceOf(Date);
    });

    it('should return multiple memberships for a user', async () => {
      // Create second membership level
      const secondMembershipResult = await db.insert(membershipLevelsTable)
        .values({
          name: 'Basic',
          price: '9.99',
          duration_days: 30,
          features: ['basic'],
          is_active: true
        })
        .returning()
        .execute();

      // Create two memberships
      await db.insert(userMembershipsTable)
        .values([
          {
            user_id: testUserId,
            membership_level_id: testMembershipLevelId,
            start_date: new Date(),
            end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            is_active: false
          },
          {
            user_id: testUserId,
            membership_level_id: secondMembershipResult[0].id,
            start_date: new Date(),
            end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            is_active: true
          }
        ])
        .execute();

      const result = await getUserMemberships(testUserId);

      expect(result).toHaveLength(2);
      expect(result.map(m => m.membership_level_id)).toContain(testMembershipLevelId);
      expect(result.map(m => m.membership_level_id)).toContain(secondMembershipResult[0].id);
    });
  });

  describe('createUserMembership', () => {
    it('should create a membership with default dates', async () => {
      const input: CreateUserMembershipInput = {
        user_id: testUserId,
        membership_level_id: testMembershipLevelId
      };

      const result = await createUserMembership(input);

      expect(result.id).toBeDefined();
      expect(result.user_id).toEqual(testUserId);
      expect(result.membership_level_id).toEqual(testMembershipLevelId);
      expect(result.is_active).toBe(true);
      expect(result.start_date).toBeInstanceOf(Date);
      expect(result.end_date).toBeInstanceOf(Date);
      expect(result.created_at).toBeInstanceOf(Date);

      // End date should be 30 days after start date (based on membership level duration)
      const expectedEndDate = new Date(result.start_date.getTime() + 30 * 24 * 60 * 60 * 1000);
      expect(Math.abs(result.end_date.getTime() - expectedEndDate.getTime())).toBeLessThan(1000);
    });

    it('should create a membership with custom dates', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-02-01');
      
      const input: CreateUserMembershipInput = {
        user_id: testUserId,
        membership_level_id: testMembershipLevelId,
        start_date: startDate,
        end_date: endDate
      };

      const result = await createUserMembership(input);

      expect(result.start_date).toEqual(startDate);
      expect(result.end_date).toEqual(endDate);
    });

    it('should save membership to database', async () => {
      const input: CreateUserMembershipInput = {
        user_id: testUserId,
        membership_level_id: testMembershipLevelId
      };

      const result = await createUserMembership(input);

      const memberships = await db.select()
        .from(userMembershipsTable)
        .where(eq(userMembershipsTable.id, result.id))
        .execute();

      expect(memberships).toHaveLength(1);
      expect(memberships[0].user_id).toEqual(testUserId);
      expect(memberships[0].membership_level_id).toEqual(testMembershipLevelId);
      expect(memberships[0].is_active).toBe(true);
    });

    it('should throw error for non-existent user', async () => {
      const input: CreateUserMembershipInput = {
        user_id: 99999,
        membership_level_id: testMembershipLevelId
      };

      expect(createUserMembership(input)).rejects.toThrow(/user not found/i);
    });

    it('should throw error for non-existent membership level', async () => {
      const input: CreateUserMembershipInput = {
        user_id: testUserId,
        membership_level_id: 99999
      };

      expect(createUserMembership(input)).rejects.toThrow(/membership level not found/i);
    });
  });

  describe('getActiveMembership', () => {
    it('should return null for user with no active membership', async () => {
      const result = await getActiveMembership(testUserId);
      expect(result).toBeNull();
    });

    it('should return active membership within date range', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const endDate = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000); // 20 days from now

      await db.insert(userMembershipsTable)
        .values({
          user_id: testUserId,
          membership_level_id: testMembershipLevelId,
          start_date: startDate,
          end_date: endDate,
          is_active: true
        })
        .execute();

      const result = await getActiveMembership(testUserId);

      expect(result).not.toBeNull();
      expect(result!.user_id).toEqual(testUserId);
      expect(result!.membership_level_id).toEqual(testMembershipLevelId);
      expect(result!.is_active).toBe(true);
      expect(result!.start_date).toEqual(startDate);
      expect(result!.end_date).toEqual(endDate);
    });

    it('should return null for inactive membership', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const endDate = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);

      await db.insert(userMembershipsTable)
        .values({
          user_id: testUserId,
          membership_level_id: testMembershipLevelId,
          start_date: startDate,
          end_date: endDate,
          is_active: false
        })
        .execute();

      const result = await getActiveMembership(testUserId);
      expect(result).toBeNull();
    });

    it('should return null for expired membership', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000); // 40 days ago
      const endDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      await db.insert(userMembershipsTable)
        .values({
          user_id: testUserId,
          membership_level_id: testMembershipLevelId,
          start_date: startDate,
          end_date: endDate,
          is_active: true
        })
        .execute();

      const result = await getActiveMembership(testUserId);
      expect(result).toBeNull();
    });

    it('should return null for future membership', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
      const endDate = new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000); // 40 days from now

      await db.insert(userMembershipsTable)
        .values({
          user_id: testUserId,
          membership_level_id: testMembershipLevelId,
          start_date: startDate,
          end_date: endDate,
          is_active: true
        })
        .execute();

      const result = await getActiveMembership(testUserId);
      expect(result).toBeNull();
    });
  });

  describe('expireMembership', () => {
    it('should expire an active membership', async () => {
      const membershipResult = await db.insert(userMembershipsTable)
        .values({
          user_id: testUserId,
          membership_level_id: testMembershipLevelId,
          start_date: new Date(),
          end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          is_active: true
        })
        .returning()
        .execute();

      const membershipId = membershipResult[0].id;

      await expireMembership(membershipId);

      const updatedMembership = await db.select()
        .from(userMembershipsTable)
        .where(eq(userMembershipsTable.id, membershipId))
        .execute();

      expect(updatedMembership[0].is_active).toBe(false);
      expect(updatedMembership[0].end_date.getTime()).toBeLessThanOrEqual(new Date().getTime());
    });

    it('should throw error for non-existent membership', async () => {
      expect(expireMembership(99999)).rejects.toThrow(/membership not found/i);
    });

    it('should handle already expired membership', async () => {
      const membershipResult = await db.insert(userMembershipsTable)
        .values({
          user_id: testUserId,
          membership_level_id: testMembershipLevelId,
          start_date: new Date(),
          end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          is_active: false
        })
        .returning()
        .execute();

      const membershipId = membershipResult[0].id;

      // Should not throw error
      await expireMembership(membershipId);

      const updatedMembership = await db.select()
        .from(userMembershipsTable)
        .where(eq(userMembershipsTable.id, membershipId))
        .execute();

      expect(updatedMembership[0].is_active).toBe(false);
    });
  });
});
