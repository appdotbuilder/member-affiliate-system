
import { db } from '../db';
import { subscriptionsTable, usersTable, membershipLevelsTable, affiliatesTable } from '../db/schema';
import { type Subscription, type CreateSubscriptionInput } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
  try {
    // Verify that user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Verify that membership level exists
    const membershipLevel = await db.select()
      .from(membershipLevelsTable)
      .where(eq(membershipLevelsTable.id, input.membership_level_id))
      .execute();

    if (membershipLevel.length === 0) {
      throw new Error('Membership level not found');
    }

    // If affiliate_id is provided, verify affiliate exists
    if (input.affiliate_id) {
      const affiliate = await db.select()
        .from(affiliatesTable)
        .where(eq(affiliatesTable.id, input.affiliate_id))
        .execute();

      if (affiliate.length === 0) {
        throw new Error('Affiliate not found');
      }
    }

    // Calculate subscription period based on membership level duration
    const now = new Date();
    const endDate = new Date(now.getTime() + membershipLevel[0].duration_days * 24 * 60 * 60 * 1000);

    // Create subscription
    const result = await db.insert(subscriptionsTable)
      .values({
        user_id: input.user_id,
        membership_level_id: input.membership_level_id,
        stripe_subscription_id: input.stripe_subscription_id || null,
        status: 'active',
        current_period_start: now,
        current_period_end: endDate,
        amount: input.amount.toString(),
        currency: input.currency || 'USD',
        affiliate_id: input.affiliate_id || null
      })
      .returning()
      .execute();

    const subscription = result[0];
    return {
      ...subscription,
      amount: parseFloat(subscription.amount)
    };
  } catch (error) {
    console.error('Subscription creation failed:', error);
    throw error;
  }
}

export async function getUserSubscriptions(userId: number): Promise<Subscription[]> {
  try {
    const subscriptions = await db.select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.user_id, userId))
      .execute();

    return subscriptions.map(subscription => ({
      ...subscription,
      amount: parseFloat(subscription.amount)
    }));
  } catch (error) {
    console.error('Get user subscriptions failed:', error);
    throw error;
  }
}

export async function getActiveSubscription(userId: number): Promise<Subscription | null> {
  try {
    const subscriptions = await db.select()
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.user_id, userId),
          eq(subscriptionsTable.status, 'active')
        )
      )
      .execute();

    if (subscriptions.length === 0) {
      return null;
    }

    const subscription = subscriptions[0];
    return {
      ...subscription,
      amount: parseFloat(subscription.amount)
    };
  } catch (error) {
    console.error('Get active subscription failed:', error);
    throw error;
  }
}

export async function cancelSubscription(subscriptionId: number): Promise<void> {
  try {
    const result = await db.update(subscriptionsTable)
      .set({ 
        status: 'cancelled',
        updated_at: new Date()
      })
      .where(eq(subscriptionsTable.id, subscriptionId))
      .execute();

    if (result.rowCount === 0) {
      throw new Error('Subscription not found');
    }
  } catch (error) {
    console.error('Cancel subscription failed:', error);
    throw error;
  }
}

export async function updateSubscriptionStatus(subscriptionId: number, status: 'active' | 'cancelled' | 'expired' | 'pending'): Promise<void> {
  try {
    const result = await db.update(subscriptionsTable)
      .set({ 
        status: status,
        updated_at: new Date()
      })
      .where(eq(subscriptionsTable.id, subscriptionId))
      .execute();

    if (result.rowCount === 0) {
      throw new Error('Subscription not found');
    }
  } catch (error) {
    console.error('Update subscription status failed:', error);
    throw error;
  }
}

export async function renewSubscription(subscriptionId: number): Promise<Subscription> {
  try {
    // Get existing subscription with membership level info
    const subscriptionResult = await db.select()
      .from(subscriptionsTable)
      .innerJoin(membershipLevelsTable, eq(subscriptionsTable.membership_level_id, membershipLevelsTable.id))
      .where(eq(subscriptionsTable.id, subscriptionId))
      .execute();

    if (subscriptionResult.length === 0) {
      throw new Error('Subscription not found');
    }

    const existingSubscription = subscriptionResult[0].subscriptions;
    const membershipLevel = subscriptionResult[0].membership_levels;

    // Calculate new period dates
    const now = new Date();
    const newEndDate = new Date(now.getTime() + membershipLevel.duration_days * 24 * 60 * 60 * 1000);

    // Update subscription
    const result = await db.update(subscriptionsTable)
      .set({
        status: 'active',
        current_period_start: now,
        current_period_end: newEndDate,
        updated_at: new Date()
      })
      .where(eq(subscriptionsTable.id, subscriptionId))
      .returning()
      .execute();

    const subscription = result[0];
    return {
      ...subscription,
      amount: parseFloat(subscription.amount)
    };
  } catch (error) {
    console.error('Renew subscription failed:', error);
    throw error;
  }
}
