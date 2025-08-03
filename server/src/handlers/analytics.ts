
import { db } from '../db';
import { usersTable, affiliatesTable, subscriptionsTable, affiliateReferralsTable, affiliatePayoutsTable } from '../db/schema';
import { count, sum, eq, gte, and, desc, sql } from 'drizzle-orm';

export interface DashboardStats {
  totalUsers: number;
  totalAffiliates: number;
  totalSubscriptions: number;
  totalRevenue: number;
  monthlyRevenue: number;
  activeSubscriptions: number;
  pendingPayouts: number;
}

export interface AffiliateStats {
  totalEarnings: number;
  pendingEarnings: number;
  totalReferrals: number;
  conversionRate: number;
  monthlyEarnings: number;
  clicksThisMonth: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    // Get total users count
    const totalUsersResult = await db.select({ count: count() })
      .from(usersTable)
      .execute();
    const totalUsers = totalUsersResult[0]?.count || 0;

    // Get total affiliates count
    const totalAffiliatesResult = await db.select({ count: count() })
      .from(affiliatesTable)
      .execute();
    const totalAffiliates = totalAffiliatesResult[0]?.count || 0;

    // Get total subscriptions count
    const totalSubscriptionsResult = await db.select({ count: count() })
      .from(subscriptionsTable)
      .execute();
    const totalSubscriptions = totalSubscriptionsResult[0]?.count || 0;

    // Get total revenue from all subscriptions
    const totalRevenueResult = await db.select({ 
      total: sum(subscriptionsTable.amount) 
    })
      .from(subscriptionsTable)
      .execute();
    const totalRevenue = totalRevenueResult[0]?.total ? parseFloat(totalRevenueResult[0].total) : 0;

    // Get monthly revenue (current month)
    const currentMonth = new Date();
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    
    const monthlyRevenueResult = await db.select({ 
      total: sum(subscriptionsTable.amount) 
    })
      .from(subscriptionsTable)
      .where(gte(subscriptionsTable.created_at, firstDayOfMonth))
      .execute();
    const monthlyRevenue = monthlyRevenueResult[0]?.total ? parseFloat(monthlyRevenueResult[0].total) : 0;

    // Get active subscriptions count
    const activeSubscriptionsResult = await db.select({ count: count() })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.status, 'active'))
      .execute();
    const activeSubscriptions = activeSubscriptionsResult[0]?.count || 0;

    // Get pending payouts total
    const pendingPayoutsResult = await db.select({ 
      total: sum(affiliatePayoutsTable.amount) 
    })
      .from(affiliatePayoutsTable)
      .where(eq(affiliatePayoutsTable.status, 'pending'))
      .execute();
    const pendingPayouts = pendingPayoutsResult[0]?.total ? parseFloat(pendingPayoutsResult[0].total) : 0;

    return {
      totalUsers,
      totalAffiliates,
      totalSubscriptions,
      totalRevenue,
      monthlyRevenue,
      activeSubscriptions,
      pendingPayouts
    };
  } catch (error) {
    console.error('Dashboard stats fetch failed:', error);
    throw error;
  }
}

