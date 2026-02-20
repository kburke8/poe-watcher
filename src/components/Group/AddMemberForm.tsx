import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '../Shared/Button';
import { useGroupStore } from '../../stores/groupStore';

interface AddMemberFormProps {
  memberCount: number;
}

export function AddMemberForm({ memberCount }: AddMemberFormProps) {
  const [accountName, setAccountName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const { addMember } = useGroupStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = accountName.trim();
    if (!trimmed) return;

    if (memberCount >= 5) {
      setError('Maximum of 5 group members allowed');
      return;
    }

    setIsAdding(true);
    setError(null);
    try {
      await addMember({ accountName: trimmed });
      setAccountName('');
    } catch (err) {
      setError(String(err));
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <div className="flex-1">
        <input
          type="text"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder="Account name (e.g. player#0931)"
          className="w-full px-3 py-2 rounded-lg bg-[--color-surface] border border-[--color-border] text-[--color-text] text-sm focus:outline-none focus:border-[--color-poe-gold]/50"
          disabled={isAdding || memberCount >= 5}
        />
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
      <Button
        type="submit"
        variant="primary"
        size="sm"
        disabled={!accountName.trim() || isAdding || memberCount >= 5}
      >
        <UserPlus className="w-4 h-4" />
      </Button>
    </form>
  );
}
