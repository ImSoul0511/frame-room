import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { profileInputSchema } from '@frameroom/shared';
import { supabase, post, RequestError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useTask } from '../lib/hooks';
import { Action, Area, Field, Feedback, Form, GenreSelect, Select } from '../components/ui';
import { useStrings } from '../lib/i18n';

export function AuthPage({ recovery = false }: { recovery?: boolean }) {
  const t = useStrings();

  const [params] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<'' | 'saved' | 'checkEmail'>('');
  const auth = useAuth();
  const navigate = useNavigate();
  const rawNext = params.get('next') ?? '/projects';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/projects';
  const task = useTask(async () => {
    if (!supabase) throw new Error(t.authMissing);
    if (recovery) {
      if (password.length < 8) throw new Error(t.errors.invalid_input);
      const { error } = await supabase.auth.updateUser({ password });
      if (error)
        throw new RequestError(
          400,
          error.code === 'invalid_credentials'
            ? 'auth_invalid_credentials'
            : error.code === 'email_not_confirmed'
              ? 'email_confirmation_required'
              : 'auth_failed',
        );
      setNotice('saved');
      navigate('/settings');
      return;
    }
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error)
        throw new RequestError(
          400,
          error.code === 'invalid_credentials'
            ? 'auth_invalid_credentials'
            : error.code === 'email_not_confirmed'
              ? 'email_confirmation_required'
              : 'auth_failed',
        );
      navigate(next);
    } else if (mode === 'signup') {
      if (password.length < 8) throw new Error(t.errors.invalid_input);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error)
        throw new RequestError(
          400,
          error.code === 'invalid_credentials'
            ? 'auth_invalid_credentials'
            : error.code === 'email_not_confirmed'
              ? 'email_confirmation_required'
              : 'auth_failed',
        );
      if (data.session) navigate('/onboarding');
      else setNotice('checkEmail');
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/reset-password`,
      });
      if (error)
        throw new RequestError(
          400,
          error.code === 'invalid_credentials'
            ? 'auth_invalid_credentials'
            : error.code === 'email_not_confirmed'
              ? 'email_confirmation_required'
              : 'auth_failed',
        );
      setNotice('checkEmail');
    }
  });
  if (auth.session && !recovery) return <Navigate to={next} replace />;
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <span className="eyebrow">{t.authKicker}</span>
        <h1>{t.authTitle}</h1>
        <p>{t.authDescription}</p>
        <div className="auth-art">
          <span>F</span>
          <span>R</span>
          <i />
        </div>
        <Link to="/explore">← {t.nav.explore}</Link>
      </section>
      <section className="auth-form">
        <h2>
          {recovery
            ? t.updatePassword
            : mode === 'login'
              ? t.login
              : mode === 'signup'
                ? t.signup
                : t.reset}
        </h2>
        <Form onSubmit={() => task.mutate()}>
          {!recovery ? (
            <Field label={t.email} value={email} onChange={setEmail} type="email" required />
          ) : null}
          {recovery || mode !== 'reset' ? (
            <Field
              label={recovery ? t.newPassword : t.password}
              value={password}
              onChange={setPassword}
              type="password"
              required
            />
          ) : null}
          <Feedback error={task.error} success={notice ? t[notice] : null} />
          <Action type="submit" pending={task.isPending} disabled={!supabase}>
            {recovery
              ? t.updatePassword
              : mode === 'login'
                ? t.login
                : mode === 'signup'
                  ? t.signup
                  : t.reset}
          </Action>
        </Form>
        {!recovery ? (
          <div className="row wrap">
            <button
              className="text-button"
              onClick={() => {
                setMode(mode === 'signup' ? 'login' : 'signup');
                task.reset();
                setNotice('');
              }}
            >
              {mode === 'signup' ? t.login : t.signup}
            </button>
            <button
              className="text-button"
              onClick={() => {
                setMode('reset');
                task.reset();
                setNotice('');
              }}
            >
              {t.forgot}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
export function OnboardingPage() {
  const t = useStrings();

  const auth = useAuth();
  const nav = useNavigate();
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('client');
  const [genre, setGenre] = useState('portrait');
  const [bio, setBio] = useState('');
  const task = useTask(async () => {
    const input = profileInputSchema.parse({ displayName: name, userName: username });
    await post('/v1/me', input);
    if (role === 'photographer')
      await post('/v1/photographers/me', { displayName: name, bio, genres: [genre] });
    await client.invalidateQueries({ queryKey: ['profile'] });
    nav('/projects');
  });
  if (auth.loading) return <p>{t.pending}</p>;
  if (!auth.session) return <Navigate to="/auth" replace />;
  return (
    <div className="narrow-page">
      <h1>{t.onboarding}</h1>
      <Form onSubmit={() => task.mutate()}>
        <Field label={t.displayName} value={name} onChange={setName} required />
        <Field label={t.userName} value={username} onChange={setUsername} required />
        <Select label={t.role} value={role} onChange={setRole}>
          <option value="client">{t.client}</option>
          <option value="photographer">{t.photographer}</option>
        </Select>
        {role === 'photographer' ? (
          <>
            <GenreSelect value={genre} onChange={setGenre} />
            <Area label={t.bio} value={bio} onChange={setBio} />
          </>
        ) : null}
        <Feedback error={task.error} />
        <Action type="submit" pending={task.isPending}>
          {t.continue}
        </Action>
      </Form>
    </div>
  );
}
