
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type User, type UpdateUserInput } from '../schema';
import { eq } from 'drizzle-orm';

export async function getUsers(): Promise<User[]> {
  try {
    const users = await db.select()
      .from(usersTable)
      .execute();

    return users;
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
}

export async function getUserById(id: number): Promise<User | null> {
  try {
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .execute();

    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error('Failed to fetch user by ID:', error);
    throw error;
  }
}

export async function updateUser(input: UpdateUserInput): Promise<User> {
  try {
    // Verify user exists before updating
    const existingUser = await getUserById(input.id);
    if (!existingUser) {
      throw new Error('User not found');
    }

    // Build update object with only provided fields
    const updateData: Partial<typeof usersTable.$inferInsert> = {
      updated_at: new Date()
    };

    if (input.first_name !== undefined) {
      updateData.first_name = input.first_name;
    }
    if (input.last_name !== undefined) {
      updateData.last_name = input.last_name;
    }
    if (input.phone !== undefined) {
      updateData.phone = input.phone;
    }
    if (input.avatar_url !== undefined) {
      updateData.avatar_url = input.avatar_url;
    }

    const updatedUsers = await db.update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, input.id))
      .returning()
      .execute();

    return updatedUsers[0];
  } catch (error) {
    console.error('Failed to update user:', error);
    throw error;
  }
}

export async function deactivateUser(id: number): Promise<void> {
  try {
    // Verify user exists before deactivating
    const existingUser = await getUserById(id);
    if (!existingUser) {
      throw new Error('User not found');
    }

    await db.update(usersTable)
      .set({
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, id))
      .execute();
  } catch (error) {
    console.error('Failed to deactivate user:', error);
    throw error;
  }
}
