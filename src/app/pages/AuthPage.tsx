import { useState } from 'react';
import { Tabs, TextInput, PasswordInput, Button, Anchor, Text } from '@mantine/core';
import { useAuth } from '../context/auth/useAuth.ts';
import { Navigate } from 'react-router-dom';

export default function AuthPage() {
  const { isAuthenticated, signIn, signUp, confirmSignUp } = useAuth();

  const [activeTab, setActiveTab] = useState<string | null>('signin');

  // Shared
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Sign-up only
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async () => {
    setError(null);
    try {
      await signIn(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    }
  };

  const handleSignUp = async () => {
    setError(null);
    if (!firstName.trim() || !lastName.trim() || !username.trim()) {
      setError('First name, last name, and username are required.');
      return;
    }
    try {
      await signUp(email, password, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
      });
      setShowConfirmation(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign-up failed. Please try again.');
    }
  };

  const handleConfirmSignUp = async () => {
    setError(null);
    try {
      await confirmSignUp(email, confirmationCode);
      setShowConfirmation(false);
      setActiveTab('signin');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Confirmation failed. Please try again.');
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
            <Text c="red" mt="sm">
              {error}
            </Text>
          )}
          <Button fullWidth mt="md" onClick={handleSignIn}>
            Sign In
          </Button>
          <Anchor component="button" type="button" onClick={() => setActiveTab('signup')} mt="sm">
            Don&apos;t have an account? Sign Up
          </Anchor>
        </Tabs.Panel>

        <Tabs.Panel value="signup" pt="xs">
          {!showConfirmation ? (
            <>
              <TextInput
                label="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.currentTarget.value)}
                required
              />
              <TextInput
                label="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.currentTarget.value)}
                required
                mt="md"
              />
              <TextInput
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.currentTarget.value)}
                required
                mt="md"
              />
              <TextInput
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                required
                mt="md"
              />
              <PasswordInput
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
                mt="md"
              />
              {error && (
                <Text c="red" mt="sm">
                  {error}
                </Text>
              )}
              <Button fullWidth mt="md" onClick={handleSignUp}>
                Sign Up
              </Button>
            </>
          ) : (
            <>
              <Text>Check your email for the confirmation code.</Text>
              <TextInput
                label="Confirmation Code"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.currentTarget.value)}
                required
                mt="md"
              />
              {error && (
                <Text c="red" mt="sm">
                  {error}
                </Text>
              )}
              <Button fullWidth mt="md" onClick={handleConfirmSignUp}>
                Confirm Email
              </Button>
            </>
          )}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
