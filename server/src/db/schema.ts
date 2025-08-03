
import { serial, text, pgTable, timestamp, numeric, integer, boolean, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const contentTypeEnum = pgEnum('content_type', ['article', 'video', 'course', 'download']);
export const commissionStatusEnum = pgEnum('commission_status', ['pending', 'approved', 'paid', 'cancelled']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'cancelled', 'expired', 'pending']);
export const payoutStatusEnum = pgEnum('payout_status', ['pending', 'processing', 'completed', 'failed']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  phone: text('phone'),
  avatar_url: text('avatar_url'),
  is_active: boolean('is_active').notNull().default(true),
  is_admin: boolean('is_admin').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Membership levels table
export const membershipLevelsTable = pgTable('membership_levels', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  duration_days: integer('duration_days').notNull(),
  features: jsonb('features').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// User memberships table
export const userMembershipsTable = pgTable('user_memberships', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  membership_level_id: integer('membership_level_id').notNull(),
  start_date: timestamp('start_date').notNull(),
  end_date: timestamp('end_date').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Content table
export const contentTable = pgTable('content', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  content_type: contentTypeEnum('content_type').notNull(),
  content_url: text('content_url'),
  content_body: text('content_body'),
  required_membership_level_id: integer('required_membership_level_id'),
  is_published: boolean('is_published').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Affiliates table
export const affiliatesTable = pgTable('affiliates', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  affiliate_code: text('affiliate_code').notNull().unique(),
  commission_rate: numeric('commission_rate', { precision: 5, scale: 4 }).notNull(),
  total_earnings: numeric('total_earnings', { precision: 10, scale: 2 }).notNull().default('0'),
  total_referrals: integer('total_referrals').notNull().default(0),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Affiliate referrals table
export const affiliateReferralsTable = pgTable('affiliate_referrals', {
  id: serial('id').primaryKey(),
  affiliate_id: integer('affiliate_id').notNull(),
  referred_user_id: integer('referred_user_id').notNull(),
  membership_purchase_id: integer('membership_purchase_id'),
  commission_amount: numeric('commission_amount', { precision: 10, scale: 2 }).notNull(),
  commission_status: commissionStatusEnum('commission_status').notNull().default('pending'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Subscriptions table
export const subscriptionsTable = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  membership_level_id: integer('membership_level_id').notNull(),
  stripe_subscription_id: text('stripe_subscription_id'),
  status: subscriptionStatusEnum('status').notNull().default('pending'),
  current_period_start: timestamp('current_period_start').notNull(),
  current_period_end: timestamp('current_period_end').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('USD'),
  affiliate_id: integer('affiliate_id'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Affiliate payouts table
export const affiliatePayoutsTable = pgTable('affiliate_payouts', {
  id: serial('id').primaryKey(),
  affiliate_id: integer('affiliate_id').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  status: payoutStatusEnum('status').notNull().default('pending'),
  payout_method: text('payout_method').notNull(),
  payout_details: text('payout_details'),
  processed_at: timestamp('processed_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(usersTable, ({ many, one }) => ({
  memberships: many(userMembershipsTable),
  affiliate: one(affiliatesTable),
  subscriptions: many(subscriptionsTable),
}));

export const membershipLevelsRelations = relations(membershipLevelsTable, ({ many }) => ({
  userMemberships: many(userMembershipsTable),
  content: many(contentTable),
  subscriptions: many(subscriptionsTable),
}));

export const userMembershipsRelations = relations(userMembershipsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [userMembershipsTable.user_id],
    references: [usersTable.id],
  }),
  membershipLevel: one(membershipLevelsTable, {
    fields: [userMembershipsTable.membership_level_id],
    references: [membershipLevelsTable.id],
  }),
}));

export const contentRelations = relations(contentTable, ({ one }) => ({
  requiredMembershipLevel: one(membershipLevelsTable, {
    fields: [contentTable.required_membership_level_id],
    references: [membershipLevelsTable.id],
  }),
}));

export const affiliatesRelations = relations(affiliatesTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [affiliatesTable.user_id],
    references: [usersTable.id],
  }),
  referrals: many(affiliateReferralsTable),
  payouts: many(affiliatePayoutsTable),
  subscriptions: many(subscriptionsTable),
}));

export const affiliateReferralsRelations = relations(affiliateReferralsTable, ({ one }) => ({
  affiliate: one(affiliatesTable, {
    fields: [affiliateReferralsTable.affiliate_id],
    references: [affiliatesTable.id],
  }),
  referredUser: one(usersTable, {
    fields: [affiliateReferralsTable.referred_user_id],
    references: [usersTable.id],
  }),
  subscription: one(subscriptionsTable, {
    fields: [affiliateReferralsTable.membership_purchase_id],
    references: [subscriptionsTable.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptionsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [subscriptionsTable.user_id],
    references: [usersTable.id],
  }),
  membershipLevel: one(membershipLevelsTable, {
    fields: [subscriptionsTable.membership_level_id],
    references: [membershipLevelsTable.id],
  }),
  affiliate: one(affiliatesTable, {
    fields: [subscriptionsTable.affiliate_id],
    references: [affiliatesTable.id],
  }),
  referrals: many(affiliateReferralsTable),
}));

export const affiliatePayoutsRelations = relations(affiliatePayoutsTable, ({ one }) => ({
  affiliate: one(affiliatesTable, {
    fields: [affiliatePayoutsTable.affiliate_id],
    references: [affiliatesTable.id],
  }),
}));

// Export all tables for relation queries
export const tables = {
  users: usersTable,
  membershipLevels: membershipLevelsTable,
  userMemberships: userMembershipsTable,
  content: contentTable,
  affiliates: affiliatesTable,
  affiliateReferrals: affiliateReferralsTable,
  subscriptions: subscriptionsTable,
  affiliatePayouts: affiliatePayoutsTable,
};
