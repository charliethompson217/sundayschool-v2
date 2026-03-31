import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getRegularSeasonPicksSubmissions, submitRegularSeasonPicks } from '@/app/API/functions';
import type { RegularSeasonPicksSubmission } from '@/types/global';

export const REGULAR_SEASON_SUBMISSIONS_QUERY_KEY = ['regularSeasonPicksSubmissions'] as const;

export function useRegularSeasonPicksSubmissions() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: REGULAR_SEASON_SUBMISSIONS_QUERY_KEY,
    queryFn: getRegularSeasonPicksSubmissions,
  });

  const mutation = useMutation({
    mutationFn: ({ week, submission }: { week: number; submission: RegularSeasonPicksSubmission }) =>
      submitRegularSeasonPicks(week, submission),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REGULAR_SEASON_SUBMISSIONS_QUERY_KEY });
    },
  });

  return {
    submissions: query.data ?? {},
    isLoadingSubmissions: query.isLoading,
    submitPicks: (week: number, submission: RegularSeasonPicksSubmission) => mutation.mutateAsync({ week, submission }),
    isSubmitting: mutation.isPending,
  };
}
