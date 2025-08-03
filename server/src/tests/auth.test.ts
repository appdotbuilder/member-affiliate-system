
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type LoginInput } from '../schema';
import { registerUser, loginUser, getCurrentUser } from '../handlers/auth';
import { eq } from 'drizzle-orm';

const testUserInput: CreateUserInput = {
  email: 'test@example.com',
  password: 'password123',
  first_name: 'John',
  last_name: 'Doe',
  phone: '+1234567890'
};

const testLoginInput: LoginInput = {
  email: 'test@example.com',
  password: 'password123'
};

describe('Auth Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('registerUser', () => {
    it('should register a new user', async () => {
      const result = await registerUser(testUserInput);

      expect(result.email).toEqual('test@example.com');
      expect(result.first_name).toEqual('John');
      expect(result.last_name).toEqual('Doe');
      expect(result.phone).toEqual('+1234567890');
      expect(result.is_active).toBe(true);
      expect(result.is_admin).toBe(false);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
      expect(result.password_hash).toContain('hashed_');
    });

    it('should save user to database', async () => {
      const result = await registerUser(testUserInput);

      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, result.id))
        .execute();

      expect(users).toHaveLength(1);
      expect(users[0].email).toEqual('test@example.com');
      expect(users[0].first_name).toEqual('John');
      expect(users[0].password_hash).toContain('hashed_');
    });

    it('should handle missing phone number', async () => {
      const inputWithoutPhone: CreateUserInput = {
        email: 'nophone@example.com',
        password: 'password123',
        first_name: 'Jane',
        last_name: 'Smith'
      };

      const result = await registerUser(inputWithoutPhone);

      expect(result.phone).toBeNull();
      expect(result.email).toEqual('nophone@example.com');
    });

    it('should throw error for duplicate email', async () => {
      await registerUser(testUserInput);

      await expect(registerUser(testUserInput))
        .rejects.toThrow(/already exists/i);
    });
  });

  describe('loginUser', () => {
    beforeEach(async () => {
      await registerUser(testUserInput);
    });

    it('should login user with correct credentials', async () => {
      const result = await loginUser(testLoginInput);

      expect(result.user.email).toEqual('test@example.com');
      expect(result.user.first_name).toEqual('John');
      expect(result.user.is_active).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.token).toContain('token_');
    });

    it('should throw error for invalid email', async () => {
      const invalidInput: LoginInput = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      await expect(loginUser(invalidInput))
        .rejects.toThrow(/invalid email or password/i);
    });

    it('should throw error for invalid password', async () => {
      const invalidInput: LoginInput = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      await expect(loginUser(invalidInput))
        .rejects.toThrow(/invalid email or password/i);
    });

    it('should throw error for deactivated user', async () => {
      // Deactivate the user
      await db.update(usersTable)
        .set({ is_active: false })
        .where(eq(usersTable.email, testUserInput.email))
        .execute();

      await expect(loginUser(testLoginInput))
        .rejects.toThrow(/account is deactivated/i);
    });
  });

  describe('getCurrentUser', () => {
    let userId: number;

    beforeEach(async () => {
      const user = await registerUser(testUserInput);
      userId = user.id;
    });

    it('should get current user by ID', async () => {
      const result = await getCurrentUser(userId);

      expect(result.id).toEqual(userId);
      expect(result.email).toEqual('test@example.com');
      expect(result.first_name).toEqual('John');
      expect(result.last_name).toEqual('Doe');
      expect(result.is_active).toBe(true);
    });

    it('should throw error for non-existent user', async () => {
      await expect(getCurrentUser(99999))
        .rejects.toThrow(/user not found/i);
    });

    it('should throw error for deactivated user', async () => {
      // Deactivate the user
      await db.update(usersTable)
        .set({ is_active: false })
        .where(eq(usersTable.id, userId))
        .execute();

      await expect(getCurrentUser(userId))
        .rejects.toThrow(/account is deactivated/i);
    });
  });
});
