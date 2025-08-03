
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, affiliatesTable, subscriptionsTable, membershipLevelsTable, affiliateReferralsTable } from '../db/schema';
import { type CreateAffiliateReferralInput } from '../schema';
import { 
  createAffiliateReferral, 
  getAffiliateReferrals, 
  updateReferralStatus, 
  getPendingReferrals, 
  approveReferral 
} from '../handlers/affiliate_referrals';
import { eq } from 'drizzle-orm';

describe('Affiliate Referrals', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testAffiliateId: number;
  let testReferredUserId: number;
  let testSubscriptionId: number;
  let testMembershipLevelId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'affiliate@test.com',
        password_hash: 'hashedpassword',
        first_name: 'John',
        last_name: 'Doe'
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create test referred user
    const referredUserResult = await db.insert(usersTable)
      .values({
        email: 'referred@test.com',
        password_hash: 'hashedpassword',
        first_name: 'Jane',
        last_name: 'Smith'
      })
      .returning()
      .execute();
    testReferredUserId = referredUserResult[0].id;

    // Create test membership level
    const membershipResult = await db.insert(membershipLevelsTable)
      .values({
        name: 'Basic',
        price: '29.99',
        duration_days: 30,
        features: ['feature1', 'feature2']
      })
      .returning()
      .execute();
    testMembershipLevelId = membershipResult[0].id;

    // Create test affiliate
    const affiliateResult = await db.insert(affiliatesTable)
      .values({
        user_id: testUserId,
        affiliate_code: 'TEST123',
        commission_rate: '0.10'
      })
      .returning()
      .execute();
    testAffiliateId = affiliateResult[0].id;

    // Create test subscription
    const subscriptionResult = await db.insert(subscriptionsTable)
      .values({
        user_id: testReferredUserId,
        membership_level_id: testMembershipLevelId,
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        amount: '29.99'
      })
      .returning()
      .execute();
    testSubscriptionId = subscriptionResult[0].id;
  });

  describe('createAffiliateReferral', () => {
    const testInput: CreateAffiliateReferralInput = {
      affiliate_id: 0, // Will be set in beforeEach
      referred_user_id: 0, // Will be set in beforeEach
      membership_purchase_id: 0, // Will be set in beforeEach
      commission_amount: 2.99
    };

    beforeEach(() => {
      testInput.affiliate_id = testAffiliateId;
      testInput.referred_user_id = testReferredUserId;
      testInput.membership_purchase_id = testSubscriptionId;
    });

    it('should create an affiliate referral', async () => {
      const result = await createAffiliateReferral(testInput);

      expect(result.affiliate_id).toEqual(testAffiliateId);
      expect(result.referred_user_id).toEqual(testReferredUserId);
      expect(result.membership_purchase_id).toEqual(testSubscriptionId);
      expect(result.commission_amount).toEqual(2.99);
      expect(result.commission_status).toEqual('pending');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save referral to database', async () => {
      const result = await createAffiliateReferral(testInput);

      const referrals = await db.select()
        .from(affiliateReferralsTable)
        .where(eq(affiliateReferralsTable.id, result.id))
        .execute();

      expect(referrals).toHaveLength(1);
      expect(referrals[0].affiliate_id).toEqual(testAffiliateId);
      expect(referrals[0].referred_user_id).toEqual(testReferredUserId);
      expect(parseFloat(referrals[0].commission_amount)).toEqual(2.99);
      expect(referrals[0].commission_status).toEqual('pending');
    });

    it('should create referral without membership purchase', async () => {
      const inputWithoutPurchase = {
        ...testInput,
        membership_purchase_id: null
      };

      const result = await createAffiliateReferral(inputWithoutPurchase);

      expect(result.membership_purchase_id).toBeNull();
      expect(result.commission_amount).toEqual(2.99);
    });

    it('should throw error for non-existent affiliate', async () => {
      const invalidInput = {
        ...testInput,
        affiliate_id: 99999
      };

      await expect(createAffiliateReferral(invalidInput))
        .rejects.toThrow(/affiliate not found/i);
    });

    it('should throw error for non-existent referred user', async () => {
      const invalidInput = {
        ...testInput,
        referred_user_id: 99999
      };

      await expect(createAffiliateReferral(invalidInput))
        .rejects.toThrow(/referred user not found/i);
    });

    it('should throw error for non-existent subscription', async () => {
      const invalidInput = {
        ...testInput,
        membership_purchase_id: 99999
      };

      await expect(createAffiliateReferral(invalidInput))
        .rejects.toThrow(/subscription not found/i);
    });
  });

  describe('getAffiliateReferrals', () => {
    it('should return referrals for specific affiliate', async () => {
      // Create test referral
      await createAffiliateReferral({
        affiliate_id: testAffiliateId,
        referred_user_id: testReferredUserId,
        commission_amount: 2.99
      });

      const referrals = await getAffiliateReferrals(testAffiliateId);

      expect(referrals).toHaveLength(1);
      expect(referrals[0].affiliate_id).toEqual(testAffiliateId);
      expect(referrals[0].commission_amount).toEqual(2.99);
      expect(typeof referrals[0].commission_amount).toBe('number');
    });

    it('should return empty array for affiliate with no referrals', async () => {
      const referrals = await getAffiliateReferrals(testAffiliateId);

      expect(referrals).toHaveLength(0);
    });
  });

  describe('updateReferralStatus', () => {
    let testReferralId: number;

    beforeEach(async () => {
      const referral = await createAffiliateReferral({
        affiliate_id: testAffiliateId,
        referred_user_id: testReferredUserId,
        commission_amount: 2.99
      });
      testReferralId = referral.id;
    });

    it('should update referral status', async () => {
      await updateReferralStatus(testReferralId, 'approved');

      const referrals = await db.select()
        .from(affiliateReferralsTable)
        .where(eq(affiliateReferralsTable.id, testReferralId))
        .execute();

      expect(referrals[0].commission_status).toEqual('approved');
    });

    it('should throw error for non-existent referral', async () => {
      await expect(updateReferralStatus(99999, 'approved'))
        .rejects.toThrow(/referral not found/i);
    });
  });

  describe('getPendingReferrals', () => {
    it('should return only pending referrals', async () => {
      // Create pending referral
      await createAffiliateReferral({
        affiliate_id: testAffiliateId,
        referred_user_id: testReferredUserId,
        commission_amount: 2.99
      });

      // Create approved referral
      const approvedReferral = await createAffiliateReferral({
        affiliate_id: testAffiliateId,
        referred_user_id: testReferredUserId,
        commission_amount: 1.99
      });
      await updateReferralStatus(approvedReferral.id, 'approved');

      const pendingReferrals = await getPendingReferrals();

      expect(pendingReferrals).toHaveLength(1);
      expect(pendingReferrals[0].commission_status).toEqual('pending');
      expect(pendingReferrals[0].commission_amount).toEqual(2.99);
    });

    it('should return empty array when no pending referrals', async () => {
      const pendingReferrals = await getPendingReferrals();

      expect(pendingReferrals).toHaveLength(0);
    });
  });

  describe('approveReferral', () => {
    let testReferralId: number;

    beforeEach(async () => {
      const referral = await createAffiliateReferral({
        affiliate_id: testAffiliateId,
        referred_user_id: testReferredUserId,
        commission_amount: 2.99
      });
      testReferralId = referral.id;
    });

    it('should approve pending referral', async () => {
      await approveReferral(testReferralId);

      const referrals = await db.select()
        .from(affiliateReferralsTable)
        .where(eq(affiliateReferralsTable.id, testReferralId))
        .execute();

      expect(referrals[0].commission_status).toEqual('approved');
    });

    it('should throw error for non-existent pending referral', async () => {
      await expect(approveReferral(99999))
        .rejects.toThrow(/pending referral not found/i);
    });

    it('should throw error when trying to approve already approved referral', async () => {
      // First approve the referral
      await updateReferralStatus(testReferralId, 'approved');

      // Try to approve again
      await expect(approveReferral(testReferralId))
        .rejects.toThrow(/pending referral not found/i);
    });
  });
});
