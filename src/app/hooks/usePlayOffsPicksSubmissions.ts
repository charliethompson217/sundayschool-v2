import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getPlayOffsPicksSubmissions, submitPlayOffsPicks } from '@/app/API/submissionFunctions';
import type { PlayOffsPicksSubmission } from '@/types/submissions';

export const PLAYOFFS_SUBMISSIONS_QUERY_KEY = 'playOffsPicksSubmissions';

export function usePlayOffsPicksSubmissions(year: number) {
  const queryClient = useQueryClient();
  const queryKey = [PLAYOFFS_SUBMISSIONS_QUERY_KEY, year] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => getPlayOffsPicksSubmissions(year),
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
      submission: PlayOffsPicksSubmission;
    }) => submitPlayOffsPicks(year, seasonType, week, submission),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    submissions: query.data ?? {},
    isLoadingSubmissions: query.isLoading,
    submitPicks: (year: number, seasonType: number, week: number, submission: PlayOffsPicksSubmission) =>
      mutation.mutateAsync({ year, seasonType, week, submission }),
    isSubmitting: mutation.isPending,
  };
}
