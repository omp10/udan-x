import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Gift,
  Plus,
} from 'lucide-react';
import { userAuthService } from '../services/authService';
import { BottomSheet, Button, Card, EmptyState, Input, Skeleton } from '../components/ui';
import { useSettings } from '../../../shared/context/SettingsContext';
import { openExternalCheckout } from '../../../shared/utils/externalNavigation';
import { rememberPendingPhonePeRedirect } from '../../../shared/utils/phonePeResume';

const PHONEPE_USER_WALLET_FLOW_KEY = 'user-wallet-topup';

const Wallet = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const appName = settings.general?.app_name || 'App';
  const activePaymentGateway = settings.paymentGateway || null;

  const [showAddMoney, setShowAddMoney] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [isAdding, setIsAdding] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [walletLoading, setWalletLoading] = React.useState(true);
  const [walletError, setWalletError] = React.useState('');
  const [wallet, setWallet] = React.useState({ balance: 0, currency: 'INR', recentTransactions: [] });

  const basePath = useMemo(
    () => (window.location.pathname.startsWith('/taxi/user') ? '/taxi/user' : ''),
    [],
  );

  const formatInr = (value) => {
    const amountValue = Number(value || 0);
    const fixed = Math.round(amountValue * 100) / 100;
    return fixed.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const splitMoney = (formatted) => {
    const [whole, decimals = '00'] = String(formatted).split('.');
    return { whole, decimals: (decimals || '00').padEnd(2, '0').slice(0, 2) };
  };

  const balanceText = useMemo(() => splitMoney(formatInr(wallet.balance)), [wallet.balance]);
  const walletTopUpGatewayLabel = activePaymentGateway?.label || 'payment gateway';
  const supportsWalletTopUp = activePaymentGateway?.supportsWalletTopUp === true;
  const walletTopUpMode = activePaymentGateway?.walletTopUpMode || '';
  const canTopUpWallet = supportsWalletTopUp && ['razorpay_checkout', 'phonepe_redirect'].includes(walletTopUpMode);

  const refreshWallet = async () => {
    setWalletError('');
    setWalletLoading(true);

    try {
      const response = await userAuthService.getWallet();
      const data = response?.data || {};
      setWallet({
        balance: Number(data.balance || 0),
        currency: data.currency || 'INR',
        recentTransactions: Array.isArray(data.recentTransactions) ? data.recentTransactions : [],
      });
    } catch (err) {
      setWalletError(err?.message || 'Failed to load wallet');
    } finally {
      setWalletLoading(false);
    }
  };

  useEffect(() => {
    refreshWallet();
  }, []);

  const loadRazorpayScript = () =>
    new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const isMobileOrWebView = () => {
    const ua = String(window.navigator?.userAgent || '');
    return /Android|iPhone|iPad|iPod/i.test(ua)
      || /; wv\)/i.test(ua)
      || /Version\/[\d.]+/i.test(ua);
  };

  const handleAddMoney = async () => {
    const amountValue = Number(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) return;

    setIsAdding(true);
    setWalletError('');

    try {
      if (!activePaymentGateway) {
        throw new Error('No payment gateway is enabled by admin right now.');
      }

      if (!supportsWalletTopUp || !canTopUpWallet) {
        throw new Error(`${walletTopUpGatewayLabel} is enabled by admin, but wallet top-up is not implemented for it yet.`);
      }

      if (walletTopUpMode === 'phonepe_redirect') {
        const sessionResponse = await userAuthService.createPhonePeWalletTopupOrder(amountValue);
        const session = sessionResponse?.data || {};

        if (!session.checkoutUrl) {
          throw new Error('Unable to start PhonePe payment');
        }

        rememberPendingPhonePeRedirect(PHONEPE_USER_WALLET_FLOW_KEY, {
          merchantTransactionId: session.merchantTransactionId,
          checkoutUrl: session.checkoutUrl,
        });
        const opened = await openExternalCheckout(session.checkoutUrl);
        if (!opened) {
          throw new Error('PhonePe checkout could not open outside the app WebView. Please update the app bridge or open this payment flow in your browser.');
        }
        setIsAdding(false);
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Razorpay SDK failed to load');
      }

      const orderResponse = await userAuthService.createWalletTopupOrder(amountValue);
      const order = orderResponse?.data || {};

      if (!order.keyId || !order.orderId) {
        throw new Error('Unable to start payment');
      }

      let userInfo = {};
      try {
        userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      } catch {
        userInfo = {};
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: appName,
        description: 'Wallet Topup',
        order_id: order.orderId,
        ...(isMobileOrWebView() && order.callbackUrl
          ? {
              callback_url: order.callbackUrl,
              redirect: true,
            }
          : {}),
        prefill: {
          name: userInfo?.name || '',
          email: userInfo?.email || '',
          contact: userInfo?.phone ? `+91${userInfo.phone}` : '',
        },
        modal: {
          ondismiss: () => {
            setIsAdding(false);
          },
        },
        handler: async (response) => {
          try {
            const verifyResponse = await userAuthService.verifyWalletTopup(response);
            const data = verifyResponse?.data || {};
            setWallet({
              balance: Number(data.balance || 0),
              currency: data.currency || 'INR',
              recentTransactions: Array.isArray(data.recentTransactions) ? data.recentTransactions : [],
            });
            setIsSuccess(true);
            setTimeout(() => {
              setIsSuccess(false);
              setShowAddMoney(false);
              setAmount('');
            }, 1400);
          } catch (err) {
            setWalletError(err?.message || 'Payment verification failed');
          } finally {
            setIsAdding(false);
          }
        },
        theme: {
          color: '#E85D04',
        },
      });

      rzp.on('payment.failed', (event) => {
        const message = event?.error?.description || event?.error?.reason || 'Payment failed';
        setWalletError(message);
        setIsAdding(false);
      });

      rzp.open();
    } catch (err) {
      setWalletError(err?.message || 'Topup failed');
      setIsAdding(false);
    }
  };

  return (
    <div className="relative flex min-h-screen max-w-lg mx-auto flex-col overflow-x-hidden bg-surface-page pb-28 font-sans text-ink">
      <BottomSheet
        open={showAddMoney}
        onClose={() => setShowAddMoney(false)}
        title="Add money"
        subtitle={activePaymentGateway ? `Top-up via ${walletTopUpGatewayLabel}` : 'Select amount to top-up'}
      >
        {isSuccess ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-pill bg-emerald-500/12 text-emerald-500">
              <CheckCircle2 size={32} strokeWidth={2.2} />
            </div>
            <div className="text-center">
              <p className="text-base font-black text-ink">Wallet refilled</p>
              <p className="mt-1 text-xs font-bold text-ink-faint">Balance updated successfully</p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <Input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              aria-label="Top-up amount"
              leftIcon={<span className="text-base font-black">₹</span>}
              className="h-16 text-center text-2xl font-black"
            />

            <div className="grid grid-cols-3 gap-3">
              {['100', '500', '1000'].map((val) => (
                <Button
                  key={val}
                  variant={amount === val ? 'primary' : 'subtle'}
                  onClick={() => setAmount(val)}
                >
                  +₹{val}
                </Button>
              ))}
            </div>

            <Button
              block
              size="lg"
              loading={isAdding}
              disabled={!amount}
              rightIcon={<Plus size={18} strokeWidth={2.6} />}
              onClick={handleAddMoney}
            >
              {isAdding ? 'Processing...' : 'Refill wallet'}
            </Button>
          </div>
        )}
      </BottomSheet>

      <header className="sticky top-0 z-20 border-b border-line bg-surface px-5 pt-10 pb-4 shadow-soft">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Back"
            onClick={() => navigate(-1)}
            className="h-9 w-9 px-0"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </Button>
          <h1 className="text-[19px] font-black tracking-tight text-ink">My Wallet</h1>
        </div>
      </header>

      <div className="mt-6 px-5">
        <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6">
            <p className="text-2xs font-black uppercase tracking-[0.2em] text-ink-faint">Available balance</p>
            {walletLoading ? (
              <Skeleton className="mt-3 h-9 w-40 rounded-control" />
            ) : (
              <h2 className="mt-2 text-3xl font-black tracking-tight text-ink">
                ₹ {balanceText.whole}
                <span className="text-xl text-ink-faint">.{balanceText.decimals}</span>
              </h2>
            )}

            {walletError && <p className="mt-2 text-xs font-bold text-rose-500">{walletError}</p>}
            {activePaymentGateway && !canTopUpWallet && (
              <p className="mt-2 text-xs font-bold text-amber-500">
                {walletTopUpGatewayLabel} is active, but wallet top-up is not available for it yet.
              </p>
            )}

            <Button
              block
              size="lg"
              className="mt-6"
              disabled={!canTopUpWallet}
              leftIcon={<Plus size={16} strokeWidth={2.6} />}
              onClick={() => {
                setWalletError('');
                setShowAddMoney(true);
              }}
            >
              Add money
            </Button>
          </Card>
        </Motion.div>
      </div>

      <div className="mt-4 px-5">
        <Card
          role="button"
          tabIndex={0}
          onClick={() => navigate(`${basePath}/referral`)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') navigate(`${basePath}/referral`);
          }}
          className="flex cursor-pointer items-center gap-4 p-5 transition-transform active:scale-[0.99]"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand-soft text-brand">
            <Gift size={20} strokeWidth={2.4} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-black text-ink">
              Refer & Earn <span className="ml-1 font-black text-emerald-500">₹50</span>
            </h4>
            <p className="mt-0.5 text-2xs font-bold uppercase tracking-wider text-ink-faint">
              Invite friends to {appName}
            </p>
          </div>
          <ChevronRight size={18} className="shrink-0 text-ink-faint" />
        </Card>
      </div>

      <div className="mt-8 px-5">
        <div className="mb-3 flex items-center justify-between px-1">
          <h3 className="text-2xs font-black uppercase tracking-[0.26em] text-ink-faint">Transaction history</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`${basePath}/activity`)}
            className="text-2xs uppercase tracking-wider"
          >
            View all
          </Button>
        </div>

        {walletLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-[68px] rounded-card-lg" />
            ))}
          </div>
        ) : wallet.recentTransactions?.length ? (
          <Card padded={false} className="divide-y divide-line">
            {wallet.recentTransactions.map((tx) => {
              const isDebit = tx.kind === 'debit';
              const title = tx.title || (isDebit ? 'Debit' : 'Credit');
              const amountText = formatInr(tx.amount);
              const whenText = tx.createdAt
                ? new Date(tx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : '';

              return (
                <div key={tx.id} className="flex items-center gap-4 p-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${
                      isDebit ? 'bg-surface-sunken text-ink-soft' : 'bg-emerald-500/12 text-emerald-500'
                    }`}
                  >
                    {isDebit ? <ArrowUpRight size={16} strokeWidth={2.6} /> : <ArrowDownLeft size={16} strokeWidth={2.6} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-black text-ink">{title}</h4>
                    <p className="mt-0.5 text-2xs font-bold uppercase text-ink-faint">{whenText}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <h4 className={`text-base font-black ${isDebit ? 'text-ink' : 'text-emerald-500'}`}>
                      {isDebit ? '-' : '+'}₹{amountText}
                    </h4>
                    <span className="text-3xs font-black uppercase tracking-wider text-ink-faint">
                      {isDebit ? 'Debit' : 'Credit'}
                    </span>
                  </div>
                </div>
              );
            })}
          </Card>
        ) : (
          <EmptyState
            icon={ArrowDownLeft}
            title="No transactions yet"
            description="Your top-ups and ride payments will show up here."
          />
        )}
      </div>
    </div>
  );
};

export default Wallet;
