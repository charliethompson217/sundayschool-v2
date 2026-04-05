import { useSearchParams } from 'react-router-dom';

import ScheduleWeekDetail from '@/components/Admin/ScheduleWeekDetail';
import ScheduleWeekList from '@/components/Admin/ScheduleWeekList';

// Reads `year`, `seasonType`, and `week` from URL search params.
// When `week` is present, shows the detail/edit view; otherwise shows the list.
// The filter (year + seasonType) stays in the URL so it's restored when going back.
export default function Schedule() {
  const [searchParams] = useSearchParams();
  const year = searchParams.get('year');
  const seasonType = searchParams.get('seasonType');
  const week = searchParams.get('week');

  if (year && seasonType && week) {
    return <ScheduleWeekDetail year={year} seasonType={seasonType} week={week} />;
  }

  return <ScheduleWeekList />;
}
