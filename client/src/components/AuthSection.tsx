
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/utils/trpc';

import type { CreateUserInput, LoginInput, AuthResponse } from '../../../server/src/schema';

interface AuthSectionProps {
  onAuthSuccess: (authResponse: AuthResponse) => void;
  onError: (error: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export function AuthSection({ onAuthSuccess, onError, isLoading, setIsLoading }: AuthSectionProps) {
  const [loginData, setLoginData] = useState<LoginInput>({
    email: '',
    password: ''
  });

  const [registerData, setRegisterData] = useState<CreateUserInput>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: null
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginData.email || !loginData.password) {
      onError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      const response = await trpc.login.mutate(loginData);
      onAuthSuccess(response);
    } catch (error) {
      console.error('Login failed:', error);
      onError('Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerData.email || !registerData.password || !registerData.first_name || !registerData.last_name) {
      onError('Please fill in all required fields');
      return;
    }

    if (registerData.password.length < 8) {
      onError('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);
    try {
      // First register the user
      await trpc.register.mutate(registerData);
      
      // Then automatically log them in
      const loginResponse = await trpc.login.mutate({
        email: registerData.email,
        password: registerData.password
      });
      
      onAuthSuccess(loginResponse);
    } catch (error) {
      console.error('Registration failed:', error);
      onError('Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (role: 'user' | 'admin') => {
    setIsLoading(true);
    try {
      // Demo credentials
      const demoCredentials = {
        email: role === 'admin' ? 'admin@demo.com' : 'user@demo.com',
        password: 'demo123456'
      };
      
      const response = await trpc.login.mutate(demoCredentials);
      onAuthSuccess(response);
    } catch (error) {
      console.error('Demo login failed:', error);
      onError('Demo login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <Tabs defaultValue="login" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Sign In</TabsTrigger>
          <TabsTrigger value="register">Sign Up</TabsTrigger>
        </TabsList>

        {/* Login Tab */}
        <TabsContent value="login">
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Welcome Back! 👋</CardTitle>
              <CardDescription>
                Sign in to access your membership dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="Enter your email"
                    value={loginData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setLoginData((prev: LoginInput) => ({ ...prev, email: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Enter your password"
                    value={loginData.password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setLoginData((prev: LoginInput) => ({ ...prev, password: e.target.value }))
                    }
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </Button>
              </form>

              <div className="mt-6 space-y-2">
                <div className="text-center text-sm text-gray-500 mb-3">
                  Or try demo accounts:
                </div>
                <div className="grid gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => handleDemoLogin('user')}
                    disabled={isLoading}
                    className="w-full"
                  >
                    🚀 Demo User Login
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleDemoLogin('admin')}
                    disabled={isLoading}
                    className="w-full"
                  >
                    👑 Demo Admin Login
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Register Tab */}
        <TabsContent value="register">
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Join MemberPro! 🎉</CardTitle>
              <CardDescription>
                Create your account and start your membership journey
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-first-name">First Name</Label>
                    <Input
                      id="register-first-name"
                      placeholder="John"
                      value={registerData.first_name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setRegisterData((prev: CreateUserInput) => ({ ...prev, first_name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-last-name">Last Name</Label>
                    <Input
                      id="register-last-name"
                      placeholder="Doe"
                      value={registerData.last_name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setRegisterData((prev: CreateUserInput) => ({ ...prev, last_name: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="john@example.com"
                    value={registerData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setRegisterData((prev: CreateUserInput) => ({ ...prev, email: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-phone">Phone (Optional)</Label>
                  <Input
                    id="register-phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={registerData.phone || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setRegisterData((prev: CreateUserInput) => ({ 
                        ...prev, 
                        phone: e.target.value || null 
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={registerData.password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setRegisterData((prev: CreateUserInput) => ({ ...prev, password: e.target.value }))
                    }
                    required
                    minLength={8}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
