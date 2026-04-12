import { getRegularSeasonPicksSubmissions, submitRegularSeasonPicks } from '@/app/API/submissionFunctions';
import type { RegularSeasonPicksSubmission } from '@/types/submissions';

import { usePicksSubmissions } from './usePicksSubmissions';

export function useRegularSeasonPicksSubmissions(year: number) {
  return usePicksSubmissions<RegularSeasonPicksSubmission>({
    queryKey: 'regularSeasonPicksSubmissions',
    year,
    getFn: getRegularSeasonPicksSubmissions,
    submitFn: submitRegularSeasonPicks,
  });
}
