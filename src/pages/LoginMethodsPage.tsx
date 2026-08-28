import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Spinner } from '../components/Spinner';
import { Switch } from '../components/Switch';
import {
  buildSignupUpdate,
  loginMethodLabel,
  validateEnabledChange,
  type LoginMethodRow,
} from '../lib/loginMethods';
import { useProduct } from '../lib/ProductContext';
import { supabase } from '../lib/supabase';

export function LoginMethodsPage() {
  const { productId, current } = useProduct();
  const [methods, setMethods] = useState<LoginMethodRow[]>([]);
  const [orderDrafts, setOrderDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!productId) {
      setMethods([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: loadError } = await supabase
      .from('product_login_methods')
      .select('id, product_id, type, enabled, is_default, order, allow_signup, config')
      .eq('product_id', productId)
      .order('order', { ascending: true });

    if (loadError) {
      setMethods([]);
      setError(loadError.message);
    } else {
      const rows = (data ?? []) as LoginMethodRow[];
      setMethods(rows);
      setOrderDrafts(
        Object.fromEntries(rows.map((method) => [method.id, String(method.order ?? 0)])),
      );
    }
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    setSuccess(null);
    void load();
  }, [load]);

  const updateMethod = async (
    method: LoginMethodRow,
    values: Partial<LoginMethodRow>,
    message: string,
  ) => {
    setSavingId(method.id);
    setError(null);
    setSuccess(null);
    const { error: updateError } = await supabase
      .from('product_login_methods')
      .update(values)
      .eq('id', method.id)
      .eq('product_id', method.product_id);
    setSavingId(null);

    if (updateError) {
      setError(updateError.message);
      await load();
      return;
    }

    setMethods((currentMethods) =>
      currentMethods.map((candidate) =>
        candidate.id === method.id ? { ...candidate, ...values } : candidate,
      ),
    );
    setSuccess(message);
  };

  const changeEnabled = async (method: LoginMethodRow, enabled: boolean) => {
    const validationError = validateEnabledChange(methods, method.id, enabled);
    if (validationError) {
      setError(validationError);
      setSuccess(null);
      return;
    }
    await updateMethod(method, { enabled }, `${loginMethodLabel(method.type)} updated.`);
  };

  const changeSignup = async (method: LoginMethodRow, allowSignup: boolean) => {
    await updateMethod(
      method,
      buildSignupUpdate(method, allowSignup),
      `${loginMethodLabel(method.type)} signup ${allowSignup ? 'enabled' : 'disabled'}.`,
    );
  };

  const changeDefault = async (method: LoginMethodRow) => {
    if (!productId || method.is_default) return;
    if (!method.enabled) {
      setError('Enable this login method before making it the default.');
      setSuccess(null);
      return;
    }

    setSavingId(method.id);
    setError(null);
    setSuccess(null);
    const { error: rpcError } = await supabase.rpc('set_default_login_method', {
      p_product_id: productId,
      p_method_id: method.id,
    });
    setSavingId(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setMethods((currentMethods) =>
      currentMethods.map((candidate) => ({
        ...candidate,
        is_default: candidate.id === method.id,
      })),
    );
    setSuccess(`${loginMethodLabel(method.type)} is now the default.`);
  };

  const saveOrder = async (method: LoginMethodRow) => {
    const raw = orderDrafts[method.id] ?? '';
    const order = Number(raw);
    if (!Number.isInteger(order) || order < 0) {
      setError('Order must be a non-negative whole number.');
      setSuccess(null);
      setOrderDrafts((drafts) => ({ ...drafts, [method.id]: String(method.order) }));
      return;
    }
    if (order === method.order) return;
    await updateMethod(method, { order }, `${loginMethodLabel(method.type)} order updated.`);
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Login Methods</h1>
          <p className="page-desc">
            Control sign-in and signup options
            {current ? ` · ${current.display_name}` : ''}
          </p>
        </div>
      </div>

      {!productId ? (
        <div className="card empty">Select a product to manage login methods.</div>
      ) : (
        <>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert login-method-success">{success}</div>}

          {loading ? (
            <Spinner label="Loading login methods..." />
          ) : methods.length === 0 ? (
            <div className="card empty">
              No login methods are configured for this product.
            </div>
          ) : (
            <div className="login-method-list">
              {methods.map((method) => {
                const saving = savingId === method.id;
                return (
                  <section className="card login-method-card" key={method.id}>
                    <div className="login-method-heading">
                      <div>
                        <h2>{loginMethodLabel(method.type)}</h2>
                        <code>{method.type}</code>
                      </div>
                      {method.is_default && (
                        <span className="badge badge-on">
                          <ShieldCheck size={13} />
                          Default
                        </span>
                      )}
                    </div>

                    <div className="login-method-controls">
                      <div className="login-method-control">
                        <div>
                          <strong>Enabled</strong>
                          <span>Allow users to sign in with this method.</span>
                        </div>
                        <Switch
                          checked={method.enabled}
                          disabled={saving}
                          onChange={(enabled) => void changeEnabled(method, enabled)}
                        />
                      </div>

                      <div className="login-method-control">
                        <div>
                          <strong>Allow signup</strong>
                          <span>Show account creation and permit app signup.</span>
                        </div>
                        <Switch
                          checked={method.allow_signup}
                          disabled={saving}
                          onChange={(allowSignup) => void changeSignup(method, allowSignup)}
                        />
                      </div>

                      <div className="login-method-control">
                        <div>
                          <strong>Default method</strong>
                          <span>Use this method before an identifier is entered.</span>
                        </div>
                        <input
                          className="login-method-radio"
                          type="radio"
                          name="default-login-method"
                          checked={method.is_default}
                          disabled={saving || !method.enabled}
                          onChange={() => void changeDefault(method)}
                          aria-label={`Make ${loginMethodLabel(method.type)} the default`}
                        />
                      </div>

                      <div className="login-method-control">
                        <div>
                          <strong>Order</strong>
                          <span>Lower values are evaluated first.</span>
                        </div>
                        <input
                          className="login-method-order"
                          type="number"
                          min="0"
                          step="1"
                          value={orderDrafts[method.id] ?? ''}
                          disabled={saving}
                          onChange={(event) =>
                            setOrderDrafts((drafts) => ({
                              ...drafts,
                              [method.id]: event.target.value,
                            }))
                          }
                          onBlur={() => void saveOrder(method)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') event.currentTarget.blur();
                          }}
                          aria-label={`${loginMethodLabel(method.type)} order`}
                        />
                      </div>
                    </div>

                    <details className="login-method-advanced">
                      <summary>Advanced configuration (read-only)</summary>
                      <pre>{JSON.stringify(method.config ?? {}, null, 2)}</pre>
                    </details>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
