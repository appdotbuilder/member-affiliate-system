
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/utils/trpc';

import type { 
  User, 
  MembershipLevel, 
  CreateMembershipLevelInput,
  Affiliate,
  AffiliateReferral,
  AffiliatePayout
} from '../../../server/src/schema';
import type { DashboardStats } from '../../../server/src/handlers/analytics';

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [membershipLevels, setMembershipLevels] = useState<MembershipLevel[]>([]);
  const [pendingReferrals, setPendingReferrals] = useState<AffiliateReferral[]>([]);
  const [pendingPayouts, setPendingPayouts] = useState<AffiliatePayout[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateLevelDialogOpen, setIsCreateLevelDialogOpen] = useState(false);

  const [newMembershipLevel, setNewMembershipLevel] = useState<CreateMembershipLevelInput>({
    name: '',
    description: null,
    price: 0,
    duration_days: 30,
    features: [],
    is_active: true
  });

  const [newFeature, setNewFeature] = useState<string>('');

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        dashboardStats,
        allUsers,
        allAffiliates,
        levels,
        pendingRefs,
        pendingPays
      ] = await Promise.all([
        trpc.getDashboardStats.query(),
        trpc.getUsers.query(),
        trpc.getAffiliates.query(),
        trpc.getMembershipLevels.query(),
        trpc.getPendingReferrals.query(),
        trpc.getPendingPayouts.query()
      ]);

      setStats(dashboardStats);
      setUsers(allUsers);
      setAffiliates(allAffiliates);
      setMembershipLevels(levels);
      setPendingReferrals(pendingRefs);
      setPendingPayouts(pendingPays);
      setError(null);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleCreateMembershipLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMembershipLevel.name.trim()) {
      setError('Membership level name is required');
      return;
    }

    setIsLoading(true);
    try {
      const createdLevel = await trpc.createMembershipLevel.mutate(newMembershipLevel);
      setMembershipLevels((prev: MembershipLevel[]) => [createdLevel, ...prev]);
      setNewMembershipLevel({
        name: '',
        description: null,
        price: 0,
        duration_days: 30,
        features: [],
        is_active: true
      });
      setIsCreateLevelDialogOpen(false);
      setError(null);
    } catch (err) {
      console.error('Failed to create membership level:', err);
      setError('Failed to create membership level');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFeature = () => {
    if (newFeature.trim()) {
      setNewMembershipLevel((prev: CreateMembershipLevelInput) => ({
        ...prev,
        features: [...prev.features, newFeature.trim()]
      }));
      setNewFeature('');
    }
  };

  const handleRemoveFeature = (index: number) => {
    setNewMembershipLevel((prev: CreateMembershipLevelInput) => ({
      ...prev,
      features: prev.features.filter((_, i: number) => i !== index)
    }));
  };

  const handleApproveReferral = async (referralId: number) => {
    setIsLoading(true);
    try {
      await trpc.approveReferral.mutate({ referralId });
      setPendingReferrals((prev: AffiliateReferral[]) => 
        prev.filter((r: AffiliateReferral) => r.id !== referralId)
      );
      await loadDashboardData();
      setError(null);
    } catch (err) {
      console.error('Failed to approve referral:', err);
      setError('Failed to approve referral');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessPayout = async (payoutId: number) => {
    setIsLoading(true);
    try {
      await trpc.processPayout.mutate({ payoutId });
      setPendingPayouts((prev: AffiliatePayout[]) => 
        prev.filter((p: AffiliatePayout) => p.id !== payoutId)
      );
      await loadDashboardData();
      setError(null);
    } catch (err) {
      console.error('Failed to process payout:', err);
      setError('Failed to process payout');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivateUser = async (userId: number) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;
    
    setIsLoading(true);
    try {
      await trpc.deactivateUser.mutate({ id: userId });
      setUsers((prev: User[]) => 
        prev.map((u: User) => u.id === userId ? { ...u, is_active: false } : u)
      );
      setError(null);
    } catch (err) {
      console.error('Failed to deactivate user:', err);
      setError('Failed to deactivate user');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">🏠 Admin Dashboard</h2>
          <p className="text-gray-600">
            Manage your membership platform and monitor performance
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <span className="text-2xl">👥</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <span className="text-2xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats?.totalRevenue.toFixed(2) || '0.00'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <span className="text-2xl">📊</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeSubscriptions || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <span className="text-2xl">⏳</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats?.pendingPayouts || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Tabs */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid grid-cols-2 lg:grid-cols-5 w-full">
          <TabsTrigger value="users">👥 Users</TabsTrigger>
          <TabsTrigger value="memberships">💎 Memberships</TabsTrigger>
          <TabsTrigger value="affiliates">💰 Affiliates</TabsTrigger>
          <TabsTrigger value="referrals">🔗 Referrals</TabsTrigger>
          <TabsTrigger value="payouts">💳 Payouts</TabsTrigger>
        </TabsList>

        {/* Users Management */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Manage platform users and their accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.slice(0, 10).map((user: User) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {user.first_name[0]}{user.last_name[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                        <p className="text-xs text-gray-500">
                          Joined: {user.created_at.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={user.is_active ? 'default' : 'secondary'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {user.is_admin && (
                        <Badge variant="outline">Admin</Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeactivateUser(user.id)}
                        disabled={isLoading || !user.is_active}
                      >
                        Deactivate
                      </Button>
                    </div>
                  </div>
                ))}
                
                {users.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">👥</div>
                    <h3 className="text-lg font-semibold mb-2">No Users Found</h3>
                    <p className="text-gray-600">Users will appear here once they register</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Membership Levels */}
        <TabsContent value="memberships">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Membership Levels</h3>
                <p className="text-sm text-gray-600">Create and manage membership tiers</p>
              </div>
              <Dialog open={isCreateLevelDialogOpen} onOpenChange={setIsCreateLevelDialogOpen}>
                <DialogTrigger asChild>
                  <Button>+ Create Level</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Membership Level</DialogTitle>
                    <DialogDescription>
                      Define a new membership tier with pricing and features
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateMembershipLevel} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="level-name">Name</Label>
                        <Input
                          id="level-name"
                          value={newMembershipLevel.name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewMembershipLevel((prev: CreateMembershipLevelInput) => ({ 
                              ...prev, 
                              name: e.target.value 
                            }))
                          }
                          placeholder="Premium Plan"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="level-price">Price ($)</Label>
                        <Input
                          id="level-price"
                          type="number"
                          min="0"
                          step="0.01"
                          value={newMembershipLevel.price}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewMembershipLevel((prev: CreateMembershipLevelInput) => ({ 
                              ...prev, 
                              price: parseFloat(e.target.value) || 0 
                            }))
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="duration">Duration (days)</Label>
                        <Input
                          id="duration"
                          type="number"
                          min="1"
                          value={newMembershipLevel.duration_days}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewMembershipLevel((prev: CreateMembershipLevelInput) => ({ 
                              ...prev, 
                              duration_days: parseInt(e.target.value) || 30 
                            }))
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select
                          value={newMembershipLevel.is_active ? 'active' : 'inactive'}
                          onValueChange={(value: string) =>
                            setNewMembershipLevel((prev: CreateMembershipLevelInput) => ({ 
                              ...prev, 
                              is_active: value === 'active' 
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={newMembershipLevel.description || ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setNewMembershipLevel((prev: CreateMembershipLevelInput) => ({ 
                            ...prev, 
                            description: e.target.value || null 
                          }))
                        }
                        placeholder="Describe this membership level"
                        rows={3}
                      />
                    </div>

                    {/* Features Management */}
                    <div className="space-y-2">
                      <Label>Features</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newFeature}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewFeature(e.target.value)
                          }
                          placeholder="Add a feature"
                          onKeyPress={(e: React.KeyboardEvent) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddFeature();
                            }
                          }}
                        />
                        <Button type="button" onClick={handleAddFeature}>
                          Add
                        </Button>
                      </div>
                      
                      {newMembershipLevel.features.length > 0 && (
                        <div className="space-y-1 mt-2">
                          {newMembershipLevel.features.map((feature: string, index: number) => (
                            <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                              <span className="text-sm">{feature}</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveFeature(index)}
                              >
                                ×
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? 'Creating...' : 'Create Level'}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsCreateLevelDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {membershipLevels.map((level: MembershipLevel) => (
                <Card key={level.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{level.name}</CardTitle>
                      <Badge variant={level.is_active ? 'default' : 'secondary'}>
                        {level.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <CardDescription>{level.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-2xl font-bold text-blue-600">
                        ${level.price.toFixed(2)}
                        <span className="text-sm font-normal text-gray-500">
                          / {level.duration_days} days
                        </span>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">Features:</h4>
                        <ul className="space-y-1">
                          {level.features.map((feature: string, index: number) => (
                            <li key={index} className="text-sm flex items-center gap-2">
                              <span className="text-green-500">✓</span>
                              {feature}
                            </li>
                
                          ))}
                        </ul>
                      </div>
                      
                      <div className="text-xs text-gray-500">
                        Created: {level.created_at.toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Affiliates */}
        <TabsContent value="affiliates">
          <Card>
            <CardHeader>
              <CardTitle>Affiliate Management</CardTitle>
              <CardDescription>Monitor affiliate performance and activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {affiliates.map((affiliate: Affiliate) => (
                  <div key={affiliate.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Affiliate #{affiliate.id}</p>
                      <p className="text-sm text-gray-600">
                        Code: {affiliate.affiliate_code}
                      </p>
                      <p className="text-sm text-gray-600">
                        Commission: {(affiliate.commission_rate * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        ${affiliate.total_earnings.toFixed(2)} earned
                      </p>
                      <p className="text-sm text-gray-600">
                        {affiliate.total_referrals} referrals
                      </p>
                      <Badge variant={affiliate.is_active ? 'default' : 'secondary'}>
                        {affiliate.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                ))}
                
                {affiliates.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">💰</div>
                    <h3 className="text-lg font-semibold mb-2">No Affiliates Yet</h3>
                    <p className="text-gray-600">Affiliates will appear here once they register</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Referrals */}
        <TabsContent value="referrals">
          <Card>
            <CardHeader>
              <CardTitle>Pending Referrals</CardTitle>
              <CardDescription>Review and approve affiliate referrals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingReferrals.map((referral: AffiliateReferral) => (
                  <div key={referral.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Referral #{referral.id}</p>
                      <p className="text-sm text-gray-600">
                        Affiliate: {referral.affiliate_id}
                      </p>
                      <p className="text-sm text-gray-600">
                        Created: {referral.created_at.toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-medium">
                          ${referral.commission_amount.toFixed(2)}
                        </p>
                        <Badge className="bg-yellow-100 text-yellow-700">
                          {referral.commission_status}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleApproveReferral(referral.id)}
                        disabled={isLoading}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
                
                {pendingReferrals.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">🔗</div>
                    <h3 className="text-lg font-semibold mb-2">No Pending Referrals</h3>
                    <p className="text-gray-600">Referral approvals will appear here</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Payouts */}
        <TabsContent value="payouts">
          <Card>
            <CardHeader>
              <CardTitle>Pending Payouts</CardTitle>
              <CardDescription>Process affiliate payout requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingPayouts.map((payout: AffiliatePayout) => (
                  <div key={payout.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Payout #{payout.id}</p>
                      <p className="text-sm text-gray-600">
                        Affiliate: {payout.affiliate_id}
                      </p>
                      <p className="text-sm text-gray-600">
                        Method: {payout.payout_method}
                      </p>
                      <p className="text-sm text-gray-600">
                        Requested: {payout.created_at.toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-medium">
                          ${payout.amount.toFixed(2)}
                        </p>
                        <Badge className="bg-yellow-100 text-yellow-700">
                          {payout.status}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleProcessPayout(payout.id)}
                        disabled={isLoading}
                      >
                        Process
                      </Button>
                    </div>
                  </div>
                ))}
                
                {pendingPayouts.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">💳</div>
                    <h3 className="text-lg font-semibold mb-2">No Pending Payouts</h3>
                    <p className="text-gray-600">Payout requests will appear here</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
