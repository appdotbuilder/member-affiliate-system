
import { db } from '../db';
import { contentTable, membershipLevelsTable, userMembershipsTable, usersTable } from '../db/schema';
import { type Content, type CreateContentInput } from '../schema';
import { eq, and, gte, or, isNull, desc } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export async function getContent(userId?: number): Promise<Content[]> {
  try {
    const conditions: SQL<unknown>[] = [];
    
    // Only show published content
    conditions.push(eq(contentTable.is_published, true));

    if (userId) {
      // Get user's active membership level
      const userMembership = await db.select({
        membership_level_id: userMembershipsTable.membership_level_id
      })
      .from(userMembershipsTable)
      .where(
        and(
          eq(userMembershipsTable.user_id, userId),
          eq(userMembershipsTable.is_active, true),
          gte(userMembershipsTable.end_date, new Date())
        )
      )
      .limit(1)
      .execute();

      if (userMembership.length > 0) {
        const membershipLevelId = userMembership[0].membership_level_id;
        // Show content that requires no membership or user's current membership level
        const membershipCondition = or(
          isNull(contentTable.required_membership_level_id),
          eq(contentTable.required_membership_level_id, membershipLevelId)
        );
        if (membershipCondition) {
          conditions.push(membershipCondition);
        }
      } else {
        // No active membership - only show content with no membership requirement
        conditions.push(isNull(contentTable.required_membership_level_id));
      }
    } else {
      // No user - only show content with no membership requirement
      conditions.push(isNull(contentTable.required_membership_level_id));
    }

    // Build final query
    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
    
    const results = await db.select()
      .from(contentTable)
      .where(whereClause)
      .orderBy(desc(contentTable.created_at))
      .execute();

    return results;
  } catch (error) {
    console.error('Get content failed:', error);
    throw error;
  }
}

export async function getContentById(id: number, userId?: number): Promise<Content | null> {
  try {
    const results = await db.select()
      .from(contentTable)
      .where(eq(contentTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const content = results[0];

    // Check if content is published
    if (!content.is_published) {
      return null;
    }

    // Check membership requirement
    if (content.required_membership_level_id && userId) {
      const userMembership = await db.select()
        .from(userMembershipsTable)
        .where(
          and(
            eq(userMembershipsTable.user_id, userId),
            eq(userMembershipsTable.membership_level_id, content.required_membership_level_id),
            eq(userMembershipsTable.is_active, true),
            gte(userMembershipsTable.end_date, new Date())
          )
        )
        .limit(1)
        .execute();

      if (userMembership.length === 0) {
        return null;
      }
    } else if (content.required_membership_level_id && !userId) {
      // Content requires membership but no user provided
      return null;
    }

    return content;
  } catch (error) {
    console.error('Get content by ID failed:', error);
    throw error;
  }
}

export async function createContent(input: CreateContentInput): Promise<Content> {
  try {
    // Validate membership level exists if provided
    if (input.required_membership_level_id) {
      const membershipLevel = await db.select()
        .from(membershipLevelsTable)
        .where(eq(membershipLevelsTable.id, input.required_membership_level_id))
        .limit(1)
        .execute();

      if (membershipLevel.length === 0) {
        throw new Error('Membership level not found');
      }
    }

    const result = await db.insert(contentTable)
      .values({
        title: input.title,
        description: input.description || null,
        content_type: input.content_type,
        content_url: input.content_url || null,
        content_body: input.content_body || null,
        required_membership_level_id: input.required_membership_level_id || null,
        is_published: input.is_published ?? false
      })
      .returning()
      .execute();

    const content = result[0];
    return content;
  } catch (error) {
    console.error('Content creation failed:', error);
    throw error;
  }
}

export async function updateContent(id: number, input: Partial<CreateContentInput>): Promise<Content> {
  try {
    // Check if content exists
    const existingContent = await db.select()
      .from(contentTable)
      .where(eq(contentTable.id, id))
      .limit(1)
      .execute();

    if (existingContent.length === 0) {
      throw new Error('Content not found');
    }

    // Validate membership level exists if provided
    if (input.required_membership_level_id) {
      const membershipLevel = await db.select()
        .from(membershipLevelsTable)
        .where(eq(membershipLevelsTable.id, input.required_membership_level_id))
        .limit(1)
        .execute();

      if (membershipLevel.length === 0) {
        throw new Error('Membership level not found');
      }
    }

    const updateData: any = {
      updated_at: new Date()
    };

    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.content_type !== undefined) updateData.content_type = input.content_type;
    if (input.content_url !== undefined) updateData.content_url = input.content_url;
    if (input.content_body !== undefined) updateData.content_body = input.content_body;
    if (input.required_membership_level_id !== undefined) updateData.required_membership_level_id = input.required_membership_level_id;
    if (input.is_published !== undefined) updateData.is_published = input.is_published;

    const result = await db.update(contentTable)
      .set(updateData)
      .where(eq(contentTable.id, id))
      .returning()
      .execute();

    const content = result[0];
    return content;
  } catch (error) {
    console.error('Content update failed:', error);
    throw error;
  }
}

export async function deleteContent(id: number): Promise<void> {
  try {
    const result = await db.delete(contentTable)
      .where(eq(contentTable.id, id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Content not found');
    }
  } catch (error) {
    console.error('Content deletion failed:', error);
    throw error;
  }
}
