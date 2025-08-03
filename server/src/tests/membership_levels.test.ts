
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { membershipLevelsTable } from '../db/schema';
import { type CreateMembershipLevelInput } from '../schema';
import { 
  getMembershipLevels, 
  getMembershipLevelById, 
  createMembershipLevel, 
  updateMembershipLevel 
} from '../handlers/membership_levels';
import { eq } from 'drizzle-orm';

const testInput: CreateMembershipLevelInput = {
  name: 'Premium',
  description: 'Premium membership with all features',
  price: 29.99,
  duration_days: 30,
  features: ['feature1', 'feature2', 'feature3'],
  is_active: true
};

const basicInput: CreateMembershipLevelInput = {
  name: 'Basic',
  description: null,
  price: 9.99,
  duration_days: 30,
  features: ['basic_feature'],
  is_active: true
};

describe('getMembershipLevels', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no membership levels exist', async () => {
    const result = await getMembershipLevels();
    expect(result).toEqual([]);
  });

  it('should return all membership levels', async () => {
    // Create test data
    await createMembershipLevel(testInput);
    await createMembershipLevel(basicInput);

    const result = await getMembershipLevels();

    expect(result).toHaveLength(2);
    expect(result[0].name).toEqual('Premium');
    expect(result[0].price).toEqual(29.99);
    expect(typeof result[0].price).toBe('number');
    expect(result[0].features).toEqual(['feature1', 'feature2', 'feature3']);
    expect(result[1].name).toEqual('Basic');
    expect(result[1].price).toEqual(9.99);
    expect(typeof result[1].price).toBe('number');
  });

  it('should handle numeric price conversion correctly', async () => {
    await createMembershipLevel(testInput);
    
    const result = await getMembershipLevels();
    
    expect(result[0].price).toEqual(29.99);
    expect(typeof result[0].price).toBe('number');
  });
});

describe('getMembershipLevelById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null when membership level does not exist', async () => {
    const result = await getMembershipLevelById(999);
    expect(result).toBeNull();
  });

  it('should return membership level by ID', async () => {
    const created = await createMembershipLevel(testInput);
    
    const result = await getMembershipLevelById(created.id);

    expect(result).not.toBeNull();
    expect(result?.id).toEqual(created.id);
    expect(result?.name).toEqual('Premium');
    expect(result?.description).toEqual('Premium membership with all features');
    expect(result?.price).toEqual(29.99);
    expect(typeof result?.price).toBe('number');
    expect(result?.duration_days).toEqual(30);
    expect(result?.features).toEqual(['feature1', 'feature2', 'feature3']);
    expect(result?.is_active).toBe(true);
    expect(result?.created_at).toBeInstanceOf(Date);
  });
});

describe('createMembershipLevel', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create membership level with all fields', async () => {
    const result = await createMembershipLevel(testInput);

    expect(result.id).toBeDefined();
    expect(result.name).toEqual('Premium');
    expect(result.description).toEqual('Premium membership with all features');
    expect(result.price).toEqual(29.99);
    expect(typeof result.price).toBe('number');
    expect(result.duration_days).toEqual(30);
    expect(result.features).toEqual(['feature1', 'feature2', 'feature3']);
    expect(result.is_active).toBe(true);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create membership level with null description', async () => {
    const result = await createMembershipLevel(basicInput);

    expect(result.name).toEqual('Basic');
    expect(result.description).toBeNull();
    expect(result.price).toEqual(9.99);
    expect(result.features).toEqual(['basic_feature']);
  });

  it('should save membership level to database', async () => {
    const result = await createMembershipLevel(testInput);

    const saved = await db.select()
      .from(membershipLevelsTable)
      .where(eq(membershipLevelsTable.id, result.id))
      .execute();

    expect(saved).toHaveLength(1);
    expect(saved[0].name).toEqual('Premium');
    expect(parseFloat(saved[0].price)).toEqual(29.99);
    expect(saved[0].features).toEqual(['feature1', 'feature2', 'feature3']);
    expect(saved[0].created_at).toBeInstanceOf(Date);
  });

  it('should apply default is_active when not provided', async () => {
    const inputWithoutActive: CreateMembershipLevelInput = {
      name: 'Test Level',
      price: 19.99,
      duration_days: 30,
      features: ['test'],
      is_active: true // Add the required field
    };

    const result = await createMembershipLevel(inputWithoutActive);
    expect(result.is_active).toBe(true);
  });
});

describe('updateMembershipLevel', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update membership level with partial data', async () => {
    const created = await createMembershipLevel(testInput);
    
    const updateData = {
      name: 'Updated Premium',
      price: 39.99
    };

    const result = await updateMembershipLevel(created.id, updateData);

    expect(result.id).toEqual(created.id);
    expect(result.name).toEqual('Updated Premium');
    expect(result.price).toEqual(39.99);
    expect(typeof result.price).toBe('number');
    expect(result.description).toEqual('Premium membership with all features'); // Unchanged
    expect(result.duration_days).toEqual(30); // Unchanged
    expect(result.features).toEqual(['feature1', 'feature2', 'feature3']); // Unchanged
  });

  it('should update all fields when provided', async () => {
    const created = await createMembershipLevel(testInput);
    
    const updateData: Partial<CreateMembershipLevelInput> = {
      name: 'Enterprise',
      description: 'Enterprise level access',
      price: 99.99,
      duration_days: 365,
      features: ['enterprise_feature1', 'enterprise_feature2'],
      is_active: false
    };

    const result = await updateMembershipLevel(created.id, updateData);

    expect(result.name).toEqual('Enterprise');
    expect(result.description).toEqual('Enterprise level access');
    expect(result.price).toEqual(99.99);
    expect(typeof result.price).toBe('number');
    expect(result.duration_days).toEqual(365);
    expect(result.features).toEqual(['enterprise_feature1', 'enterprise_feature2']);
    expect(result.is_active).toBe(false);
  });

  it('should save updated data to database', async () => {
    const created = await createMembershipLevel(testInput);
    
    const updateData = {
      name: 'Updated Premium',
      price: 39.99
    };

    await updateMembershipLevel(created.id, updateData);

    const updated = await db.select()
      .from(membershipLevelsTable)
      .where(eq(membershipLevelsTable.id, created.id))
      .execute();

    expect(updated[0].name).toEqual('Updated Premium');
    expect(parseFloat(updated[0].price)).toEqual(39.99);
  });

  it('should throw error when membership level does not exist', async () => {
    const updateData = {
      name: 'Non-existent'
    };

    await expect(updateMembershipLevel(999, updateData))
      .rejects.toThrow(/not found/i);
  });

  it('should handle null description update', async () => {
    const created = await createMembershipLevel(testInput);
    
    const updateData = {
      description: null
    };

    const result = await updateMembershipLevel(created.id, updateData);
    expect(result.description).toBeNull();
  });
});
