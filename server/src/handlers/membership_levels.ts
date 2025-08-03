
import { db } from '../db';
import { membershipLevelsTable } from '../db/schema';
import { type CreateMembershipLevelInput, type MembershipLevel } from '../schema';
import { eq } from 'drizzle-orm';

export const getMembershipLevels = async (): Promise<MembershipLevel[]> => {
  try {
    const results = await db.select()
      .from(membershipLevelsTable)
      .execute();

    return results.map(level => ({
      ...level,
      price: parseFloat(level.price), // Convert numeric to number
      features: level.features as string[] // Cast jsonb to string array
    }));
  } catch (error) {
    console.error('Failed to fetch membership levels:', error);
    throw error;
  }
};

export const getMembershipLevelById = async (id: number): Promise<MembershipLevel | null> => {
  try {
    const results = await db.select()
      .from(membershipLevelsTable)
      .where(eq(membershipLevelsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const level = results[0];
    return {
      ...level,
      price: parseFloat(level.price), // Convert numeric to number
      features: level.features as string[] // Cast jsonb to string array
    };
  } catch (error) {
    console.error('Failed to fetch membership level by ID:', error);
    throw error;
  }
};

export const createMembershipLevel = async (input: CreateMembershipLevelInput): Promise<MembershipLevel> => {
  try {
    const results = await db.insert(membershipLevelsTable)
      .values({
        name: input.name,
        description: input.description || null,
        price: input.price.toString(), // Convert number to string for numeric column
        duration_days: input.duration_days,
        features: input.features, // jsonb handles array directly
        is_active: input.is_active ?? true
      })
      .returning()
      .execute();

    const level = results[0];
    return {
      ...level,
      price: parseFloat(level.price), // Convert numeric back to number
      features: level.features as string[] // Cast jsonb to string array
    };
  } catch (error) {
    console.error('Failed to create membership level:', error);
    throw error;
  }
};

export const updateMembershipLevel = async (id: number, input: Partial<CreateMembershipLevelInput>): Promise<MembershipLevel> => {
  try {
    // Build update values object, only including provided fields
    const updateValues: any = {};
    
    if (input.name !== undefined) updateValues.name = input.name;
    if (input.description !== undefined) updateValues.description = input.description;
    if (input.price !== undefined) updateValues.price = input.price.toString(); // Convert to string
    if (input.duration_days !== undefined) updateValues.duration_days = input.duration_days;
    if (input.features !== undefined) updateValues.features = input.features;
    if (input.is_active !== undefined) updateValues.is_active = input.is_active;

    const results = await db.update(membershipLevelsTable)
      .set(updateValues)
      .where(eq(membershipLevelsTable.id, id))
      .returning()
      .execute();

    if (results.length === 0) {
      throw new Error(`Membership level with ID ${id} not found`);
    }

    const level = results[0];
    return {
      ...level,
      price: parseFloat(level.price), // Convert numeric back to number
      features: level.features as string[] // Cast jsonb to string array
    };
  } catch (error) {
    console.error('Failed to update membership level:', error);
    throw error;
  }
};
