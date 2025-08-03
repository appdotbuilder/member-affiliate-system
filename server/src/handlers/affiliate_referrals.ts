
import { db } from '../db';
import { affiliateReferralsTable, affiliatesTable, usersTable, subscriptionsTable } from '../db/schema';
import { type AffiliateReferral, type CreateAffiliateReferralInput } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function createAffiliateReferral(input: CreateAffiliateReferralInput): Promise<AffiliateReferral> {
  try {
    // Verify affiliate exists
    const affiliate = await db.select()
      .from(affiliatesTable)
      .where(eq(affiliatesTable.id, input.affiliate_id))
      .execute();
    
    if (affiliate.length === 0) {
      throw new Error('Affiliate not found');
    }

    // Verify referred user exists
    const referredUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.referred_user_id))
      .execute();
    
    if (referredUser.length === 0) {
      throw new Error('Referred user not found');
    }

    // If membership_purchase_id is provided, verify subscription exists
    if (input.membership_purchase_id) {
      const subscription = await db.select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.id, input.membership_purchase_id))
        .execute();
      
      if (subscription.length === 0) {
        throw new Error('Subscription not found');
      }
    }

    // Insert referral record
    const result = await db.insert(affiliateReferralsTable)
      .values({
        affiliate_id: input.affiliate_id,
        referred_user_id: input.referred_user_id,
        membership_purchase_id: input.membership_purchase_id,
        commission_amount: input.commission_amount.toString(),
        commission_status: 'pending'
      })
      .returning()
      .execute();

    const referral = result[0];
    return {
      ...referral,
      commission_amount: parseFloat(referral.commission_amount)
    };
  } catch (error) {
    console.error('Affiliate referral creation failed:', error);
    throw error;
  }
}

export async function getAffiliateReferrals(affiliateId: number): Promise<AffiliateReferral[]> {
  try {
    const referrals = await db.select()
      .from(affiliateReferralsTable)
      .where(eq(affiliateReferralsTable.affiliate_id, affiliateId))
      .execute();

    return referrals.map(referral => ({
      ...referral,
      commission_amount: parseFloat(referral.commission_amount)
    }));
  } catch (error) {
    console.error('Failed to fetch affiliate referrals:', error);
    throw error;
  }
}

export async function updateReferralStatus(referralId: number, status: 'pending' | 'approved' | 'paid' | 'cancelled'): Promise<void> {
  try {
    // Verify referral exists
    const existingReferral = await db.select()
      .from(affiliateReferralsTable)
      .where(eq(affiliateReferralsTable.id, referralId))
      .execute();
    
    if (existingReferral.length === 0) {
      throw new Error('Referral not found');
    }

    await db.update(affiliateReferralsTable)
      .set({
        commission_status: status,
        updated_at: new Date()
      })
      .where(eq(affiliateReferralsTable.id, referralId))
      .execute();
  } catch (error) {
    console.error('Failed to update referral status:', error);
    throw error;
  }
}

export async function getPendingReferrals(): Promise<AffiliateReferral[]> {
  try {
    const referrals = await db.select()
      .from(affiliateReferralsTable)
      .where(eq(affiliateReferralsTable.commission_status, 'pending'))
      .execute();

    return referrals.map(referral => ({
      ...referral,
      commission_amount: parseFloat(referral.commission_amount)
    }));
  } catch (error) {
    console.error('Failed to fetch pending referrals:', error);
    throw error;
  }
}

export async function approveReferral(referralId: number): Promise<void> {
  try {
    // Verify referral exists and is pending
    const existingReferral = await db.select()
      .from(affiliateReferralsTable)
      .where(
        and(
          eq(affiliateReferralsTable.id, referralId),
          eq(affiliateReferralsTable.commission_status, 'pending')
        )
      )
      .execute();
    
    if (existingReferral.length === 0) {
      throw new Error('Pending referral not found');
    }

    await db.update(affiliateReferralsTable)
      .set({
        commission_status: 'approved',
        updated_at: new Date()
      })
      .where(eq(affiliateReferralsTable.id, referralId))
      .execute();
  } catch (error) {
    console.error('Failed to approve referral:', error);
    throw error;
  }
}
