
import { db } from '../db';
import { affiliatesTable, usersTable } from '../db/schema';
import { type Affiliate, type CreateAffiliateInput } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function createAffiliate(input: CreateAffiliateInput): Promise<Affiliate> {
  try {
    // Generate unique affiliate code
    const affiliateCode = `AFF${input.user_id}${Date.now()}`;
    
    // Insert affiliate record
    const result = await db.insert(affiliatesTable)
      .values({
        user_id: input.user_id,
        affiliate_code: affiliateCode,
        commission_rate: input.commission_rate.toString(),
        total_earnings: '0',
        total_referrals: 0,
        is_active: input.is_active
      })
      .returning()
      .execute();

    const affiliate = result[0];
    return {
      ...affiliate,
      commission_rate: parseFloat(affiliate.commission_rate),
      total_earnings: parseFloat(affiliate.total_earnings)
    };
  } catch (error) {
    console.error('Affiliate creation failed:', error);
    throw error;
  }
}

export async function getAffiliateByUserId(userId: number): Promise<Affiliate | null> {
  try {
    const results = await db.select()
      .from(affiliatesTable)
      .where(eq(affiliatesTable.user_id, userId))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const affiliate = results[0];
    return {
      ...affiliate,
      commission_rate: parseFloat(affiliate.commission_rate),
      total_earnings: parseFloat(affiliate.total_earnings)
    };
  } catch (error) {
    console.error('Get affiliate by user ID failed:', error);
    throw error;
  }
}

export async function getAffiliateByCode(code: string): Promise<Affiliate | null> {
  try {
    const results = await db.select()
      .from(affiliatesTable)
      .where(eq(affiliatesTable.affiliate_code, code))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const affiliate = results[0];
    return {
      ...affiliate,
      commission_rate: parseFloat(affiliate.commission_rate),
      total_earnings: parseFloat(affiliate.total_earnings)
    };
  } catch (error) {
    console.error('Get affiliate by code failed:', error);
    throw error;
  }
}

export async function getAffiliates(): Promise<Affiliate[]> {
  try {
    const results = await db.select()
      .from(affiliatesTable)
      .execute();

    return results.map(affiliate => ({
      ...affiliate,
      commission_rate: parseFloat(affiliate.commission_rate),
      total_earnings: parseFloat(affiliate.total_earnings)
    }));
  } catch (error) {
    console.error('Get affiliates failed:', error);
    throw error;
  }
}

export async function updateAffiliateStats(affiliateId: number, earnings: number, referrals: number): Promise<void> {
  try {
    await db.update(affiliatesTable)
      .set({
        total_earnings: earnings.toString(),
        total_referrals: referrals,
        updated_at: new Date()
      })
      .where(eq(affiliatesTable.id, affiliateId))
      .execute();
  } catch (error) {
    console.error('Update affiliate stats failed:', error);
    throw error;
  }
}

export async function deactivateAffiliate(affiliateId: number): Promise<void> {
  try {
    await db.update(affiliatesTable)
      .set({
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(affiliatesTable.id, affiliateId))
      .execute();
  } catch (error) {
    console.error('Deactivate affiliate failed:', error);
    throw error;
  }
}
