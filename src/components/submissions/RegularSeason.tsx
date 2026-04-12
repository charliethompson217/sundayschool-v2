import RegularSeasonPicksForm from '@/components/submissions/RegularSeasonPicksForm';
import { getRegularSeasonWeekMetas } from '@/app/API/scheduleFunctions';
import { useRegularSeasonPicksSubmissions } from '@/app/hooks/useRegularSeasonPicksSubmissions';
import type { RegularSeasonPicksSubmission } from '@/types/submissions';

import WeekListPage from './WeekListPage';

interface RegularSeasonProps {
  year: number;
  onSelectionChange?: (hasSelection: boolean) => void;
}

export default function RegularSeason({ year, onSelectionChange }: RegularSeasonProps) {
  const { submissions, submitPicks } = useRegularSeasonPicksSubmissions(year);

  return (
    <WeekListPage<RegularSeasonPicksSubmission>
      title="Submit Picks"
      emptyMessage="No weeks are currently open for submission."
      localStorageKey="regularSeason.showClosed"
      closedLabel="previous weeks"
      queryKey={`regularSeasonWeekMetas-${year}`}
      queryFn={() => getRegularSeasonWeekMetas(year)}
      submissions={submissions}
      submitPicks={submitPicks}
      onSelectionChange={onSelectionChange}
      renderForm={({ weekMeta, onSubmit, existingSubmission, readOnly }) => (
        <RegularSeasonPicksForm
          weekMeta={weekMeta}
          onSubmit={onSubmit}
          existingSubmission={existingSubmission}
          readOnly={readOnly}
        />
      )}
    />
  );
}
