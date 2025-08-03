
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import schemas
import {
  createUserInputSchema,
  loginInputSchema,
  updateUserInputSchema,
  createMembershipLevelInputSchema,
  createUserMembershipInputSchema,
  createContentInputSchema,
  createAffiliateInputSchema,
  createAffiliateReferralInputSchema,
  createSubscriptionInputSchema,
  createAffiliatePayoutInputSchema
} from './schema';

// Import handlers
import { registerUser, loginUser, getCurrentUser } from './handlers/auth';
import { getUsers, getUserById, updateUser, deactivateUser } from './handlers/users';
import { getMembershipLevels, getMembershipLevelById, createMembershipLevel, updateMembershipLevel } from './handlers/membership_levels';
import { getUserMemberships, createUserMembership, getActiveMembership, expireMembership } from './handlers/user_memberships';
import { getContent, getContentById, createContent, updateContent, deleteContent } from './handlers/content';
import { createAffiliate, getAffiliateByUserId, getAffiliateByCode, getAffiliates, updateAffiliateStats, deactivateAffiliate } from './handlers/affiliates';
import { createAffiliateReferral, getAffiliateReferrals, updateReferralStatus, getPendingReferrals, approveReferral } from './handlers/affiliate_referrals';
import { createSubscription, getUserSubscriptions, getActiveSubscription, cancelSubscription, updateSubscriptionStatus, renewSubscription } from './handlers/subscriptions';
import { createAffiliatePayout, getAffiliatePayouts, getPendingPayouts, processPayout, updatePayoutStatus, calculateAffiliateEarnings } from './handlers/affiliate_payouts';
import { getDashboardStats, getAffiliateStats, getRevenueByMonth, getTopAffiliates } from './handlers/analytics';
import { z } from 'zod';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Auth routes
  register: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => registerUser(input)),
  
  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => loginUser(input)),
  
  getCurrentUser: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getCurrentUser(input.userId)),

  // User management
  getUsers: publicProcedure
    .query(() => getUsers()),
  
  getUserById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getUserById(input.id)),
  
  updateUser: publicProcedure
    .input(updateUserInputSchema)
    .mutation(({ input }) => updateUser(input)),
  
  deactivateUser: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deactivateUser(input.id)),

  // Membership levels
  getMembershipLevels: publicProcedure
    .query(() => getMembershipLevels()),
  
  getMembershipLevelById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getMembershipLevelById(input.id)),
  
  createMembershipLevel: publicProcedure
    .input(createMembershipLevelInputSchema)
    .mutation(({ input }) => createMembershipLevel(input)),
  
  updateMembershipLevel: publicProcedure
    .input(z.object({ id: z.number() }).merge(createMembershipLevelInputSchema.partial()))
    .mutation(({ input }) => updateMembershipLevel(input.id, input)),

  // User memberships
  getUserMemberships: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getUserMemberships(input.userId)),
  
  createUserMembership: publicProcedure
    .input(createUserMembershipInputSchema)
    .mutation(({ input }) => createUserMembership(input)),
  
  getActiveMembership: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getActiveMembership(input.userId)),
  
  expireMembership: publicProcedure
    .input(z.object({ membershipId: z.number() }))
    .mutation(({ input }) => expireMembership(input.membershipId)),

  // Content management
  getContent: publicProcedure
    .input(z.object({ userId: z.number().optional() }))
    .query(({ input }) => getContent(input.userId)),
  
  getContentById: publicProcedure
    .input(z.object({ id: z.number(), userId: z.number().optional() }))
    .query(({ input }) => getContentById(input.id, input.userId)),
  
  createContent: publicProcedure
    .input(createContentInputSchema)
    .mutation(({ input }) => createContent(input)),
  
  updateContent: publicProcedure
    .input(z.object({ id: z.number() }).merge(createContentInputSchema.partial()))
    .mutation(({ input }) => updateContent(input.id, input)),
  
  deleteContent: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteContent(input.id)),

  // Affiliate management
  createAffiliate: publicProcedure
    .input(createAffiliateInputSchema)
    .mutation(({ input }) => createAffiliate(input)),
  
  getAffiliateByUserId: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getAffiliateByUserId(input.userId)),
  
  getAffiliateByCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(({ input }) => getAffiliateByCode(input.code)),
  
  getAffiliates: publicProcedure
    .query(() => getAffiliates()),
  
  updateAffiliateStats: publicProcedure
    .input(z.object({ affiliateId: z.number(), earnings: z.number(), referrals: z.number() }))
    .mutation(({ input }) => updateAffiliateStats(input.affiliateId, input.earnings, input.referrals)),
  
  deactivateAffiliate: publicProcedure
    .input(z.object({ affiliateId: z.number() }))
    .mutation(({ input }) => deactivateAffiliate(input.affiliateId)),

  // Affiliate referrals
  createAffiliateReferral: publicProcedure
    .input(createAffiliateReferralInputSchema)
    .mutation(({ input }) => createAffiliateReferral(input)),
  
  getAffiliateReferrals: publicProcedure
    .input(z.object({ affiliateId: z.number() }))
    .query(({ input }) => getAffiliateReferrals(input.affiliateId)),
  
  updateReferralStatus: publicProcedure
    .input(z.object({ 
      referralId: z.number(), 
      status: z.enum(['pending', 'approved', 'paid', 'cancelled']) 
    }))
    .mutation(({ input }) => updateReferralStatus(input.referralId, input.status)),
  
  getPendingReferrals: publicProcedure
    .query(() => getPendingReferrals()),
  
  approveReferral: publicProcedure
    .input(z.object({ referralId: z.number() }))
    .mutation(({ input }) => approveReferral(input.referralId)),

  // Subscriptions
  createSubscription: publicProcedure
    .input(createSubscriptionInputSchema)
    .mutation(({ input }) => createSubscription(input)),
  
  getUserSubscriptions: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getUserSubscriptions(input.userId)),
  
  getActiveSubscription: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getActiveSubscription(input.userId)),
  
  cancelSubscription: publicProcedure
    .input(z.object({ subscriptionId: z.number() }))
    .mutation(({ input }) => cancelSubscription(input.subscriptionId)),
  
  updateSubscriptionStatus: publicProcedure
    .input(z.object({ 
      subscriptionId: z.number(), 
      status: z.enum(['active', 'cancelled', 'expired', 'pending']) 
    }))
    .mutation(({ input }) => updateSubscriptionStatus(input.subscriptionId, input.status)),
  
  renewSubscription: publicProcedure
    .input(z.object({ subscriptionId: z.number() }))
    .mutation(({ input }) => renewSubscription(input.subscriptionId)),

  // Affiliate payouts
  createAffiliatePayout: publicProcedure
    .input(createAffiliatePayoutInputSchema)
    .mutation(({ input }) => createAffiliatePayout(input)),
  
  getAffiliatePayouts: publicProcedure
    .input(z.object({ affiliateId: z.number() }))
    .query(({ input }) => getAffiliatePayouts(input.affiliateId)),
  
  getPendingPayouts: publicProcedure
    .query(() => getPendingPayouts()),
  
  processPayout: publicProcedure
    .input(z.object({ payoutId: z.number() }))
    .mutation(({ input }) => processPayout(input.payoutId)),
  
  updatePayoutStatus: publicProcedure
    .input(z.object({ 
      payoutId: z.number(), 
      status: z.enum(['pending', 'processing', 'completed', 'failed']) 
    }))
    .mutation(({ input }) => updatePayoutStatus(input.payoutId, input.status)),
  
  calculateAffiliateEarnings: publicProcedure
    .input(z.object({ affiliateId: z.number() }))
    .query(({ input }) => calculateAffiliateEarnings(input.affiliateId)),

  // Analytics
  getDashboardStats: publicProcedure
    .query(() => getDashboardStats()),
  
  getAffiliateStats: publicProcedure
    .input(z.object({ affiliateId: z.number() }))
    .query(({ input }) => getAffiliateStats(input.affiliateId)),
  
  getRevenueByMonth: publicProcedure
    .input(z.object({ months: z.number().default(12) }))
    .query(({ input }) => getRevenueByMonth(input.months)),
  
  getTopAffiliates: publicProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(({ input }) => getTopAffiliates(input.limit)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();
