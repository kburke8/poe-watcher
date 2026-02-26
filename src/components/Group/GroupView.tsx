import { useEffect } from 'react';
import { Users } from 'lucide-react';
import { useGroupStore } from '../../stores/groupStore';
import { HelpTip } from '../Shared/HelpTip';
import { GroupMemberCard } from './GroupMemberCard';
import { AddMemberForm } from './AddMemberForm';
import { GroupRunHistory } from './GroupRunHistory';

export function GroupView() {
  const { members, loadMembers } = useGroupStore();

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[--color-text] flex items-center gap-2">
          <Users className="w-6 h-6" />
          Group Mode
          <HelpTip>
            Track up to 5 party members during group speedruns. Each member's progress is tracked independently. Enable Group Mode in Settings first, then add members here.
          </HelpTip>
        </h1>
        <p className="text-[--color-text-muted] mt-1">
          Manage party members and view group run history
        </p>
      </div>

      <div className="flex-1 overflow-auto space-y-6">
        {/* Group Members Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-[--color-text]">
              Party Members ({members.length}/5)
            </h2>
          </div>

          <div className="space-y-2 mb-3">
            {members.map((member) => (
              <GroupMemberCard key={member.id} member={member} />
            ))}
          </div>

          <AddMemberForm memberCount={members.length} />

          {members.length > 0 && (
            <p className="text-xs text-[--color-text-muted] mt-3">
              Characters are auto-detected when you enter The Coast during a group run, or you can set them manually.
            </p>
          )}
        </section>

        {/* Group Run History Section */}
        <section>
          <GroupRunHistory />
        </section>
      </div>
    </div>
  );
}
