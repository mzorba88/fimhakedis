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
  DialogFooter,
} from '@/components/ui/dialog';
import { Lock, ShieldCheck } from 'lucide-react';
import { ROLE_PASSWORDS } from './LoginModal';

interface RolePasswordDialogProps {
  isOpen: boolean;
  targetRole: UserRole | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RolePasswordDialog({ 
  isOpen, 
  targetRole, 
  onConfirm, 
  onCancel 
}: RolePasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (!targetRole) return;

    if (password === ROLE_PASSWORDS[targetRole]) {
      setError('');
      setPassword('');
      onConfirm();
    } else {
      setError('Hatalı şifre');
    }
  };

  const handleCancel = () => {
    setPassword('');
    setError('');
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <DialogTitle>Rol Değişikliği</DialogTitle>
          </div>
          <DialogDescription>
            <strong>{targetRole ? roleLabels[targetRole] : ''}</strong> rolüne geçmek için şifre girin
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Şifre
            </label>
            <Input
              type="password"
              placeholder="Rol şifresini girin..."
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            İptal
          </Button>
          <Button onClick={handleConfirm} disabled={!password}>
            Onayla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
