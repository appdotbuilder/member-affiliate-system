
import { db } from '../db';
import { userMembershipsTable, usersTable, membershipLevelsTable } from '../db/schema';
import { type UserMembership, type CreateUserMembershipInput } from '../schema';
import { eq, and, gte, lte } from 'drizzle-orm';

export async function getUserMemberships(userId: number): Promise<UserMembership[]> {
  try {
    const results = await db.select()
      .from(userMembershipsTable)
      .where(eq(userMembershipsTable.user_id, userId))
      .execute();

    return results.map(membership => ({
      ...membership,
      start_date: membership.start_date,
      end_date: membership.end_date,
      created_at: membership.created_at
    }));
  } catch (error) {
    console.error('Failed to get user memberships:', error);
    throw error;
  }
}

export async function createUserMembership(input: CreateUserMembershipInput): Promise<UserMembership> {
  try {
    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Verify membership level exists
    const membershipLevel = await db.select()
      .from(membershipLevelsTable)
      .where(eq(membershipLevelsTable.id, input.membership_level_id))
      .execute();

    if (membershipLevel.length === 0) {
      throw new Error('Membership level not found');
    }

    const startDate = input.start_date || new Date();
    const endDate = input.end_date || new Date(Date.now() + membershipLevel[0].duration_days * 24 * 60 * 60 * 1000);

    const result = await db.insert(userMembershipsTable)
      .values({
        user_id: input.user_id,
        membership_level_id: input.membership_level_id,
        start_date: startDate,
        end_date: endDate,
        is_active: true
      })
      .returning()
      .execute();

    return {
      ...result[0],
      start_date: result[0].start_date,
      end_date: result[0].end_date,
      created_at: result[0].created_at
    };
  } catch (error) {
    console.error('Failed to create user membership:', error);
    throw error;
  }
}

export async function getActiveMembership(userId: number): Promise<UserMembership | null> {
  try {
    const now = new Date();
    
    const results = await db.select()
      .from(userMembershipsTable)
      .where(
        and(
          eq(userMembershipsTable.user_id, userId),
          eq(userMembershipsTable.is_active, true),
          lte(userMembershipsTable.start_date, now),
          gte(userMembershipsTable.end_date, now)
        )
      )
      .execute();

    if (results.length === 0) {
      return null;
    }

    const membership = results[0];
    return {
      ...membership,
      start_date: membership.start_date,
      end_date: membership.end_date,
      created_at: membership.created_at
    };
  } catch (error) {
    console.error('Failed to get active membership:', error);
    throw error;
  }
}

export async function expireMembership(membershipId: number): Promise<void> {
  try {
    // Verify membership exists
    const membership = await db.select()
      .from(userMembershipsTable)
      .where(eq(userMembershipsTable.id, membershipId))
      .execute();

    if (membership.length === 0) {
      throw new Error('Membership not found');
    }

    await db.update(userMembershipsTable)
      .set({ 
        is_active: false,
        end_date: new Date() // Set end date to now to expire immediately
      })
      .where(eq(userMembershipsTable.id, membershipId))
      .execute();
  } catch (error) {
    console.error('Failed to expire membership:', error);
    throw error;
  }
}
