// src/pages/AuthPage.tsx

import { useState } from 'react';
import { Tabs, TextInput, PasswordInput, Button, Anchor, Text } from '@mantine/core';
import { useAuth } from '../context/auth/auth-context.ts';
import { Navigate } from 'react-router-dom';

export default function AuthPage() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const [activeTab, setActiveTab] = useState<string | null>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { signIn, signUp, confirmSignUp } = useAuth();

  const handleSignIn = async () => {
    setError(null);
    try {
      await signIn(email, password);
      // No need to navigate, as auth state change will handle rendering
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : 'Unknown error') || 'Sign-in failed. Please try again.');
    }
  };

  const handleSignUp = async () => {
    setError(null);
    try {
      await signUp(email, password);
      setShowConfirmation(true);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : 'Unknown error') || 'Sign-up failed. Please try again.');
    }
  };

  const handleConfirmSignUp = async () => {
    setError(null);
    try {
      await confirmSignUp(email, confirmationCode);
      setShowConfirmation(false);
      setActiveTab('signin');
      // Optionally show success message
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : 'Unknown error') || 'Confirmation failed. Please try again.');
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: 'auto', padding: '2rem' }}>
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List grow>
          <Tabs.Tab value="signin">Sign In</Tabs.Tab>
          <Tabs.Tab value="signup">Sign Up</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="signin" pt="xs">
          <TextInput label="Email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} required />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            required
            mt="md"
          />
          {error && (
            <Text color="red" mt="sm">
              {error}
            </Text>
          )}
          <Button fullWidth mt="md" onClick={handleSignIn}>
            Sign In
          </Button>
          <Anchor component="button" type="button" onClick={() => setActiveTab('signup')} mt="sm">
            Don't have an account? Sign Up
          </Anchor>
        </Tabs.Panel>

        <Tabs.Panel value="signup" pt="xs">
          {!showConfirmation ? (
            <>
              <TextInput label="Email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} required />
              <PasswordInput
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
                mt="md"
              />
              {error && (
                <Text color="red" mt="sm">
                  {error}
                </Text>
              )}
              <Button fullWidth mt="md" onClick={handleSignUp}>
                Sign Up
              </Button>
            </>
          ) : (
            <>
              <Text>Enter the confirmation code sent to your email.</Text>
              <TextInput
                label="Confirmation Code"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.currentTarget.value)}
                required
                mt="md"
              />
              {error && (
                <Text color="red" mt="sm">
                  {error}
                </Text>
              )}
              <Button fullWidth mt="md" onClick={handleConfirmSignUp}>
                Confirm Sign Up
              </Button>
            </>
          )}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
