import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Banknote, Check, ChevronRight, CreditCard, Info, Wallet } from 'lucide-react';
import { userAuthService } from '../../services/authService';
import { useSettings } from '../../../../shared/context/SettingsContext';

const formatInr = (value) =>
  (Math.round(Number(value || 0) * 100) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const MethodCard = ({ icon: Icon, tone, title, subtitle, badge, onClick }) => {
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      {...(onClick ? { type: 'button', onClick } : {})}
      className={`w-full text-left bg-white p-6 rounded-[32px] border border-gray-50 shadow-sm flex items-center justify-between ${onClick ? 'active:scale-95 transition-transform' : ''}`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tone}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="font-black">{title}</p>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
      {badge}
    </Wrapper>
  );
};

const DefaultTick = () => (
  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white shrink-0">
    <Check size={14} strokeWidth={4} />
  </div>
);

const PaymentSettings = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const gateway = settings.paymentGateway || null;

  const [wallet, setWallet] = React.useState(null);
  const [walletError, setWalletError] = React.useState('');
  const [walletLoading, setWalletLoading] = React.useState(true);

  const basePath = React.useMemo(
    () => (window.location.pathname.startsWith('/taxi/user') ? '/taxi/user' : ''),
    [],
  );

  React.useEffect(() => {
    let active = true;

    const loadWallet = async () => {
      try {
        const response = await userAuthService.getWallet();
        const data = response?.data || {};
        if (active) {
          setWallet({ balance: Number(data.balance || 0), currency: data.currency || 'INR' });
        }
      } catch (err) {
        if (active) {
          setWalletError(err?.message || 'Could not load wallet balance');
        }
      } finally {
        if (active) {
          setWalletLoading(false);
        }
      }
    };

    loadWallet();

    return () => {
      active = false;
    };
  }, []);

  const walletSubtitle = walletLoading
    ? 'Loading balance…'
    : walletError
      ? walletError
      : `Balance ₹${formatInr(wallet?.balance)}`;

  return (
    <div className="min-h-screen bg-[#FDFDFD] max-w-lg mx-auto flex flex-col font-sans">
      <header className="bg-white p-5 flex items-center gap-6 border-b border-gray-50 sticky top-0 z-20">
        <button onClick={() => navigate(`${basePath}/profile`)} className="p-2 active:scale-95"><ArrowLeft size={24} /></button>
        <h1 className="text-[18px] font-black">Payments</h1>
      </header>

      <div className="p-5 space-y-4">
        <MethodCard
          icon={Banknote}
          tone="bg-green-50 text-green-600"
          title="Cash"
          subtitle="Pay the driver directly"
          badge={<DefaultTick />}
        />

        <MethodCard
          icon={CreditCard}
          tone={gateway ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}
          title="Online"
          subtitle={
            gateway
              ? `UPI, cards or netbanking via ${gateway.label || 'payment gateway'}`
              : 'Not available — no payment gateway is configured'
          }
          badge={
            gateway ? (
              <DefaultTick />
            ) : (
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Off</span>
            )
          }
        />

        <MethodCard
          icon={Wallet}
          tone="bg-purple-50 text-purple-600"
          title="Wallet"
          subtitle={walletSubtitle}
          onClick={() => navigate(`${basePath}/wallet`)}
          badge={<ChevronRight size={18} className="text-gray-300 shrink-0" strokeWidth={3} />}
        />

        <div className="flex items-start gap-3 bg-gray-50 border border-gray-100 rounded-[24px] p-5">
          <Info size={18} className="text-gray-400 shrink-0 mt-0.5" />
          <p className="text-[12px] font-bold text-gray-400 leading-relaxed">
            Card and UPI details are never stored in this app. You enter them in the secure
            {gateway?.label ? ` ${gateway.label}` : ' payment gateway'} checkout at the end of every trip.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentSettings;
