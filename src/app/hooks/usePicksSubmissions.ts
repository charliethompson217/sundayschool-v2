import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface UsePicksSubmissionsConfig<T> {
  queryKey: string;
  year: number;
  getFn: (year: number) => Promise<Record<number, T>>;
  submitFn: (year: number, seasonType: number, week: number, submission: T) => Promise<void>;
}

export function usePicksSubmissions<T>({ queryKey, year, getFn, submitFn }: UsePicksSubmissionsConfig<T>) {
  const queryClient = useQueryClient();
  const fullQueryKey = [queryKey, year] as const;

  const query = useQuery({
    queryKey: fullQueryKey,
    queryFn: () => getFn(year),
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
      submission: T;
    }) => submitFn(year, seasonType, week, submission),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fullQueryKey });
    },
  });

  return {
    submissions: query.data ?? ({} as Record<number, T>),
    isLoadingSubmissions: query.isLoading,
    submitPicks: (year: number, seasonType: number, week: number, submission: T) =>
      mutation.mutateAsync({ year, seasonType, week, submission }),
    isSubmitting: mutation.isPending,
  };
}
