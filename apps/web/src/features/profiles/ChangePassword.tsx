import { useRef, useState } from 'react';
import { Action, Feedback, Field, Form } from '../../components/ui';
import { RequestError, supabase } from '../../lib/api';
import { authErrorReason } from '../../lib/auth-navigation';
import { useStrings } from '../../lib/i18n';

export function ChangePassword() {
  const t = useStrings();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div className="settings-password">
      <button
        ref={trigger}
        className="text-button settings-password-toggle"
        type="button"
        aria-expanded={open}
        onClick={() => {
          setSaved(false);
          setOpen(true);
        }}
      >
        {t.profileUi.changePassword}
      </button>
      <Feedback success={saved ? t.profileUi.passwordChanged : null} />
      {open ? (
        <PasswordForm
          onCancel={close}
          onSaved={() => {
            setSaved(true);
            close();
          }}
        />
      ) : null}
    </div>
  );
}

function PasswordForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const t = useStrings();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [code, setCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState<'save' | 'send' | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const submit = async (action: 'save' | 'send') => {
    if (pending) return;
    setPending(action);
    setError(null);
    try {
      if (!supabase) throw new Error(t.authMissing);
      if (action === 'send') {
        setSent(false);
        setCode('');
        const { error } = await supabase.auth.reauthenticate();
        if (error) throw new RequestError(error.status ?? 400, authErrorReason(error.code));
        setSent(true);
        return;
      }
      if (password.length < 8) throw new Error(t.discovery.passwordHint);
      if (password !== confirmation) throw new Error(t.discovery.passwordMismatch);
      if (password === current) throw new Error(t.profileUi.useDifferentPassword);
      const { error } = await supabase.auth.updateUser({
        current_password: current,
        password,
        ...(needsCode ? { nonce: code.trim() } : {}),
      });
      if (error?.code === 'reauthentication_needed') {
        setNeedsCode(true);
        return;
      }
      if (error?.code === 'reauthentication_not_valid' || error?.code === 'otp_expired')
        throw new Error(t.profileUi.verificationCodeInvalid);
      if (error?.code === 'same_password') throw new Error(t.profileUi.useDifferentPassword);
      if (error?.code === 'invalid_credentials')
        throw new Error(t.profileUi.currentPasswordIncorrect);
      if (error) throw new RequestError(error.status ?? 400, authErrorReason(error.code));
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error : new RequestError(400, 'auth_failed'));
    } finally {
      setPending(null);
    }
  };
  return (
    <Form
      onSubmit={() => {
        if (!needsCode || code.trim()) void submit('save');
      }}
    >
      <Field
        label={t.profileUi.currentPassword}
        value={current}
        onChange={setCurrent}
        type="password"
        autoComplete="current-password"
        required
        disabled={Boolean(pending)}
      />
      <Field
        label={t.newPassword}
        value={password}
        onChange={setPassword}
        type="password"
        autoComplete="new-password"
        description={t.discovery.passwordHint}
        required
        disabled={Boolean(pending)}
      />
      <Field
        label={t.discovery.confirmPassword}
        value={confirmation}
        onChange={setConfirmation}
        type="password"
        autoComplete="new-password"
        required
        disabled={Boolean(pending)}
      />
      {needsCode ? (
        <>
          <Action
            secondary
            pending={pending === 'send'}
            disabled={Boolean(pending)}
            onClick={() => void submit('send')}
          >
            {t.profileUi.sendVerificationCode}
          </Action>
          <Feedback success={sent ? t.profileUi.verificationCodeSent : null} />
          <Field
            label={t.profileUi.verificationCode}
            value={code}
            onChange={setCode}
            autoComplete="one-time-code"
            required
            disabled={Boolean(pending)}
          />
        </>
      ) : null}
      <Feedback error={error} />
      <div className="row wrap">
        <Action
          type="submit"
          pending={pending === 'save'}
          disabled={Boolean(pending) || (needsCode && !code.trim())}
        >
          {t.save}
        </Action>
        <Action secondary disabled={Boolean(pending)} onClick={onCancel}>
          {t.cancel}
        </Action>
      </div>
    </Form>
  );
}
