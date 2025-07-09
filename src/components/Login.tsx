import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

interface LoginProps {
  onLogin: (identifier: string, password: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

export const Login: React.FC<LoginProps> = ({ onLogin, isLoading = false, error }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (identifier.trim() && password.trim()) {
      await onLogin(identifier.trim(), password);
    }
  };

  const isValid = identifier.trim().length > 0 && password.trim().length > 0;

  return (
    <div className="min-h-screen bg-beige flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-milk text-2xl font-bold">🦋</span>
          </div>
          <h1 className="text-2xl font-bold text-red font-serif">Welcome to Bluesky</h1>
          <p className="text-dark mt-2">Sign in to your account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-center text-red font-serif">Sign In</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="identifier" className="block text-sm font-medium text-dark mb-1">
                  Email or Handle
                </label>
                <input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@example.com or you.bsky.social"
                  className="w-full px-3 py-2 border border-mocha/30 rounded-md focus:outline-none focus:ring-2 focus:ring-red focus:border-transparent bg-milk text-dark"
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-dark mb-1">
                  App Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your app password"
                    className="w-full px-3 py-2 border border-mocha/30 rounded-md focus:outline-none focus:ring-2 focus:ring-red focus:border-transparent pr-10 bg-milk text-dark"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-coffee" />
                    ) : (
                      <Eye className="h-4 w-4 text-coffee" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-coffee mt-1">
                  Use an app password from your Bluesky settings, not your main password
                </p>
              </div>

              {error && (
                <div className="flex items-center space-x-2 text-red bg-red/10 p-3 rounded-md">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={!isValid || isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-beige border-t-transparent rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </div>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-dark">
                Don't have an account?{' '}
                <a 
                  href="https://bsky.app" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-red hover:text-coffee font-medium"
                >
                  Sign up on Bluesky
                </a>
              </p>
            </div>

            <div className="mt-4 text-center">
              <a 
                href="https://bsky.app/settings/app-passwords" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-coffee hover:text-dark"
              >
                Need help creating an app password?
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};