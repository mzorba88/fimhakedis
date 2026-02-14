import { useState } from 'react';
import { UserRole, roleLabels } from '@/types/hakedis';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Lock, HardHat, Briefcase, Calculator, ArrowLeft } from 'lucide-react';
import formanLogo from '@/assets/forman-logo.png';

const ROLE_PASSWORDS: Record<UserRole, string> = {
  'saha_sorumlusu': 'Beton2026',
  'direktor': 'Celik2026',
  'muhasebe': 'Finans2026',
};

const roleCards: { role: UserRole; icon: typeof HardHat; description: string }[] = [
  { role: 'saha_sorumlusu', icon: HardHat, description: 'Saha işlemlerini yönet' },
  { role: 'direktor', icon: Briefcase, description: 'Onay ve yönetim işlemleri' },
  { role: 'muhasebe', icon: Calculator, description: 'Ödeme ve finansal işlemler' },
];

interface LoginModalProps {
  isOpen: boolean;
  onLogin: (role: UserRole) => void;
}

export function LoginModal({ isOpen, onLogin }: LoginModalProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (!selectedRole) return;

    if (password === ROLE_PASSWORDS[selectedRole]) {
      setError('');
      setPassword('');
      onLogin(selectedRole);
    } else {
      setError('Hatalı şifre');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  const handleBack = () => {
    setSelectedRole(null);
    setPassword('');
    setError('');
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="items-center">
          <img src={formanLogo} alt="Forman Logo" className="h-16 w-auto mb-2" />
          <DialogTitle className="text-xl">Hakediş Yönetim Sistemi</DialogTitle>
          <DialogDescription>
            {selectedRole ? 'Şifrenizi girin' : 'Devam etmek için hesabınızı seçin'}
          </DialogDescription>
        </DialogHeader>

        {!selectedRole ? (
          <div className="grid grid-cols-3 gap-3 py-4">
            {roleCards.map(({ role, icon: Icon, description }) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className="flex flex-col items-center gap-3 p-4 rounded-xl border bg-card text-center transition-all hover:border-primary hover:shadow-md hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-7 w-7" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{roleLabels[role]}</p>
                  <p className="text-xs text-muted-foreground mt-1">{description}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Geri dön
            </button>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              {(() => {
                const card = roleCards.find(c => c.role === selectedRole);
                if (!card) return null;
                const Icon = card.icon;
                return (
                  <>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{roleLabels[selectedRole]}</p>
                      <p className="text-xs text-muted-foreground">{card.description}</p>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Şifre
              </label>
              <Input
                type="password"
                placeholder="Şifrenizi girin..."
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-destructive font-medium">{error}</p>
            )}

            <Button className="w-full" onClick={handleLogin} disabled={!password}>
              Giriş Yap
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { ROLE_PASSWORDS };
