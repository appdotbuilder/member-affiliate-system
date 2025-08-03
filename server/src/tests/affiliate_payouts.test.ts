
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, affiliatesTable, affiliatePayoutsTable, affiliateReferralsTable } from '../db/schema';
import { type CreateAffiliatePayoutInput } from '../schema';
import {
  createAffiliatePayout,
  getAffiliatePayouts,
  getPendingPayouts,
  processPayout,
  updatePayoutStatus,
  calculateAffiliateEarnings
} from '../handlers/affiliate_payouts';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'affiliate@test.com',
  password_hash: 'hashed_password',
  first_name: 'John',
  last_name: 'Doe',
  is_active: true,
  is_admin: false
};

const testAffiliate = {
  user_id: 1,
  affiliate_code: 'TEST123',
  commission_rate: '0.1000', // 10% commission rate
  total_earnings: '0.00',
  total_referrals: 0,
  is_active: true
};

const testPayoutInput: CreateAffiliatePayoutInput = {
  affiliate_id: 1,
  amount: 100.50,
  payout_method: 'bank_transfer',
  payout_details: 'Account: 12345'
};

describe('createAffiliatePayout', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a payout', async () => {
    // Create prerequisite user and affiliate
    await db.insert(usersTable).values(testUser).execute();
    await db.insert(affiliatesTable).values(testAffiliate).execute();

    const result = await createAffiliatePayout(testPayoutInput);

    // Basic field validation
    expect(result.affiliate_id).toEqual(1);
    expect(result.amount).toEqual(100.50);
    expect(typeof result.amount).toBe('number');
    expect(result.payout_method).toEqual('bank_transfer');
    expect(result.payout_details).toEqual('Account: 12345');
    expect(result.status).toEqual('pending');
    expect(result.processed_at).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save payout to database', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();
    await db.insert(affiliatesTable).values(testAffiliate).execute();

    const result = await createAffiliatePayout(testPayoutInput);

    const payouts = await db.select()
      .from(affiliatePayoutsTable)
      .where(eq(affiliatePayoutsTable.id, result.id))
      .execute();

    expect(payouts).toHaveLength(1);
    expect(payouts[0].affiliate_id).toEqual(1);
    expect(parseFloat(payouts[0].amount)).toEqual(100.50);
    expect(payouts[0].payout_method).toEqual('bank_transfer');
    expect(payouts[0].status).toEqual('pending');
  });

  it('should throw error for non-existent affiliate', async () => {
    expect(createAffiliatePayout(testPayoutInput)).rejects.toThrow(/affiliate not found/i);
  });
});

describe('getAffiliatePayouts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return payouts for affiliate', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();
    await db.insert(affiliatesTable).values(testAffiliate).execute();
    
    // Create multiple payouts
    await createAffiliatePayout(testPayoutInput);
    await createAffiliatePayout({ ...testPayoutInput, amount: 75.25 });

    const payouts = await getAffiliatePayouts(1);

    expect(payouts).toHaveLength(2);
    expect(payouts[0].affiliate_id).toEqual(1);
    expect(payouts[1].affiliate_id).toEqual(1);
    expect(typeof payouts[0].amount).toBe('number');
    expect(typeof payouts[1].amount).toBe('number');
  });

  it('should return empty array for affiliate with no payouts', async () => {
    const payouts = await getAffiliatePayouts(999);
    expect(payouts).toHaveLength(0);
  });
});

describe('getPendingPayouts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return only pending payouts', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();
    await db.insert(affiliatesTable).values(testAffiliate).execute();

    // Create payouts with different statuses
    const payout1 = await createAffiliatePayout(testPayoutInput);
    const payout2 = await createAffiliatePayout({ ...testPayoutInput, amount: 50.00 });
    
    // Update one payout to completed
    await updatePayoutStatus(payout2.id, 'completed');

    const pendingPayouts = await getPendingPayouts();

    expect(pendingPayouts).toHaveLength(1);
    expect(pendingPayouts[0].id).toEqual(payout1.id);
    expect(pendingPayouts[0].status).toEqual('pending');
    expect(typeof pendingPayouts[0].amount).toBe('number');
  });
});

describe('processPayout', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update payout to processing status', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();
    await db.insert(affiliatesTable).values(testAffiliate).execute();

    const payout = await createAffiliatePayout(testPayoutInput);
    await processPayout(payout.id);

    const updatedPayouts = await db.select()
      .from(affiliatePayoutsTable)
      .where(eq(affiliatePayoutsTable.id, payout.id))
      .execute();

    expect(updatedPayouts[0].status).toEqual('processing');
    expect(updatedPayouts[0].processed_at).toBeInstanceOf(Date);
  });
});

describe('updatePayoutStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update payout status', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();
    await db.insert(affiliatesTable).values(testAffiliate).execute();

    const payout = await createAffiliatePayout(testPayoutInput);
    await updatePayoutStatus(payout.id, 'completed');

    const updatedPayouts = await db.select()
      .from(affiliatePayoutsTable)
      .where(eq(affiliatePayoutsTable.id, payout.id))
      .execute();

    expect(updatedPayouts[0].status).toEqual('completed');
    expect(updatedPayouts[0].processed_at).toBeInstanceOf(Date);
  });

  it('should set processed_at for completed status', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();
    await db.insert(affiliatesTable).values(testAffiliate).execute();

    const payout = await createAffiliatePayout(testPayoutInput);
    await updatePayoutStatus(payout.id, 'failed');

    const updatedPayouts = await db.select()
      .from(affiliatePayoutsTable)
      .where(eq(affiliatePayoutsTable.id, payout.id))
      .execute();

    expect(updatedPayouts[0].status).toEqual('failed');
    expect(updatedPayouts[0].processed_at).toBeInstanceOf(Date);
  });
});

describe('calculateAffiliateEarnings', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should calculate total approved earnings', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();
    const referredUser = { ...testUser, email: 'referred@test.com' };
    await db.insert(usersTable).values(referredUser).execute();
    await db.insert(affiliatesTable).values(testAffiliate).execute();

    // Create approved referrals
    await db.insert(affiliateReferralsTable).values({
      affiliate_id: 1,
      referred_user_id: 2,
      commission_amount: '25.50',
      commission_status: 'approved'
    }).execute();

    await db.insert(affiliateReferralsTable).values({
      affiliate_id: 1,
      referred_user_id: 2,
      commission_amount: '15.25',
      commission_status: 'approved'
    }).execute();

    // Create pending referral (should not be included)
    await db.insert(affiliateReferralsTable).values({
      affiliate_id: 1,
      referred_user_id: 2,
      commission_amount: '10.00',
      commission_status: 'pending'
    }).execute();

    const earnings = await calculateAffiliateEarnings(1);

    expect(earnings).toEqual(40.75); // 25.50 + 15.25
    expect(typeof earnings).toBe('number');
  });

  it('should return zero for affiliate with no approved earnings', async () => {
    const earnings = await calculateAffiliateEarnings(999);
    expect(earnings).toEqual(0);
  });
});
