import { AccountConnector } from '@/components/social/account-connector';

export const metadata = { title: 'SignSocial — Accounts' };

export default function SocialAccountsPage() {
  return (
    <div className="p-6">
      <AccountConnector />
    </div>
  );
}