export async function getAffiliateStats(affiliateId: number): Promise<AffiliateStats> {
  try {
    // Get affiliate record for total earnings
    const affiliateResult = await db.select()
      .from(affiliatesTable)
      .where(eq(affiliatesTable.id, affiliateId))
      .execute();
    
    const affiliate = affiliateResult[0];
    if (!affiliate) {
      throw new Error('Affiliate not found');
    }

    const totalEarnings = parseFloat(affiliate.total_earnings);

    // Get pending earnings from referrals
    const pendingEarningsResult = await db.select({ 
      total: sum(affiliateReferralsTable.commission_amount) 
    })
      .from(affiliateReferralsTable)
      .where(and(
        eq(affiliateReferralsTable.affiliate_id, affiliateId),
        eq(affiliateReferralsTable.commission_status, 'pending')
      ))
      .execute();
    const pendingEarnings = pendingEarningsResult[0]?.total ? parseFloat(pendingEarningsResult[0].total) : 0;

    // Get total referrals count
    const totalReferralsResult = await db.select({ count: count() })
      .from(affiliateReferralsTable)
      .where(eq(affiliateReferralsTable.affiliate_id, affiliateId))
      .execute();
    const totalReferrals = totalReferralsResult[0]?.count || 0;

    // Calculate conversion rate (simplified: referrals with purchases / total referrals)
    const convertedReferralsResult = await db.select({ count: count() })
      .from(affiliateReferralsTable)
      .where(and(
        eq(affiliateReferralsTable.affiliate_id, affiliateId),
        sql`${affiliateReferralsTable.membership_purchase_id} IS NOT NULL`
      ))
      .execute();
    const convertedReferrals = convertedReferralsResult[0]?.count || 0;
    const conversionRate = totalReferrals > 0 ? (convertedReferrals / totalReferrals) * 100 : 0;

    // Get monthly earnings (current month)
    const currentMonth = new Date();
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    
    const monthlyEarningsResult = await db.select({ 
      total: sum(affiliateReferralsTable.commission_amount) 
    })
      .from(affiliateReferralsTable)
      .where(and(
        eq(affiliateReferralsTable.affiliate_id, affiliateId),
        gte(affiliateReferralsTable.created_at, firstDayOfMonth),
        eq(affiliateReferralsTable.commission_status, 'approved')
      ))
      .execute();
    const monthlyEarnings = monthlyEarningsResult[0]?.total ? parseFloat(monthlyEarningsResult[0].total) : 0;

    // Placeholder for clicks this month (would need a separate tracking table)
    const clicksThisMonth = 0;

    return {
      totalEarnings,
      pendingEarnings,
      totalReferrals,
      conversionRate,
      monthlyEarnings,
      clicksThisMonth
    };
  } catch (error) {
    console.error('Affiliate stats fetch failed:', error);
    throw error;
  }
}

export async function getRevenueByMonth(months: number = 12): Promise<Array<{ month: string; revenue: number }>> {
  try {
    const monthsAgo = new Date();
    monthsAgo.setMonth(monthsAgo.getMonth() - months);
    
    const revenueResult = await db.select({
      month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${subscriptionsTable.created_at}), 'YYYY-MM')`,
      revenue: sum(subscriptionsTable.amount)
    })
      .from(subscriptionsTable)
      .where(gte(subscriptionsTable.created_at, monthsAgo))
      .groupBy(sql`DATE_TRUNC('month', ${subscriptionsTable.created_at})`)
      .orderBy(sql`DATE_TRUNC('month', ${subscriptionsTable.created_at})`)
      .execute();

    return revenueResult.map(row => ({
      month: row.month,
      revenue: row.revenue ? parseFloat(row.revenue) : 0
    }));
  } catch (error) {
    console.error('Revenue by month fetch failed:', error);
    throw error;
  }
}

export async function getTopAffiliates(limit: number = 10): Promise<Array<{ affiliateId: number; name: string; earnings: number; referrals: number }>> {
  try {
    const topAffiliatesResult = await db.select({
      affiliateId: affiliatesTable.id,
      firstName: usersTable.first_name,
      lastName: usersTable.last_name,
      earnings: affiliatesTable.total_earnings,
      referrals: affiliatesTable.total_referrals
    })
      .from(affiliatesTable)
      .innerJoin(usersTable, eq(affiliatesTable.user_id, usersTable.id))
      .where(eq(affiliatesTable.is_active, true))
      .orderBy(desc(affiliatesTable.total_earnings))
      .limit(limit)
      .execute();

    return topAffiliatesResult.map(row => ({
      affiliateId: row.affiliateId,
      name: `${row.firstName} ${row.lastName}`,
      earnings: parseFloat(row.earnings),
      referrals: row.referrals
    }));
  } catch (error) {
    console.error('Top affiliates fetch failed:', error);
    throw error;
  }
}
