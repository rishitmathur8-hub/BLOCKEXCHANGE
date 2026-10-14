import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { MergeSuggestions } from '@/components/merge/MergeSuggestions';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { useNavigate } from 'react-router-dom';

export const MergeSuggestionsPage: React.FC = () => {
  const navigate = useNavigate();

  const {
    data: proposals = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['merge-proposals'],
    queryFn: () => api.getMergeProposals(),
  });

  if (isLoading) {
    return <LoadingState message="Evaluating Merge Candidates..." subMessage="Checking spatial track kilometer overlap and common time windows." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Merge Proposal Evaluation Error"
        message={(error as Error)?.message || 'Failed to query merge proposals from backend.'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div>
      <MergeSuggestions
        proposals={proposals}
        onActionSuccess={() => refetch()}
        onModifySlot={(blockId) => navigate(`/delay-cost?blockId=${blockId}`)}
      />
    </div>
  );
};
