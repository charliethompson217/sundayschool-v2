import { getPlayOffsPicksSubmissions, submitPlayOffsPicks } from '@/app/API/submissionFunctions';
import type { PlayOffsPicksSubmission } from '@/types/submissions';

import { usePicksSubmissions } from './usePicksSubmissions';

export function usePlayOffsPicksSubmissions(year: number) {
  return usePicksSubmissions<PlayOffsPicksSubmission>({
    queryKey: 'playOffsPicksSubmissions',
    year,
    getFn: getPlayOffsPicksSubmissions,
    submitFn: submitPlayOffsPicks,
  });
}
