
import { db } from '../db';
import { affiliatePayoutsTable, affiliatesTable, affiliateReferralsTable } from '../db/schema';
import { type AffiliatePayout, type CreateAffiliatePayoutInput } from '../schema';
import { eq, and, sum } from 'drizzle-orm';

export async function createAffiliatePayout(input: CreateAffiliatePayoutInput): Promise<AffiliatePayout> {
  try {
    // Verify affiliate exists
    const affiliate = await db.select()
      .from(affiliatesTable)
      .where(eq(affiliatesTable.id, input.affiliate_id))
      .execute();

    if (affiliate.length === 0) {
      throw new Error('Affiliate not found');
    }

    // Insert payout record
    const result = await db.insert(affiliatePayoutsTable)
      .values({
        affiliate_id: input.affiliate_id,
        amount: input.amount.toString(), // Convert number to string for numeric column
        payout_method: input.payout_method,
        payout_details: input.payout_details || null,
        status: 'pending'
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const payout = result[0];
    return {
      ...payout,
      amount: parseFloat(payout.amount) // Convert string back to number
    };
  } catch (error) {
    console.error('Affiliate payout creation failed:', error);
    throw error;
  }
}

export async function getAffiliatePayouts(affiliateId: number): Promise<AffiliatePayout[]> {
  try {
    const results = await db.select()
      .from(affiliatePayoutsTable)
      .where(eq(affiliatePayoutsTable.affiliate_id, affiliateId))
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(payout => ({
      ...payout,
      amount: parseFloat(payout.amount) // Convert string back to number
    }));
  } catch (error) {
    console.error('Failed to fetch affiliate payouts:', error);
    throw error;
  }
}

export async function getPendingPayouts(): Promise<AffiliatePayout[]> {
  try {
    const results = await db.select()
      .from(affiliatePayoutsTable)
      .where(eq(affiliatePayoutsTable.status, 'pending'))
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(payout => ({
      ...payout,
      amount: parseFloat(payout.amount) // Convert string back to number
    }));
  } catch (error) {
    console.error('Failed to fetch pending payouts:', error);
    throw error;
  }
}

export async function processPayout(payoutId: number): Promise<void> {
  try {
    // Update payout status to processing
    await db.update(affiliatePayoutsTable)
      .set({
        status: 'processing',
        processed_at: new Date()
      })
      .where(eq(affiliatePayoutsTable.id, payoutId))
      .execute();
  } catch (error) {
    console.error('Failed to process payout:', error);
    throw error;
  }
}

export async function updatePayoutStatus(payoutId: number, status: 'pending' | 'processing' | 'completed' | 'failed'): Promise<void> {
  try {
    const updateData: any = { status };
    
    // Set processed_at timestamp for completed/failed status
    if (status === 'completed' || status === 'failed') {
      updateData.processed_at = new Date();
    }

    await db.update(affiliatePayoutsTable)
      .set(updateData)
      .where(eq(affiliatePayoutsTable.id, payoutId))
      .execute();
  } catch (error) {
    console.error('Failed to update payout status:', error);
    throw error;
  }
}

export async function calculateAffiliateEarnings(affiliateId: number): Promise<number> {
  try {
    // Sum all approved commissions that haven't been paid out yet
    const result = await db.select({
      totalEarnings: sum(affiliateReferralsTable.commission_amount)
    })
      .from(affiliateReferralsTable)
      .where(
        and(
          eq(affiliateReferralsTable.affiliate_id, affiliateId),
          eq(affiliateReferralsTable.commission_status, 'approved')
        )
      )
      .execute();

    // Handle null result from sum aggregation
    const totalEarnings = result[0]?.totalEarnings;
    return totalEarnings ? parseFloat(totalEarnings) : 0;
  } catch (error) {
    console.error('Failed to calculate affiliate earnings:', error);
    throw error;
  }
}
