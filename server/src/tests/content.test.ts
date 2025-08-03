
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { contentTable, usersTable, membershipLevelsTable, userMembershipsTable } from '../db/schema';
import { type CreateContentInput } from '../schema';
import { getContent, getContentById, createContent, updateContent, deleteContent } from '../handlers/content';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashed_password',
  first_name: 'Test',
  last_name: 'User'
};

const testMembershipLevel = {
  name: 'Premium',
  description: 'Premium membership',
  price: '29.99',
  duration_days: 30,
  features: JSON.stringify(['feature1', 'feature2'])
};

const testContentInput: CreateContentInput = {
  title: 'Test Article',
  description: 'A test article',
  content_type: 'article',
  content_body: 'This is test content',
  is_published: true
};

describe('content handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createContent', () => {
    it('should create content successfully', async () => {
      const result = await createContent(testContentInput);

      expect(result.title).toEqual('Test Article');
      expect(result.description).toEqual('A test article');
      expect(result.content_type).toEqual('article');
      expect(result.content_body).toEqual('This is test content');
      expect(result.content_url).toBeNull();
      expect(result.required_membership_level_id).toBeNull();
      expect(result.is_published).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save content to database', async () => {
      const result = await createContent(testContentInput);

      const content = await db.select()
        .from(contentTable)
        .where(eq(contentTable.id, result.id))
        .execute();

      expect(content).toHaveLength(1);
      expect(content[0].title).toEqual('Test Article');
      expect(content[0].is_published).toBe(true);
    });

    it('should create content with membership requirement', async () => {
      // Create membership level first
      const membershipResult = await db.insert(membershipLevelsTable)
        .values(testMembershipLevel)
        .returning()
        .execute();

      const contentWithMembership = {
        ...testContentInput,
        required_membership_level_id: membershipResult[0].id
      };

      const result = await createContent(contentWithMembership);

      expect(result.required_membership_level_id).toEqual(membershipResult[0].id);
    });

    it('should throw error for invalid membership level', async () => {
      const contentWithInvalidMembership = {
        ...testContentInput,
        required_membership_level_id: 999
      };

      await expect(createContent(contentWithInvalidMembership)).rejects.toThrow(/membership level not found/i);
    });
  });

  describe('getContent', () => {
    let membershipLevelId: number;

    beforeEach(async () => {
      // Create membership level first
      const membershipResult = await db.insert(membershipLevelsTable)
        .values(testMembershipLevel)
        .returning()
        .execute();
      membershipLevelId = membershipResult[0].id;

      // Create test data
      await db.insert(contentTable).values({
        title: 'Public Content',
        content_type: 'article',
        content_body: 'Public content body',
        is_published: true
      }).execute();

      await db.insert(contentTable).values({
        title: 'Premium Content',
        content_type: 'video',
        content_url: 'https://example.com/video.mp4',
        required_membership_level_id: membershipLevelId,
        is_published: true
      }).execute();

      // Create unpublished content
      await db.insert(contentTable).values({
        title: 'Draft Content',
        content_type: 'article',
        content_body: 'Draft content body',
        is_published: false
      }).execute();
    });

    it('should return only public content for anonymous users', async () => {
      const results = await getContent();

      expect(results).toHaveLength(1);
      expect(results[0].title).toEqual('Public Content');
      expect(results[0].required_membership_level_id).toBeNull();
    });

    it('should return public and premium content for users with membership', async () => {
      // Create user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      // Create user membership
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      await db.insert(userMembershipsTable).values({
        user_id: userResult[0].id,
        membership_level_id: membershipLevelId,
        start_date: new Date(),
        end_date: futureDate,
        is_active: true
      }).execute();

      const results = await getContent(userResult[0].id);

      expect(results).toHaveLength(2);
      const titles = results.map(c => c.title);
      expect(titles).toContain('Public Content');
      expect(titles).toContain('Premium Content');
    });

    it('should exclude expired membership content', async () => {
      // Create user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      // Create expired user membership
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await db.insert(userMembershipsTable).values({
        user_id: userResult[0].id,
        membership_level_id: membershipLevelId,
        start_date: pastDate,
        end_date: pastDate,
        is_active: true
      }).execute();

      const results = await getContent(userResult[0].id);

      expect(results).toHaveLength(1);
      expect(results[0].title).toEqual('Public Content');
    });

    it('should exclude unpublished content', async () => {
      const results = await getContent();

      // Should only get published content
      expect(results).toHaveLength(1);
      expect(results[0].title).toEqual('Public Content');
      expect(results[0].is_published).toBe(true);
    });
  });

  describe('getContentById', () => {
    let contentId: number;
    let premiumContentId: number;
    let membershipLevelId: number;

    beforeEach(async () => {
      // Create membership level
      const membershipResult = await db.insert(membershipLevelsTable)
        .values(testMembershipLevel)
        .returning()
        .execute();
      membershipLevelId = membershipResult[0].id;

      // Create public content
      const publicResult = await db.insert(contentTable).values({
        title: 'Public Content',
        content_type: 'article',
        content_body: 'Public content body',
        is_published: true
      }).returning().execute();
      contentId = publicResult[0].id;

      // Create premium content
      const premiumResult = await db.insert(contentTable).values({
        title: 'Premium Content',
        content_type: 'video',
        required_membership_level_id: membershipLevelId,
        is_published: true
      }).returning().execute();
      premiumContentId = premiumResult[0].id;
    });

    it('should return public content for anonymous users', async () => {
      const result = await getContentById(contentId);

      expect(result).toBeDefined();
      expect(result!.title).toEqual('Public Content');
    });

    it('should return null for premium content without user', async () => {
      const result = await getContentById(premiumContentId);

      expect(result).toBeNull();
    });

    it('should return premium content for users with valid membership', async () => {
      // Create user with membership
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      await db.insert(userMembershipsTable).values({
        user_id: userResult[0].id,
        membership_level_id: membershipLevelId,
        start_date: new Date(),
        end_date: futureDate,
        is_active: true
      }).execute();

      const result = await getContentById(premiumContentId, userResult[0].id);

      expect(result).toBeDefined();
      expect(result!.title).toEqual('Premium Content');
    });

    it('should return null for non-existent content', async () => {
      const result = await getContentById(999);

      expect(result).toBeNull();
    });

    it('should return null for unpublished content', async () => {
      // Create unpublished content
      const unpublishedResult = await db.insert(contentTable).values({
        title: 'Unpublished Content',
        content_type: 'article',
        is_published: false
      }).returning().execute();

      const result = await getContentById(unpublishedResult[0].id);

      expect(result).toBeNull();
    });
  });

  describe('updateContent', () => {
    let contentId: number;
    let membershipLevelId: number;

    beforeEach(async () => {
      // Create membership level for tests that need it
      const membershipResult = await db.insert(membershipLevelsTable)
        .values(testMembershipLevel)
        .returning()
        .execute();
      membershipLevelId = membershipResult[0].id;

      const result = await createContent(testContentInput);
      contentId = result.id;
    });

    it('should update content successfully', async () => {
      const updateData = {
        title: 'Updated Title',
        description: 'Updated description'
      };

      const result = await updateContent(contentId, updateData);

      expect(result.title).toEqual('Updated Title');
      expect(result.description).toEqual('Updated description');
      expect(result.content_type).toEqual('article'); // Should preserve original
    });

    it('should update content in database', async () => {
      const updateData = {
        title: 'Updated Title'
      };

      await updateContent(contentId, updateData);

      const content = await db.select()
        .from(contentTable)
        .where(eq(contentTable.id, contentId))
        .execute();

      expect(content[0].title).toEqual('Updated Title');
    });

    it('should throw error for non-existent content', async () => {
      await expect(updateContent(999, { title: 'Test' })).rejects.toThrow(/content not found/i);
    });

    it('should validate membership level on update', async () => {
      const updateData = {
        required_membership_level_id: 999
      };

      await expect(updateContent(contentId, updateData)).rejects.toThrow(/membership level not found/i);
    });

    it('should allow setting membership level to null', async () => {
      // First create content with membership requirement
      const contentWithMembership = await createContent({
        ...testContentInput,
        title: 'Content with membership',
        required_membership_level_id: membershipLevelId
      });

      // Then remove the membership requirement
      const result = await updateContent(contentWithMembership.id, {
        required_membership_level_id: null
      });

      expect(result.required_membership_level_id).toBeNull();
    });
  });

  describe('deleteContent', () => {
    let contentId: number;

    beforeEach(async () => {
      const result = await createContent(testContentInput);
      contentId = result.id;
    });

    it('should delete content successfully', async () => {
      await deleteContent(contentId);

      const content = await db.select()
        .from(contentTable)
        .where(eq(contentTable.id, contentId))
        .execute();

      expect(content).toHaveLength(0);
    });

    it('should throw error for non-existent content', async () => {
      await expect(deleteContent(999)).rejects.toThrow(/content not found/i);
    });
  });
});
