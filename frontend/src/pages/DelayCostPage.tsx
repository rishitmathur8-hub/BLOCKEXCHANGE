import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import { DelayCostPanel } from '@/components/cost/DelayCostPanel';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';

export const DelayCostPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const paramBlockId = searchParams.get('blockId');
  const initialBlockId = paramBlockId ? Number(paramBlockId) : undefined;

  const {
    data: blocks = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['blocks-list-for-cost'],
    queryFn: () => api.getBlocksDetailed(),
  });

  if (isLoading) {
    return <LoadingState message="Loading Block Delay Options..." subMessage="Fetching corridor blocks and timetables." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Error Loading Delay Options"
        message={(error as Error)?.message || 'Failed to communicate with backend.'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div>
      <DelayCostPanel blocks={blocks} initialBlockId={initialBlockId} />
    </div>
  );
};
