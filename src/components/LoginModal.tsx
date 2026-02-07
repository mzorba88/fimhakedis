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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Lock, User } from 'lucide-react';
import formanLogo from '@/assets/forman-logo.png';

// Role passwords - in production, these should be environment variables or stored securely
const ROLE_PASSWORDS: Record<UserRole, string> = {
  'saha_sorumlusu': 'Beton2026',
  'direktor': 'Celik2026',
  'muhasebe': 'Finans2026',
};

interface LoginModalProps {
  isOpen: boolean;
  onLogin: (role: UserRole) => void;
}

export function LoginModal({ isOpen, onLogin }: LoginModalProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole | ''>('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (!selectedRole) {
      setError('Lütfen bir rol seçin');
      return;
    }

    if (password === ROLE_PASSWORDS[selectedRole]) {
      setError('');
      setPassword('');
      onLogin(selectedRole);
    } else {
      setError('Hatalı şifre');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="items-center">
          <img src={formanLogo} alt="Forman Logo" className="h-16 w-auto mb-4" />
          <DialogTitle className="text-xl">Hakediş Yönetim Sistemi</DialogTitle>
          <DialogDescription>
            Devam etmek için rol seçin ve şifrenizi girin
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Rol Seçin
            </label>
            <Select 
              value={selectedRole} 
              onValueChange={(value) => {
                setSelectedRole(value as UserRole);
                setError('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Rol seçin..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="saha_sorumlusu">
                  {roleLabels['saha_sorumlusu']}
                </SelectItem>
                <SelectItem value="direktor">
                  {roleLabels['direktor']}
                </SelectItem>
                <SelectItem value="muhasebe">
                  {roleLabels['muhasebe']}
                </SelectItem>
              </SelectContent>
            </Select>
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
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              onKeyDown={handleKeyDown}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}

          <Button 
            className="w-full" 
            onClick={handleLogin}
            disabled={!selectedRole || !password}
          >
            Giriş Yap
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ROLE_PASSWORDS };
