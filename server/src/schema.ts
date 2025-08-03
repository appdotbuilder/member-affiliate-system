
import { z } from 'zod';

// User/Member schemas
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string().nullable(),
  avatar_url: z.string().nullable(),
  is_active: z.boolean(),
  is_admin: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

export const createUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().nullable().optional()
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const updateUserInputSchema = z.object({
  id: z.number(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

// Membership Level schemas
export const membershipLevelSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  duration_days: z.number().int(),
  features: z.array(z.string()),
  is_active: z.boolean(),
  created_at: z.coerce.date()
});

export type MembershipLevel = z.infer<typeof membershipLevelSchema>;

export const createMembershipLevelInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  price: z.number().nonnegative(),
  duration_days: z.number().int().positive(),
  features: z.array(z.string()),
  is_active: z.boolean().default(true)
});

export type CreateMembershipLevelInput = z.infer<typeof createMembershipLevelInputSchema>;

// User Membership schemas
export const userMembershipSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  membership_level_id: z.number(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  is_active: z.boolean(),
  created_at: z.coerce.date()
});

export type UserMembership = z.infer<typeof userMembershipSchema>;

export const createUserMembershipInputSchema = z.object({
  user_id: z.number(),
  membership_level_id: z.number(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional()
});

export type CreateUserMembershipInput = z.infer<typeof createUserMembershipInputSchema>;

// Content schemas
export const contentSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  content_type: z.enum(['article', 'video', 'course', 'download']),
  content_url: z.string().nullable(),
  content_body: z.string().nullable(),
  required_membership_level_id: z.number().nullable(),
  is_published: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Content = z.infer<typeof contentSchema>;

export const createContentInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  content_type: z.enum(['article', 'video', 'course', 'download']),
  content_url: z.string().nullable().optional(),
  content_body: z.string().nullable().optional(),
  required_membership_level_id: z.number().nullable().optional(),
  is_published: z.boolean().default(false)
});

export type CreateContentInput = z.infer<typeof createContentInputSchema>;

// Affiliate schemas
export const affiliateSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  affiliate_code: z.string(),
  commission_rate: z.number(),
  total_earnings: z.number(),
  total_referrals: z.number().int(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Affiliate = z.infer<typeof affiliateSchema>;

export const createAffiliateInputSchema = z.object({
  user_id: z.number(),
  commission_rate: z.number().min(0).max(1),
  is_active: z.boolean().default(true)
});

export type CreateAffiliateInput = z.infer<typeof createAffiliateInputSchema>;

// Affiliate Referral schemas
export const affiliateReferralSchema = z.object({
  id: z.number(),
  affiliate_id: z.number(),
  referred_user_id: z.number(),
  membership_purchase_id: z.number().nullable(),
  commission_amount: z.number(),
  commission_status: z.enum(['pending', 'approved', 'paid', 'cancelled']),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type AffiliateReferral = z.infer<typeof affiliateReferralSchema>;

export const createAffiliateReferralInputSchema = z.object({
  affiliate_id: z.number(),
  referred_user_id: z.number(),
  membership_purchase_id: z.number().nullable().optional(),
  commission_amount: z.number().nonnegative()
});

export type CreateAffiliateReferralInput = z.infer<typeof createAffiliateReferralInputSchema>;

// Payment/Subscription schemas
export const subscriptionSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  membership_level_id: z.number(),
  stripe_subscription_id: z.string().nullable(),
  status: z.enum(['active', 'cancelled', 'expired', 'pending']),
  current_period_start: z.coerce.date(),
  current_period_end: z.coerce.date(),
  amount: z.number(),
  currency: z.string(),
  affiliate_id: z.number().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Subscription = z.infer<typeof subscriptionSchema>;

export const createSubscriptionInputSchema = z.object({
  user_id: z.number(),
  membership_level_id: z.number(),
  stripe_subscription_id: z.string().nullable().optional(),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  affiliate_id: z.number().nullable().optional()
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionInputSchema>;

// Affiliate Payout schemas
export const affiliatePayoutSchema = z.object({
  id: z.number(),
  affiliate_id: z.number(),
  amount: z.number(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  payout_method: z.string(),
  payout_details: z.string().nullable(),
  processed_at: z.coerce.date().nullable(),
  created_at: z.coerce.date()
});

export type AffiliatePayout = z.infer<typeof affiliatePayoutSchema>;

export const createAffiliatePayoutInputSchema = z.object({
  affiliate_id: z.number(),
  amount: z.number().positive(),
  payout_method: z.string(),
  payout_details: z.string().nullable().optional()
});

export type CreateAffiliatePayoutInput = z.infer<typeof createAffiliatePayoutInputSchema>;

// Auth schemas
export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const authResponseSchema = z.object({
  user: userSchema,
  token: z.string()
});

export type AuthResponse = z.infer<typeof authResponseSchema>;
