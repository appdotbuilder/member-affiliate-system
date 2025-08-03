
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type UpdateUserInput } from '../schema';
import { getUsers, getUserById, updateUser, deactivateUser } from '../handlers/users';
import { eq } from 'drizzle-orm';

// Test user data
const testUserData = {
  email: 'test@example.com',
  password_hash: 'hashed_password_123',
  first_name: 'John',
  last_name: 'Doe',
  phone: '+1234567890',
  avatar_url: 'https://example.com/avatar.jpg',
  is_active: true,
  is_admin: false
};

const testUserData2 = {
  email: 'test2@example.com',
  password_hash: 'hashed_password_456',
  first_name: 'Jane',
  last_name: 'Smith',
  phone: null,
  avatar_url: null,
  is_active: true,
  is_admin: true
};

describe('User handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getUsers', () => {
    it('should return empty array when no users exist', async () => {
      const users = await getUsers();
      expect(users).toEqual([]);
    });

    it('should return all users', async () => {
      // Create test users
      await db.insert(usersTable).values([testUserData, testUserData2]).execute();

      const users = await getUsers();

      expect(users).toHaveLength(2);
      expect(users[0].email).toEqual('test@example.com');
      expect(users[0].first_name).toEqual('John');
      expect(users[0].last_name).toEqual('Doe');
      expect(users[0].phone).toEqual('+1234567890');
      expect(users[0].is_active).toBe(true);
      expect(users[0].is_admin).toBe(false);
      expect(users[0].created_at).toBeInstanceOf(Date);
      expect(users[0].updated_at).toBeInstanceOf(Date);

      expect(users[1].email).toEqual('test2@example.com');
      expect(users[1].first_name).toEqual('Jane');
      expect(users[1].last_name).toEqual('Smith');
      expect(users[1].phone).toBeNull();
      expect(users[1].avatar_url).toBeNull();
      expect(users[1].is_admin).toBe(true);
    });
  });

  describe('getUserById', () => {
    it('should return null when user does not exist', async () => {
      const user = await getUserById(999);
      expect(user).toBeNull();
    });

    it('should return user when found', async () => {
      // Create test user
      const insertedUsers = await db.insert(usersTable)
        .values(testUserData)
        .returning()
        .execute();

      const userId = insertedUsers[0].id;
      const user = await getUserById(userId);

      expect(user).not.toBeNull();
      expect(user!.id).toEqual(userId);
      expect(user!.email).toEqual('test@example.com');
      expect(user!.first_name).toEqual('John');
      expect(user!.last_name).toEqual('Doe');
      expect(user!.phone).toEqual('+1234567890');
      expect(user!.avatar_url).toEqual('https://example.com/avatar.jpg');
      expect(user!.is_active).toBe(true);
      expect(user!.is_admin).toBe(false);
      expect(user!.created_at).toBeInstanceOf(Date);
      expect(user!.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('updateUser', () => {
    it('should throw error when user does not exist', async () => {
      const updateInput: UpdateUserInput = {
        id: 999,
        first_name: 'Updated'
      };

      await expect(updateUser(updateInput)).rejects.toThrow(/user not found/i);
    });

    it('should update user with provided fields only', async () => {
      // Create test user
      const insertedUsers = await db.insert(usersTable)
        .values(testUserData)
        .returning()
        .execute();

      const userId = insertedUsers[0].id;
      const updateInput: UpdateUserInput = {
        id: userId,
        first_name: 'UpdatedJohn',
        phone: '+9876543210'
      };

      const updatedUser = await updateUser(updateInput);

      expect(updatedUser.id).toEqual(userId);
      expect(updatedUser.first_name).toEqual('UpdatedJohn');
      expect(updatedUser.last_name).toEqual('Doe'); // Unchanged
      expect(updatedUser.phone).toEqual('+9876543210');
      expect(updatedUser.avatar_url).toEqual('https://example.com/avatar.jpg'); // Unchanged
      expect(updatedUser.email).toEqual('test@example.com'); // Unchanged
      expect(updatedUser.is_active).toBe(true); // Unchanged
      expect(updatedUser.updated_at).toBeInstanceOf(Date);
    });

    it('should update nullable fields to null', async () => {
      // Create test user
      const insertedUsers = await db.insert(usersTable)
        .values(testUserData)
        .returning()
        .execute();

      const userId = insertedUsers[0].id;
      const updateInput: UpdateUserInput = {
        id: userId,
        phone: null,
        avatar_url: null
      };

      const updatedUser = await updateUser(updateInput);

      expect(updatedUser.phone).toBeNull();
      expect(updatedUser.avatar_url).toBeNull();
      expect(updatedUser.first_name).toEqual('John'); // Unchanged
      expect(updatedUser.last_name).toEqual('Doe'); // Unchanged
    });

    it('should save updated user to database', async () => {
      // Create test user
      const insertedUsers = await db.insert(usersTable)
        .values(testUserData)
        .returning()
        .execute();

      const userId = insertedUsers[0].id;
      const updateInput: UpdateUserInput = {
        id: userId,
        first_name: 'DatabaseTest',
        last_name: 'Updated'
      };

      await updateUser(updateInput);

      // Verify in database
      const dbUsers = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .execute();

      expect(dbUsers).toHaveLength(1);
      expect(dbUsers[0].first_name).toEqual('DatabaseTest');
      expect(dbUsers[0].last_name).toEqual('Updated');
      expect(dbUsers[0].updated_at).toBeInstanceOf(Date);
    });
  });

  describe('deactivateUser', () => {
    it('should throw error when user does not exist', async () => {
      await expect(deactivateUser(999)).rejects.toThrow(/user not found/i);
    });

    it('should deactivate active user', async () => {
      // Create test user
      const insertedUsers = await db.insert(usersTable)
        .values(testUserData)
        .returning()
        .execute();

      const userId = insertedUsers[0].id;

      // Verify user is initially active
      expect(insertedUsers[0].is_active).toBe(true);

      await deactivateUser(userId);

      // Verify user is deactivated in database
      const dbUsers = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .execute();

      expect(dbUsers).toHaveLength(1);
      expect(dbUsers[0].is_active).toBe(false);
      expect(dbUsers[0].updated_at).toBeInstanceOf(Date);
    });

    it('should deactivate already inactive user without error', async () => {
      // Create inactive test user
      const inactiveUserData = {
        ...testUserData,
        is_active: false
      };

      const insertedUsers = await db.insert(usersTable)
        .values(inactiveUserData)
        .returning()
        .execute();

      const userId = insertedUsers[0].id;

      await deactivateUser(userId);

      // Verify user remains inactive
      const dbUsers = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .execute();

      expect(dbUsers).toHaveLength(1);
      expect(dbUsers[0].is_active).toBe(false);
    });
  });
});
