
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';

import type { MembershipLevel, UserMembership, Subscription } from '../../../server/src/schema';

interface MembershipSectionProps {
  userId: number;
}

export function MembershipSection({ userId }: MembershipSectionProps) {
  const [membershipLevels, setMembershipLevels] = useState<MembershipLevel[]>([]);
  const [activeMembership, setActiveMembership] = useState<UserMembership | null>(null);
  const [activeSubscription, setActiveSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMembershipData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [levels, membership, subscription] = await Promise.all([
        trpc.getMembershipLevels.query(),
        trpc.getActiveMembership.query({ userId }),
        trpc.getActiveSubscription.query({ userId })
      ]);
      
      setMembershipLevels(levels);
      setActiveMembership(membership);
      setActiveSubscription(subscription);
      setError(null);
    } catch (err) {
      console.error('Failed to load membership data:', err);
      setError('Failed to load membership information');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadMembershipData();
  }, [loadMembershipData]);

  const handleUpgrade = async (membershipLevelId: number, price: number) => {
    setIsLoading(true);
    try {
      // Create subscription
      await trpc.createSubscription.mutate({
        user_id: userId,
        membership_level_id: membershipLevelId,
        amount: price,
        currency: 'USD'
      });

      // Create user membership
      await trpc.createUserMembership.mutate({
        user_id: userId,
        membership_level_id: membershipLevelId
      });

      await loadMembershipData();
      setError(null);
    } catch (err) {
      console.error('Failed to upgrade membership:', err);
      setError('Failed to upgrade membership. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!activeSubscription) return;
    
    setIsLoading(true);
    try {
      await trpc.cancelSubscription.mutate({
        subscriptionId: activeSubscription.id
      });
      await loadMembershipData();
      setError(null);
    } catch (err) {
      console.error('Failed to cancel subscription:', err);
      setError('Failed to cancel subscription. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getDaysRemaining = (endDate: Date): number => {
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getProgressPercentage = (startDate: Date, endDate: Date): number => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {/* Current Membership Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            💎 Current Membership Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeMembership ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Active Membership</h3>
                  <p className="text-sm text-gray-600">
                    Valid until {activeMembership.end_date.toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={activeMembership.is_active ? "default" : "secondary"}>
                  {activeMembership.is_active ? "Active" : "Expired"}
                </Badge>
              </div>
              
              {activeMembership.is_active && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Days remaining: {getDaysRemaining(activeMembership.end_date)}</span>
                    <span>{getProgressPercentage(activeMembership.start_date, activeMembership.end_date).toFixed(0)}% elapsed</span>
                  </div>
                  <Progress 
                    value={getProgressPercentage(activeMembership.start_date, activeMembership.end_date)} 
                    className="h-2"
                  />
                </div>
              )}

              {activeSubscription && (
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Subscription Details</h4>
                      <p className="text-sm text-gray-600">
                        ${activeSubscription.amount.toFixed(2)}/{activeSubscription.currency} 
                        • Status: {activeSubscription.status}
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleCancelSubscription}
                      disabled={isLoading || activeSubscription.status !== 'active'}
                    >
                      Cancel Subscription
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-lg font-semibold mb-2">No Active Membership</h3>
              <p className="text-gray-600 mb-4">
                Upgrade to a premium membership to unlock exclusive content and features!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Membership Levels */}
      <div>
        <h2 className="text-2xl font-bold mb-4">🎯 Membership Plans</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {membershipLevels.map((level: MembershipLevel) => (
            <Card key={level.id} className="relative">
              {level.name.toLowerCase().includes('premium') && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                    ⭐ Most Popular
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center">
                <CardTitle className="text-xl">{level.name}</CardTitle>
                <CardDescription>{level.description}</CardDescription>
                <div className="text-3xl font-bold text-blue-600">
                  ${level.price.toFixed(2)}
                  <span className="text-sm font-normal text-gray-500">
                    / {level.duration_days} days
                  </span>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Features:</h4>
                    <ul className="space-y-1">
                      {level.features.map((feature: string, index: number) => (
                        <li key={index} className="flex items-center gap-2 text-sm">
                          <span className="text-green-500">✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <Separator />
                  
                  <Button 
                    className="w-full"
                    onClick={() => handleUpgrade(level.id, level.price)}
                    disabled={isLoading || !level.is_active}
                    variant={level.name.toLowerCase().includes('premium') ? "default" : "outline"}
                  >
                    {isLoading ? 'Processing...' : 
                     activeMembership?.membership_level_id === level.id ? 'Current Plan' : 
                     `Upgrade to ${level.name}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {membershipLevels.length === 0 && !isLoading && (
          <Card>
            <CardContent className="text-center py-8">
              <div className="text-4xl mb-4">📝</div>
              <h3 className="text-lg font-semibold mb-2">No Membership Plans Available</h3>
              <p className="text-gray-600">
                Membership plans are being configured. Please check back later.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Benefits Section */}
      <Card>
        <CardHeader>
          <CardTitle>🌟 Membership Benefits</CardTitle>
          <CardDescription>
            See what you can unlock with our premium memberships
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="text-center">
              <div className="text-3xl mb-2">📚</div>
              <h3 className="font-semibold mb-2">Exclusive Content</h3>
              
              <p className="text-sm text-gray-600">
                Access premium articles, videos, courses, and downloads
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">💰</div>
              <h3 className="font-semibold mb-2">Affiliate Program</h3>
              <p className="text-sm text-gray-600">
                Earn commissions by referring new members to the platform
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🎯</div>
              <h3 className="font-semibold mb-2">Priority Support</h3>
              <p className="text-sm text-gray-600">
                Get priority customer support and exclusive member benefits
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
