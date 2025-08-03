
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { subscriptionsTable, usersTable, membershipLevelsTable, affiliatesTable } from '../db/schema';
import { type CreateSubscriptionInput } from '../schema';
import { 
  createSubscription, 
  getUserSubscriptions, 
  getActiveSubscription, 
  cancelSubscription, 
  updateSubscriptionStatus, 
  renewSubscription 
} from '../handlers/subscriptions';
import { eq } from 'drizzle-orm';

// Test data setup
const createTestUser = async () => {
  const result = await db.insert(usersTable)
    .values({
      email: 'test@example.com',
      password_hash: 'hashedpassword',
      first_name: 'Test',
      last_name: 'User'
    })
    .returning()
    .execute();
  return result[0];
};

const createTestMembershipLevel = async () => {
  const result = await db.insert(membershipLevelsTable)
    .values({
      name: 'Premium',
      description: 'Premium membership',
      price: '29.99',
      duration_days: 30,
      features: ['feature1', 'feature2']
    })
    .returning()
    .execute();
  return result[0];
};

const createTestAffiliate = async (userId: number) => {
  const result = await db.insert(affiliatesTable)
    .values({
      user_id: userId,
      affiliate_code: 'TEST123',
      commission_rate: '0.1000'
    })
    .returning()
    .execute();
  return result[0];
};

