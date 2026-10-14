import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { FieldStaffView } from '@/components/field/FieldStaffView';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';

export const FieldStaffPage: React.FC = () => {
  const {
    data: blocks = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['field-blocks'],
    queryFn: () => api.getBlocksDetailed(),
    refetchInterval: 15000,
  });

  if (isLoading) {
    return <LoadingState message="Loading Field Work Terminal..." subMessage="Checking today's assigned blocks and possession states." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Field System Sync Error"
        message={(error as Error)?.message || 'Failed to connect to backend.'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div>
      <FieldStaffView blocks={blocks} onActionSuccess={() => refetch()} />
    </div>
  );
};
