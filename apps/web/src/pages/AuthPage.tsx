import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { profileInputSchema, photographerInputSchema } from '@frameroom/shared';
import { supabase, post, api, RequestError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useTask } from '../lib/hooks';
import { Action, Area, Field, Feedback, Form, GenreSelect, Select } from '../components/ui';
import { Botanical } from '../components/Botanical';
import { useStrings } from '../lib/i18n';
import { accountDestination, safeReturnPath, authErrorReason } from '../lib/auth-navigation';

export function AuthPage({
  recovery = false,
  callback = false,
}: {
  recovery?: boolean;
  callback?: boolean;
}) {
  const t = useStrings();
  const [params, setParams] = useSearchParams();
  const mode =
    params.get('mode') === 'signup' ? 'signup' : params.get('mode') === 'reset' ? 'reset' : 'login';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('client');
  const [notice, setNotice] = useState<'' | 'checkEmail' | 'emailSent'>('');
  const auth = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const requested = params.get('next');
  const next = safeReturnPath(requested, accountDestination(auth.profile?.roles ?? []));
  const returnQuery = requested ? '?next=' + encodeURIComponent(safeReturnPath(requested)) : '';
  const onboarding = '/onboarding' + returnQuery;
  const redirectTo = location.origin + '/auth/callback' + returnQuery;
  const task = useTask(async () => {
    if (!supabase) throw new Error(t.authMissing);
    if ((mode !== 'reset' || recovery) && !password) throw new RequestError(400, 'invalid_input');
    if ((mode === 'signup' || recovery) && password.length < 8)
      throw new Error(t.discovery.passwordHint);
    if ((mode === 'signup' || recovery) && password !== confirmation)
      throw new Error(t.discovery.passwordMismatch);
    if (recovery) {
      if (!auth.session) throw new Error(t.discovery.callbackFailed);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new RequestError(400, authErrorReason(error.code));
      setPassword('');
      setConfirmation('');
      navigate('/settings', { replace: true });
    } else if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new RequestError(400, authErrorReason(error.code));
      setPassword('');
    } else if (mode === 'signup') {
      const profile = profileInputSchema.safeParse({ displayName: name, userName: username });
      if (!profile.success) throw new RequestError(400, 'invalid_input');
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            display_name: profile.data.displayName,
            user_name: profile.data.userName,
            registration_role: role,
          },
        },
      });
      if (error)
        throw new RequestError(
          400,
          error.code === 'user_already_exists' || error.code === 'email_exists'
            ? 'registration_email_unavailable'
            : authErrorReason(error.code),
        );
      setPassword('');
      setConfirmation('');
      if (data.user?.identities?.length === 0)
        throw new RequestError(400, 'registration_email_unavailable');
      if (data.session) navigate(onboarding, { replace: true });
      else setNotice('checkEmail');
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: location.origin + '/reset-password',
      });
      if (error) throw new RequestError(400, authErrorReason(error.code));
      setNotice('checkEmail');
    }
  });
  const resend = useTask(async () => {
    if (!supabase) throw new Error(t.authMissing);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw new RequestError(400, authErrorReason(error.code));
    setNotice('emailSent');
  });
  const changeMode = (value: string) => {
    setParams(requested ? { mode: value, next: safeReturnPath(requested) } : { mode: value });
    task.reset();
    resend.reset();
    setNotice('');
    setPassword('');
    setConfirmation('');
  };
  const profileMissing = auth.onboardingRequired;
  if (!recovery && auth.session && !auth.loading && !auth.profileLoading) {
    if (profileMissing) return <Navigate to={onboarding} replace />;
    if (auth.profile && mode !== 'reset') return <Navigate to={next} replace />;
  }
  if (auth.loading || (auth.session && auth.profileLoading))
    return (
      <p className="auth-loading" role="status">
        {t.pending}
      </p>
    );
  if (!recovery && auth.session && auth.profileError && !profileMissing)
    return (
      <section className="narrow-page">
        <h1>{t.discovery.welcome}</h1>
        <Feedback error={auth.profileError} />
        <Action onClick={() => void queryClient.invalidateQueries({ queryKey: ['profile'] })}>
          {t.retry}
        </Action>
      </section>
    );
  const title = recovery
    ? t.updatePassword
    : callback
      ? t.discovery.checkTitle
      : notice
        ? t.discovery.checkTitle
        : mode === 'login'
          ? t.discovery.welcome
          : mode === 'signup'
            ? t.signup
            : t.forgot;
  const description = recovery
    ? t.discovery.passwordHint
    : mode === 'signup'
      ? t.discovery.signupDescription
      : mode === 'reset'
        ? t.discovery.resetDescription
        : t.discovery.loginDescription;
  const callbackError = callback && (!auth.session || params.has('error'));
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <span className="eyebrow">{t.authKicker}</span>
        <h1>{t.authTitle}</h1>
        <p>{t.authDescription}</p>
        <Botanical className="auth-flower" />
        <Link to="/explore">{t.nav.explore}</Link>
      </section>
      <section className="auth-form">
        <div>
          <p className="eyebrow">FRAMEROOM</p>
          <h2>{title}</h2>
          {!notice && !callback ? <p className="auth-description">{description}</p> : null}
        </div>
        {auth.profileError && !profileMissing ? <Feedback error={auth.profileError} /> : null}
        {callbackError ? (
          <>
            <p role="alert">{t.discovery.callbackFailed}</p>
            <Link className="button-link dark" to="/auth">
              {t.discovery.backToLogin}
            </Link>
          </>
        ) : notice ? (
          <div className="confirmation-panel">
            <span className="confirmation-icon" aria-hidden="true">
              ✉
            </span>
            <p role="status">{notice === 'emailSent' ? t.discovery.emailSent : t.checkEmail}</p>
            <strong>{email}</strong>
            {mode === 'signup' ? (
              <Action secondary pending={resend.isPending} onClick={() => resend.mutate()}>
                {t.discovery.resend}
              </Action>
            ) : null}
            <Feedback error={resend.error} />
            <button className="text-button" onClick={() => changeMode('login')}>
              {t.discovery.backToLogin}
            </button>
          </div>
        ) : !callback ? (
          <>
            <Form
              onSubmit={() => {
                if (!task.isPending) task.mutate();
              }}
            >
              {mode === 'signup' && !recovery ? (
                <>
                  <Field
                    label={t.displayName}
                    value={name}
                    onChange={setName}
                    autoComplete="name"
                    required
                  />
                  <Field
                    label={t.userName}
                    value={username}
                    onChange={setUsername}
                    autoComplete="username"
                    description={t.discovery.usernameHint}
                    required
                  />
                  <Select label={t.role} value={role} onChange={setRole}>
                    <option value="client">{t.client}</option>
                    <option value="photographer">{t.photographer}</option>
                  </Select>
                </>
              ) : null}
              {!recovery ? (
                <Field label={t.email} value={email} onChange={setEmail} type="email" required />
              ) : null}
              {recovery || mode !== 'reset' ? (
                <Field
                  label={recovery ? t.newPassword : t.password}
                  value={password}
                  onChange={setPassword}
                  type="password"
                  autoComplete={mode === 'signup' || recovery ? 'new-password' : 'current-password'}
                  description={mode === 'signup' || recovery ? t.discovery.passwordHint : undefined}
                  required
                />
              ) : null}
              {recovery || mode === 'signup' ? (
                <Field
                  label={t.discovery.confirmPassword}
                  value={confirmation}
                  onChange={setConfirmation}
                  type="password"
                  autoComplete="new-password"
                  required
                />
              ) : null}
              <Feedback error={task.error} />
              <Action
                type="submit"
                pending={task.isPending}
                disabled={!supabase || (recovery && !auth.session)}
              >
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
              <div className="auth-secondary">
                {mode === 'login' ? (
                  <button className="text-button" onClick={() => changeMode('reset')}>
                    {t.forgot}
                  </button>
                ) : null}
                <p>
                  {mode === 'signup' ? t.discovery.haveAccount : t.discovery.newAccount}{' '}
                  <button
                    className="text-button"
                    onClick={() => changeMode(mode === 'signup' ? 'login' : 'signup')}
                  >
                    {mode === 'signup' ? t.login : t.signup}
                  </button>
                </p>
                {mode === 'reset' ? (
                  <button className="text-button" onClick={() => changeMode('login')}>
                    {t.discovery.backToLogin}
                  </button>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}

export function OnboardingPage() {
  const t = useStrings();
  const auth = useAuth();
  const [params] = useSearchParams();
  if (auth.loading || auth.profileLoading) return <p role="status">{t.pending}</p>;
  if (!auth.session)
    return (
      <Navigate
        to={`/auth?next=${encodeURIComponent(safeReturnPath(params.get('next')))}`}
        replace
      />
    );
  return <OnboardingForm key={auth.session.user.id} />;
}

function OnboardingForm() {
  const t = useStrings();
  const auth = useAuth();
  const [params] = useSearchParams();
  const next = params.get('next');
  const navigate = useNavigate();
  const client = useQueryClient();
  const metadata = auth.session?.user.user_metadata;
  const [name, setName] = useState(
    auth.profile?.displayName ?? String(metadata?.display_name ?? ''),
  );
  const [username, setUsername] = useState(
    auth.profile?.userName ?? String(metadata?.user_name ?? ''),
  );
  const [role, setRole] = useState(
    metadata?.registration_role === 'photographer' ? 'photographer' : 'client',
  );
  const [genre, setGenre] = useState('portrait');
  const [bio, setBio] = useState('');
  const [completed, setCompleted] = useState(false);
  const signInAgain = useTask(async () => {
    const result = await supabase?.auth.signOut({ scope: 'local' });
    if (result?.error) throw new RequestError(400, 'auth_failed');
    navigate(next ? `/auth?next=${encodeURIComponent(safeReturnPath(next))}` : '/auth', {
      replace: true,
    });
  });
  const task = useTask(async () => {
    const parsed = profileInputSchema.safeParse({ displayName: name, userName: username });
    if (!parsed.success) throw new RequestError(400, 'invalid_input');
    const photographer =
      role === 'photographer'
        ? photographerInputSchema.parse({ displayName: name, bio, genres: [genre] })
        : null;
    await post('/v1/me', parsed.data);
    if (photographer) {
      const existing = await api('/v1/photographers/me');
      if (!existing) await post('/v1/photographers/me', photographer);
    }
    await client.invalidateQueries({ queryKey: ['profile'] });
    setCompleted(true);
  });
  if (auth.loading) return <p role="status">{t.pending}</p>;
  if (!auth.session) return <Navigate to="/auth" replace />;
  if (completed)
    return (
      <section className="onboarding-page narrow-page">
        <h1 role="status">{t.discovery.registrationComplete}</h1>
        <Link
          className="button-link dark"
          to={safeReturnPath(next, accountDestination(auth.profile?.roles ?? []))}
        >
          {t.continue}
        </Link>
        <Action secondary pending={signInAgain.isPending} onClick={() => signInAgain.mutate()}>
          {t.login}
        </Action>
        <Feedback error={signInAgain.error} />
      </section>
    );
  return (
    <section className="onboarding-page narrow-page">
      <p className="eyebrow">FRAMEROOM</p>
      <h1>{t.onboarding}</h1>
      <p className="auth-description">{t.discovery.onboardingDescription}</p>
      <Form
        onSubmit={() => {
          if (!task.isPending) task.mutate();
        }}
      >
        <div className="role-options">
          {(['client', 'photographer'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={role === value ? 'role-option selected' : 'role-option'}
              aria-pressed={role === value}
              onClick={() => setRole(value)}
              disabled={
                metadata?.registration_role === 'client' ||
                metadata?.registration_role === 'photographer' ||
                task.isPending
              }
            >
              <strong>{t[value]}</strong>
              <span>
                {value === 'client'
                  ? t.discovery.clientDescription
                  : t.discovery.photographerDescription}
              </span>
            </button>
          ))}
        </div>
        <Field label={t.displayName} value={name} onChange={setName} autoComplete="name" required />
        <Field
          label={t.userName}
          value={username}
          onChange={setUsername}
          autoComplete="username"
          description={t.discovery.usernameHint}
          required
        />
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
    </section>
  );
}