describe('Subscription Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createSubscription', () => {
    it('should create a subscription successfully', async () => {
      const user = await createTestUser();
      const membershipLevel = await createTestMembershipLevel();

      const input: CreateSubscriptionInput = {
        user_id: user.id,
        membership_level_id: membershipLevel.id,
        amount: 29.99,
        currency: 'USD'
      };

      const result = await createSubscription(input);

      expect(result.user_id).toEqual(user.id);
      expect(result.membership_level_id).toEqual(membershipLevel.id);
      expect(result.amount).toEqual(29.99);
      expect(typeof result.amount).toBe('number');
      expect(result.currency).toEqual('USD');
      expect(result.status).toEqual('active');
      expect(result.id).toBeDefined();
      expect(result.current_period_start).toBeInstanceOf(Date);
      expect(result.current_period_end).toBeInstanceOf(Date);
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should create subscription with affiliate', async () => {
      const user = await createTestUser();
      const membershipLevel = await createTestMembershipLevel();
      const affiliate = await createTestAffiliate(user.id);

      const input: CreateSubscriptionInput = {
        user_id: user.id,
        membership_level_id: membershipLevel.id,
        amount: 29.99,
        currency: 'USD',
        affiliate_id: affiliate.id
      };

      const result = await createSubscription(input);

      expect(result.affiliate_id).toEqual(affiliate.id);
      expect(result.status).toEqual('active');
    });

    it('should save subscription to database', async () => {
      const user = await createTestUser();
      const membershipLevel = await createTestMembershipLevel();

      const input: CreateSubscriptionInput = {
        user_id: user.id,
        membership_level_id: membershipLevel.id,
        amount: 29.99,
        currency: 'USD'
      };

      const result = await createSubscription(input);

      const subscriptions = await db.select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.id, result.id))
        .execute();

      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0].user_id).toEqual(user.id);
      expect(parseFloat(subscriptions[0].amount)).toEqual(29.99);
    });

    it('should throw error for non-existent user', async () => {
      const membershipLevel = await createTestMembershipLevel();

      const input: CreateSubscriptionInput = {
        user_id: 999,
        membership_level_id: membershipLevel.id,
        amount: 29.99,
        currency: 'USD'
      };

      expect(createSubscription(input)).rejects.toThrow(/user not found/i);
    });

    it('should throw error for non-existent membership level', async () => {
      const user = await createTestUser();

      const input: CreateSubscriptionInput = {
        user_id: user.id,
        membership_level_id: 999,
        amount: 29.99,
        currency: 'USD'
      };

      expect(createSubscription(input)).rejects.toThrow(/membership level not found/i);
    });

    it('should throw error for non-existent affiliate', async () => {
      const user = await createTestUser();
      const membershipLevel = await createTestMembershipLevel();

      const input: CreateSubscriptionInput = {
        user_id: user.id,
        membership_level_id: membershipLevel.id,
        amount: 29.99,
        currency: 'USD',
        affiliate_id: 999
      };

      expect(createSubscription(input)).rejects.toThrow(/affiliate not found/i);
    });
  });

  describe('getUserSubscriptions', () => {
    it('should return all user subscriptions', async () => {
      const user = await createTestUser();
      const membershipLevel = await createTestMembershipLevel();

      // Create two subscriptions
      await createSubscription({
        user_id: user.id,
        membership_level_id: membershipLevel.id,
        amount: 29.99,
        currency: 'USD'
      });

      await createSubscription({
        user_id: user.id,
        membership_level_id: membershipLevel.id,
        amount: 39.99,
        currency: 'USD'
      });

      const subscriptions = await getUserSubscriptions(user.id);

      expect(subscriptions).toHaveLength(2);
      expect(subscriptions[0].user_id).toEqual(user.id);
      expect(subscriptions[1].user_id).toEqual(user.id);
      expect(typeof subscriptions[0].amount).toBe('number');
      expect(typeof subscriptions[1].amount).toBe('number');
    });

    it('should return empty array for user with no subscriptions', async () => {
      const user = await createTestUser();

      const subscriptions = await getUserSubscriptions(user.id);

      expect(subscriptions).toHaveLength(0);
    });
  });

  describe('getActiveSubscription', () => {
    it('should return active subscription', async () => {
      const user = await createTestUser();
      const membershipLevel = await createTestMembershipLevel();

      const created = await createSubscription({
        user_id: user.id,
        membership_level_id: membershipLevel.id,
        amount: 29.99,
        currency: 'USD'
      });

      const activeSubscription = await getActiveSubscription(user.id);

      expect(activeSubscription).not.toBeNull();
      expect(activeSubscription!.id).toEqual(created.id);
      expect(activeSubscription!.status).toEqual('active');
      expect(typeof activeSubscription!.amount).toBe('number');
    });

    it('should return null when no active subscription exists', async () => {
      const user = await createTestUser();

      const activeSubscription = await getActiveSubscription(user.id);

      expect(activeSubscription).toBeNull();
    });

    it('should return null when only cancelled subscriptions exist', async () => {
      const user = await createTestUser();
      const membershipLevel = await createTestMembershipLevel();

      const created = await createSubscription({
        user_id: user.id,
        membership_level_id: membershipLevel.id,
        amount: 29.99,
        currency: 'USD'
      });

      await cancelSubscription(created.id);

      const activeSubscription = await getActiveSubscription(user.id);

      expect(activeSubscription).toBeNull();
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription successfully', async () => {
      const user = await createTestUser();
      const membershipLevel = await createTestMembershipLevel();

      const created = await createSubscription({
        user_id: user.id,
        membership_level_id: membershipLevel.id,
        amount: 29.99,
        currency: 'USD'
      });

      await cancelSubscription(created.id);

      const subscription = await db.select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.id, created.id))
        .execute();

      expect(subscription[0].status).toEqual('cancelled');
    });

    it('should throw error for non-existent subscription', async () => {
      expect(cancelSubscription(999)).rejects.toThrow(/subscription not found/i);
    });
  });

  describe('updateSubscriptionStatus', () => {
    it('should update subscription status successfully', async () => {
      const user = await createTestUser();
      const membershipLevel = await createTestMembershipLevel();

      const created = await createSubscription({
        user_id: user.id,
        membership_level_id: membershipLevel.id,
        amount: 29.99,
        currency: 'USD'
      });

      await updateSubscriptionStatus(created.id, 'expired');

      const subscription = await db.select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.id, created.id))
        .execute();

      expect(subscription[0].status).toEqual('expired');
    });

    it('should throw error for non-existent subscription', async () => {
      expect(updateSubscriptionStatus(999, 'expired')).rejects.toThrow(/subscription not found/i);
    });
  });

  describe('renewSubscription', () => {
    it('should renew subscription successfully', async () => {
      const user = await createTestUser();
      const membershipLevel = await createTestMembershipLevel();

      const created = await createSubscription({
        user_id: user.id,
        membership_level_id: membershipLevel.id,
        amount: 29.99,
        currency: 'USD'
      });

      // First expire the subscription
      await updateSubscriptionStatus(created.id, 'expired');

      const renewed = await renewSubscription(created.id);

      expect(renewed.id).toEqual(created.id);
      expect(renewed.status).toEqual('active');
      expect(renewed.current_period_start).toBeInstanceOf(Date);
      expect(renewed.current_period_end).toBeInstanceOf(Date);
      expect(typeof renewed.amount).toBe('number');

      // Check that dates are updated
      expect(renewed.current_period_start.getTime()).toBeGreaterThan(created.current_period_start.getTime());
    });

    it('should throw error for non-existent subscription', async () => {
      expect(renewSubscription(999)).rejects.toThrow(/subscription not found/i);
    });
  });
});
