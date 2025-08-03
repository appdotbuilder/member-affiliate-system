
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/utils/trpc';

import type { Affiliate, AffiliateReferral, AffiliatePayout } from '../../../server/src/schema';
import type { AffiliateStats } from '../../../server/src/handlers/analytics';

interface AffiliateSectionProps {
  userId: number;
}

export function AffiliateSection({ userId }: AffiliateSectionProps) {
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [referrals, setReferrals] = useState<AffiliateReferral[]>([]);
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commissionRate, setCommissionRate] = useState<number>(0.1);

  const loadAffiliateData = useCallback(async () => {
    setIsLoading(true);
    try {
      const affiliateData = await trpc.getAffiliateByUserId.query({ userId });
      setAffiliate(affiliateData);

      if (affiliateData) {
        const [statsData, referralsData, payoutsData] = await Promise.all([
          trpc.getAffiliateStats.query({ affiliateId: affiliateData.id }),
          trpc.getAffiliateReferrals.query({ affiliateId: affiliateData.id }),
          trpc.getAffiliatePayouts.query({ affiliateId: affiliateData.id })
        ]);
        
        setStats(statsData);
        setReferrals(referralsData);
        setPayouts(payoutsData);
      }
      
      setError(null);
    } catch (err) {
      console.error('Failed to load affiliate data:', err);
      setError('Failed to load affiliate information');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadAffiliateData();
  }, [loadAffiliateData]);

  const handleBecomeAffiliate = async () => {
    setIsLoading(true);
    try {
      const newAffiliate = await trpc.createAffiliate.mutate({
        user_id: userId,
        commission_rate: commissionRate,
        is_active: true
      });
      
      setAffiliate(newAffiliate);
      await loadAffiliateData();
      setError(null);
    } catch (err) {
      console.error('Failed to become affiliate:', err);
      setError('Failed to register as affiliate. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!affiliate || !stats) return;
    
    setIsLoading(true);
    try {
      await trpc.createAffiliatePayout.mutate({
        affiliate_id: affiliate.id,
        amount: stats.pendingEarnings,
        payout_method: 'bank_transfer'
      });
      
      await loadAffiliateData();
      setError(null);
    } catch (err) {
      console.error('Failed to request payout:', err);
      setError('Failed to request payout. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyAffiliateLink = () => {
    if (!affiliate) return;
    
    const affiliateLink = `${window.location.origin}?ref=${affiliate.affiliate_code}`;
    navigator.clipboard.writeText(affiliateLink);
    // You could add a toast notification here
    alert('Affiliate link copied to clipboard!');
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'approved': case 'paid': case 'completed': return 'bg-green-100 text-green-700';
      case 'pending': case 'processing': return 'bg-yellow-100 text-yellow-700';
      case 'cancelled': case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (!affiliate) {
    return (
      <div className="space-y-6">
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        {/* Become Affiliate Section */}
        <Card className="bg-gradient-to-r from-green-50 to-blue-50">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">💰 Join Our Affiliate Program</CardTitle>
            <CardDescription>
              Earn commissions by referring new members to our platform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="text-center">
                <div className="text-3xl mb-2">🎯</div>
                <h3 className="font-semibold mb-2">Easy to Start</h3>
                <p className="text-sm text-gray-600">
                  Get your unique referral link and start earning immediately
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">💵</div>
                <h3 className="font-semibold mb-2">High Commissions</h3>
                <p className="text-sm text-gray-600">
                  Earn up to 10% commission on every successful referral
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">📊</div>
                <h3 className="font-semibold mb-2">Track Performance</h3>
                <p className="text-sm text-gray-600">
                  Monitor your earnings and referrals in real-time
                </p>
              </div>
            </div>

            <Separator />

            <div className="max-w-md mx-auto space-y-4">
              <div className="space-y-2">
                <Label htmlFor="commission-rate">Commission Rate</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="commission-rate"
                    type="number"
                    min="0.01"
                    max="0.5"
                    step="0.01"
                    value={commissionRate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCommissionRate(parseFloat(e.target.value) || 0.1)
                    }
                  />
                  <span className="text-sm text-gray-600">
                    ({(commissionRate * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
              
              <Button 
                onClick={handleBecomeAffiliate}
                disabled={isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? 'Registering...' : '🚀 Become an Affiliate'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {/* Affiliate Stats Overview */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <span className="text-2xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats?.totalEarnings.toFixed(2) || '0.00'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Earnings</CardTitle>
            <span className="text-2xl">⏳</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              ${stats?.pendingEarnings.toFixed(2) || '0.00'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <span className="text-2xl">👥</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalReferrals || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <span className="text-2xl">📈</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.conversionRate.toFixed(1) || '0.0'}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Affiliate Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔗 Your Affiliate Link
          </CardTitle>
          <CardDescription>
            Share this link to earn commissions on referrals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={`${window.location.origin}?ref=${affiliate.affiliate_code}`}
              readOnly
              className="font-mono text-sm"
            />
            <Button onClick={copyAffiliateLink}>
              Copy Link
            </Button>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-sm font-medium">Affiliate Code</Label>
              <p className="text-sm text-gray-900 font-mono">
                {affiliate.affiliate_code}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium">Commission Rate</Label>
              <p className="text-sm text-gray-900">
                {(affiliate.commission_rate * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Stats */}
      <Card>
        <CardHeader>
          <CardTitle>📊 Performance Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Monthly Progress</span>
                <span>${stats?.monthlyEarnings.toFixed(2) || '0.00'}</span>
              </div>
              <Progress value={((stats?.monthlyEarnings || 0) / 1000) * 100} className="h-2" />
              <p className="text-xs text-gray-500 mt-1">Goal: $1,000/month</p>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Clicks This Month</span>
                <span>{stats?.clicksThisMonth || 0}</span>
              </div>
              <Progress value={((stats?.clicksThisMonth || 0) / 100) * 100} className="h-2" />
              <p className="text-xs text-gray-500 mt-1">Goal: 100 clicks/month</p>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <div>
              <h4 className="font-medium">Ready for Payout</h4>
              <p className="text-sm text-gray-600">
                ${stats?.pendingEarnings.toFixed(2) || '0.00'} available
              </p>
            </div>
            <Button
              onClick={handleRequestPayout}
              disabled={isLoading || !stats?.pendingEarnings || stats.pendingEarnings < 10}
            >
              Request Payout
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Referrals */}
      <Card>
        <CardHeader>
          <CardTitle>👥 Recent Referrals</CardTitle>
          <CardDescription>
            Track your recent referral activity and commissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referrals.length > 0 ? (
            <div className="space-y-3">
              {referrals.slice(0, 5).map((referral: AffiliateReferral) => (
                <div key={referral.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Referral #{referral.id}</p>
                    <p className="text-sm text-gray-600">
                      {referral.created_at.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      ${referral.commission_amount.toFixed(2)}
                    </p>
                    <Badge className={getStatusColor(referral.commission_status)}>
                      {referral.commission_status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-lg font-semibold mb-2">No Referrals Yet</h3>
              <p className="text-gray-600">
                Start sharing your affiliate link to see referrals here!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle>💳 Payout History</CardTitle>
          <CardDescription>
            View your payout requests and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payouts.length > 0 ? (
            <div className="space-y-3">
              {payouts.map((payout: AffiliatePayout) => (
                <div key={payout.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">
                      ${payout.amount.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-600">
                      {payout.created_at.toLocaleDateString()} • {payout.payout_method}
                    </p>
                  </div>
                  <Badge className={getStatusColor(payout.status)}>
                    {payout.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">💳</div>
              <h3 className="text-lg font-semibold mb-2">No Payouts Yet</h3>
              <p className="text-gray-600">
                Your payout requests will appear here once you start earning!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
