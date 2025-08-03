
import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

// Import components
import { AuthSection } from '@/components/AuthSection';
import { MembershipSection } from '@/components/MembershipSection';
import { ContentSection } from '@/components/ContentSection';
import { AffiliateSection } from '@/components/AffiliateSection';
import { AdminDashboard } from '@/components/AdminDashboard';

// Import types
import type { User, AuthResponse } from '../../server/src/schema';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize app - check for stored auth
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('user_data');
    
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error('Failed to parse stored user data:', err);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
      }
    }
  }, []);

  const handleAuthSuccess = useCallback((authResponse: AuthResponse) => {
    setUser(authResponse.user);
    setToken(authResponse.token);
    setError(null);
    
    // Store auth data
    localStorage.setItem('auth_token', authResponse.token);
    localStorage.setItem('user_data', JSON.stringify(authResponse.user));
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
  }, []);

  // Show auth section if not logged in
  if (!user || !token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">🚀 MemberPro</h1>
            <p className="text-xl text-gray-600">Premium Membership & Affiliate Platform</p>
          </div>
          
          {error && (
            <div className="max-w-md mx-auto mb-6">
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            </div>
          )}

          <AuthSection 
            onAuthSuccess={handleAuthSuccess}
            onError={handleError}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900">🚀 MemberPro</h1>
              {user.is_admin && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                  Admin
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {user.first_name} {user.last_name}
                </p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Card */}
        <Card className="mb-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <CardHeader>
            <CardTitle className="text-2xl">
              Welcome back, {user.first_name}! 👋
            </CardTitle>
            <CardDescription className="text-blue-100">
              Manage your membership, access exclusive content, and grow your affiliate earnings.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* System Status Alert */}
        <Alert className="mb-6 border-yellow-200 bg-yellow-50">
          <AlertDescription className="text-yellow-800">
            <strong>Demo Mode:</strong> This system is running with stub backend implementations. 
            All data operations are simulated for demonstration purposes.
          </AlertDescription>
        </Alert>

        {/* Main Tabs */}
        <Tabs defaultValue={user.is_admin ? "admin" : "membership"} className="space-y-6">
          <TabsList className="grid grid-cols-2 lg:grid-cols-5 w-full">
            {user.is_admin && (
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <span>🏠</span> Admin
              </TabsTrigger>
            )}
            <TabsTrigger value="membership" className="flex items-center gap-2">
              <span>💎</span> Membership
            </TabsTrigger>
            <TabsTrigger value="content" className="flex items-center gap-2">
              <span>📚</span> Content
            </TabsTrigger>
            <TabsTrigger value="affiliate" className="flex items-center gap-2">
              <span>💰</span> Affiliate
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <span>👤</span> Profile
            </TabsTrigger>
          </TabsList>

          {/* Admin Dashboard */}
          {user.is_admin && (
            <TabsContent value="admin">
              <AdminDashboard />
            </TabsContent>
          )}

          {/* Membership Section */}
          <TabsContent value="membership">
            <MembershipSection userId={user.id} />
          </TabsContent>

          {/* Content Section */}
          <TabsContent value="content">
            <ContentSection userId={user.id} isAdmin={user.is_admin} />
          </TabsContent>

          {/* Affiliate Section */}
          <TabsContent value="affiliate">
            <AffiliateSection userId={user.id} />
          </TabsContent>

          {/* Profile Section */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>👤 Profile Settings</CardTitle>
                <CardDescription>
                  Manage your account information and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Account Information</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Name</label>
                        <p className="text-sm text-gray-900">
                          {user.first_name} {user.last_name}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Email</label>
                        <p className="text-sm text-gray-900">{user.email}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Phone</label>
                        <p className="text-sm text-gray-900">
                          {user.phone || 'Not provided'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Member Since</label>
                        <p className="text-sm text-gray-900">
                          {user.created_at.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Account Status</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Status</span>
                        <Badge variant={user.is_active ? "default" : "secondary"}>
                          {user.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Role</span>
                        <Badge variant={user.is_admin ? "secondary" : "outline"}>
                          {user.is_admin ? "Administrator" : "Member"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex gap-3">
                  <Button variant="outline">Edit Profile</Button>
                  <Button variant="outline">Change Password</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default App;
