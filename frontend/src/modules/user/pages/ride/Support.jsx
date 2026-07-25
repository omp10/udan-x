import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Phone, HelpCircle, AlertCircle, XCircle, ShieldCheck, ChevronRight, Siren } from 'lucide-react';
import { SUPPORT_INFO } from '../../../shared/content/supportInfo';
import { Button, Card } from '../../components/ui';

const Support = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = location.pathname.startsWith('/taxi/user') ? '/taxi/user' : '';

  const helpTopics = [
    { title: "Driver didn't arrive", Icon: XCircle, iconClass: 'text-rose-500' },
    { title: 'Safety concern', Icon: ShieldCheck, iconClass: 'text-blue-500' },
    { title: 'I lost an item', Icon: HelpCircle, iconClass: 'text-brand' },
    { title: 'Payment failure', Icon: AlertCircle, iconClass: 'text-ink-soft' },
  ];

  const handleCall = () => {
    window.open(`tel:${SUPPORT_INFO.phoneHref}`, '_self');
  };

  const openSupportChat = (topicTitle = '') => {
    const initialDraft = topicTitle ? `Hi, I need help with: ${topicTitle}.` : '';

    navigate(`${routePrefix}/ride/chat?admin=true&role=user`, {
      state: initialDraft ? { initialDraft } : undefined,
    });
  };

  const quickActions = [
    {
      title: 'Live chat',
      subtitle: 'Get quick help',
      Icon: MessageCircle,
      iconClass: 'text-brand',
      onClick: () => openSupportChat(),
    },
    {
      title: 'Call support',
      subtitle: 'Talk to us',
      Icon: Phone,
      iconClass: 'text-blue-500',
      onClick: handleCall,
    },
    {
      title: 'Emergency SOS',
      subtitle: 'Get safety help fast',
      Icon: Siren,
      iconClass: 'text-rose-500',
      onClick: () => navigate(`${routePrefix}/safety/sos`),
    },
  ];

  return (
    <div className="relative flex min-h-screen max-w-lg mx-auto flex-col overflow-hidden bg-surface-page pb-24 font-sans text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-surface shadow-soft">
        <div className="flex items-center gap-3 px-5 py-4">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Back"
            onClick={() => navigate(-1)}
            className="h-9 w-9 px-0"
          >
            <ArrowLeft size={18} strokeWidth={2.6} />
          </Button>
          <div className="min-w-0">
            <p className="text-3xs font-black uppercase tracking-[0.26em] text-ink-faint">Support</p>
            <h1 className="mt-1 truncate text-[18px] font-black leading-none tracking-tight text-ink">
              Help &amp; Support
            </h1>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex-1 space-y-5 px-5 pt-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {quickActions.map((action) => (
            <Card
              key={action.title}
              role="button"
              tabIndex={0}
              onClick={action.onClick}
              onKeyDown={(event) => {
                if (event.key === 'Enter') action.onClick();
              }}
              className="cursor-pointer text-left transition-transform active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-surface-sunken">
                  <action.Icon size={20} strokeWidth={2.4} className={action.iconClass} />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-black leading-tight text-ink">{action.title}</div>
                  <div className="mt-0.5 truncate text-[11px] font-bold text-ink-faint">{action.subtitle}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div>
          <h3 className="mb-3 ml-1 text-2xs font-black uppercase tracking-[0.26em] text-ink-faint">
            Choose a topic
          </h3>
          <div className="space-y-2.5">
            {helpTopics.map((topic) => (
              <Card
                key={topic.title}
                role="button"
                tabIndex={0}
                onClick={() => openSupportChat(topic.title)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') openSupportChat(topic.title);
                }}
                className="flex cursor-pointer items-center justify-between gap-3 p-3.5 text-left transition-transform active:scale-[0.99]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-surface-sunken">
                    <topic.Icon size={18} strokeWidth={2.4} className={topic.iconClass} />
                  </div>
                  <span className="truncate text-sm font-black tracking-tight text-ink">{topic.title}</span>
                </div>
                <ChevronRight size={16} strokeWidth={2.8} className="shrink-0 text-ink-faint" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Support;
