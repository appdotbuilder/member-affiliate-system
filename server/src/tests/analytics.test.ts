
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, affiliatesTable, subscriptionsTable, affiliateReferralsTable, affiliatePayoutsTable, membershipLevelsTable } from '../db/schema';
import { getDashboardStats, getAffiliateStats, getRevenueByMonth, getTopAffiliates } from '../handlers/analytics';

describe('Analytics Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getDashboardStats', () => {
    it('should return basic dashboard stats with no data', async () => {
      const stats = await getDashboardStats();

      expect(stats.totalUsers).toBe(0);
      expect(stats.totalAffiliates).toBe(0);
      expect(stats.totalSubscriptions).toBe(0);
      expect(stats.totalRevenue).toBe(0);
      expect(stats.monthlyRevenue).toBe(0);
      expect(stats.activeSubscriptions).toBe(0);
      expect(stats.pendingPayouts).toBe(0);
    });

    it('should calculate dashboard stats with sample data', async () => {
      // Create test users
      const userResults = await db.insert(usersTable)
        .values([
          {
            email: 'user1@test.com',
            password_hash: 'hashed_password_1',
            first_name: 'User',
            last_name: 'One',
            is_active: true,
            is_admin: false
          },
          {
            email: 'user2@test.com',
            password_hash: 'hashed_password_2',
            first_name: 'User',
            last_name: 'Two',
            is_active: true,
            is_admin: false
          }
        ])
        .returning()
        .execute();

      // Create membership level
      const membershipResult = await db.insert(membershipLevelsTable)
        .values({
          name: 'Premium',
          description: 'Premium membership',
          price: '29.99',
          duration_days: 30,
          features: ['feature1'],
          is_active: true
        })
        .returning()
        .execute();

      // Create affiliate
      const affiliateResult = await db.insert(affiliatesTable)
        .values({
          user_id: userResults[0].id,
          affiliate_code: 'TEST123',
          commission_rate: '0.10',
          total_earnings: '100.00',
          total_referrals: 5,
          is_active: true
        })
        .returning()
        .execute();

      // Create subscriptions
      await db.insert(subscriptionsTable)
        .values([
          {
            user_id: userResults[0].id,
            membership_level_id: membershipResult[0].id,
            status: 'active',
            current_period_start: new Date(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            amount: '29.99',
            currency: 'USD'
          },
          {
            user_id: userResults[1].id,
            membership_level_id: membershipResult[0].id,
            status: 'cancelled',
            current_period_start: new Date(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            amount: '29.99',
            currency: 'USD'
          }
        ])
        .execute();

      // Create pending payout
      await db.insert(affiliatePayoutsTable)
        .values({
          affiliate_id: affiliateResult[0].id,
          amount: '50.00',
          status: 'pending',
          payout_method: 'paypal',
          payout_details: 'test@paypal.com'
        })
        .execute();

      const stats = await getDashboardStats();

      expect(stats.totalUsers).toBe(2);
      expect(stats.totalAffiliates).toBe(1);
      expect(stats.totalSubscriptions).toBe(2);
      expect(stats.totalRevenue).toBe(59.98);
      expect(stats.monthlyRevenue).toBe(59.98); // Created today, so within current month
      expect(stats.activeSubscriptions).toBe(1);
      expect(stats.pendingPayouts).toBe(50.00);
    });
  });

  describe('getAffiliateStats', () => {
    it('should throw error for non-existent affiliate', async () => {
      await expect(getAffiliateStats(999)).rejects.toThrow(/affiliate not found/i);
    });

    it('should return affiliate stats', async () => {
      // Create test user
      const userResult = await db.insert(usersTable)
        .values({
          email: 'affiliate@test.com',
          password_hash: 'hashed_password',
          first_name: 'Affiliate',
          last_name: 'User',
          is_active: true,
          is_admin: false
        })
        .returning()
        .execute();

      // Create affiliate
      const affiliateResult = await db.insert(affiliatesTable)
        .values({
          user_id: userResult[0].id,
          affiliate_code: 'AFF123',
          commission_rate: '0.15',
          total_earnings: '250.50',
          total_referrals: 10,
          is_active: true
        })
        .returning()
        .execute();

      // Create referrals
      await db.insert(affiliateReferralsTable)
        .values([
          {
            affiliate_id: affiliateResult[0].id,
            referred_user_id: userResult[0].id,
            membership_purchase_id: null,
            commission_amount: '25.00',
            commission_status: 'pending'
          },
          {
            affiliate_id: affiliateResult[0].id,
            referred_user_id: userResult[0].id,
            membership_purchase_id: 1,
            commission_amount: '15.00',
            commission_status: 'approved'
          }
        ])
        .execute();

      const stats = await getAffiliateStats(affiliateResult[0].id);

      expect(stats.totalEarnings).toBe(250.50);
      expect(stats.pendingEarnings).toBe(25.00);
      expect(stats.totalReferrals).toBe(2);
      expect(stats.conversionRate).toBe(50); // 1 out of 2 referrals has membership_purchase_id
      expect(stats.monthlyEarnings).toBe(15.00); // Only approved commission from this month
      expect(stats.clicksThisMonth).toBe(0); // Placeholder value
    });
  });

  describe('getRevenueByMonth', () => {
    it('should return empty array when no subscriptions exist', async () => {
      const revenue = await getRevenueByMonth(6);
      expect(revenue).toEqual([]);
    });

    it('should return monthly revenue data', async () => {
      // Create test user and membership level
      const userResult = await db.insert(usersTable)
        .values({
          email: 'user@test.com',
          password_hash: 'hashed_password',
          first_name: 'Test',
          last_name: 'User',
          is_active: true,
          is_admin: false
        })
        .returning()
        .execute();

      const membershipResult = await db.insert(membershipLevelsTable)
        .values({
          name: 'Basic',
          description: 'Basic membership',
          price: '19.99',
          duration_days: 30,
          features: ['basic'],
          is_active: true
        })
        .returning()
        .execute();

      // Create subscriptions in current month
      await db.insert(subscriptionsTable)
        .values([
          {
            user_id: userResult[0].id,
            membership_level_id: membershipResult[0].id,
            status: 'active',
            current_period_start: new Date(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            amount: '19.99',
            currency: 'USD'
          },
          {
            user_id: userResult[0].id,
            membership_level_id: membershipResult[0].id,
            status: 'active',
            current_period_start: new Date(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            amount: '19.99',
            currency: 'USD'
          }
        ])
        .execute();

      const revenue = await getRevenueByMonth(3);
      
      expect(revenue).toHaveLength(1);
      expect(revenue[0]).toHaveProperty('month');
      expect(revenue[0]).toHaveProperty('revenue');
      expect(revenue[0].revenue).toBe(39.98);
      expect(typeof revenue[0].month).toBe('string');
      expect(revenue[0].month).toMatch(/^\d{4}-\d{2}$/); // YYYY-MM format
    });
  });

  describe('getTopAffiliates', () => {
    it('should return empty array when no affiliates exist', async () => {
      const topAffiliates = await getTopAffiliates(5);
      expect(topAffiliates).toEqual([]);
    });

    it('should return top affiliates ordered by earnings', async () => {
      // Create test users
      const userResults = await db.insert(usersTable)
        .values([
          {
            email: 'affiliate1@test.com',
            password_hash: 'hashed_password_1',
            first_name: 'John',
            last_name: 'Doe',
            is_active: true,
            is_admin: false
          },
          {
            email: 'affiliate2@test.com',
            password_hash: 'hashed_password_2',
            first_name: 'Jane',
            last_name: 'Smith',
            is_active: true,
            is_admin: false
          }
        ])
        .returning()
        .execute();

      // Create affiliates with different earnings
      await db.insert(affiliatesTable)
        .values([
          {
            user_id: userResults[0].id,
            affiliate_code: 'TOP1',
            commission_rate: '0.10',
            total_earnings: '500.00',
            total_referrals: 20,
            is_active: true
          },
          {
            user_id: userResults[1].id,
            affiliate_code: 'TOP2',
            commission_rate: '0.15',
            total_earnings: '750.00',
            total_referrals: 15,
            is_active: true
          }
        ])
        .execute();

      const topAffiliates = await getTopAffiliates(10);

      expect(topAffiliates).toHaveLength(2);
      
      // Should be ordered by earnings descending
      expect(topAffiliates[0].name).toBe('Jane Smith');
      expect(topAffiliates[0].earnings).toBe(750.00);
      expect(topAffiliates[0].referrals).toBe(15);
      
      expect(topAffiliates[1].name).toBe('John Doe');
      expect(topAffiliates[1].earnings).toBe(500.00);
      expect(topAffiliates[1].referrals).toBe(20);

      // Check all required fields
      topAffiliates.forEach(affiliate => {
        expect(affiliate).toHaveProperty('affiliateId');
        expect(affiliate).toHaveProperty('name');
        expect(affiliate).toHaveProperty('earnings');
        expect(affiliate).toHaveProperty('referrals');
        expect(typeof affiliate.affiliateId).toBe('number');
        expect(typeof affiliate.name).toBe('string');
        expect(typeof affiliate.earnings).toBe('number');
        expect(typeof affiliate.referrals).toBe('number');
      });
    });

    it('should respect limit parameter', async () => {
      // Create test user
      const userResult = await db.insert(usersTable)
        .values({
          email: 'affiliate@test.com',
          password_hash: 'hashed_password',
          first_name: 'Test',
          last_name: 'Affiliate',
          is_active: true,
          is_admin: false
        })
        .returning()
        .execute();

      // Create multiple affiliates (using same user for simplicity in test)
      await db.insert(affiliatesTable)
        .values([
          {
            user_id: userResult[0].id,
            affiliate_code: 'AFF1',
            commission_rate: '0.10',
            total_earnings: '100.00',
            total_referrals: 5,
            is_active: true
          },
          {
            user_id: userResult[0].id,
            affiliate_code: 'AFF2',
            commission_rate: '0.10',
            total_earnings: '200.00',
            total_referrals: 8,
            is_active: true
          }
        ])
        .execute();

      const topAffiliates = await getTopAffiliates(1);
      expect(topAffiliates).toHaveLength(1);
      expect(topAffiliates[0].earnings).toBe(200.00); // Should be the highest earner
    });
  });
});
