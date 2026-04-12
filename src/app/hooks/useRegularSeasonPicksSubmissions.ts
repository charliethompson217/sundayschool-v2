import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getRegularSeasonPicksSubmissions, submitRegularSeasonPicks } from '@/app/API/submissionFunctions';
import type { RegularSeasonPicksSubmission } from '@/types/submissions';

export const REGULAR_SEASON_SUBMISSIONS_QUERY_KEY = 'regularSeasonPicksSubmissions';

export function useRegularSeasonPicksSubmissions(year: number) {
  const queryClient = useQueryClient();
  const queryKey = [REGULAR_SEASON_SUBMISSIONS_QUERY_KEY, year] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => getRegularSeasonPicksSubmissions(year),
  });

  const mutation = useMutation({
    mutationFn: ({
      year,
      seasonType,
      week,
      submission,
    }: {
      year: number;
      seasonType: number;
      week: number;
      submission: RegularSeasonPicksSubmission;
    }) => submitRegularSeasonPicks(year, seasonType, week, submission),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    submissions: query.data ?? {},
    isLoadingSubmissions: query.isLoading,
    submitPicks: (year: number, seasonType: number, week: number, submission: RegularSeasonPicksSubmission) =>
      mutation.mutateAsync({ year, seasonType, week, submission }),
    isSubmitting: mutation.isPending,
  };
}
