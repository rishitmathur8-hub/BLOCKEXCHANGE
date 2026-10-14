import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { BlockTimeline } from '@/components/timeline/BlockTimeline';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { useNavigate } from 'react-router-dom';

export const TimelinePage: React.FC = () => {
  const navigate = useNavigate();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['timeline-data'],
    queryFn: async () => {
      const [sections, blocks, requests] = await Promise.all([
        api.getSections().catch(() => []),
        api.getBlocksDetailed(),
        api.getRequests(),
      ]);
      return { sections, blocks, requests };
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return <LoadingState message="Rendering Corridor Timeline..." subMessage="Calculating 24-hr IST track possession spans and section boundaries." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to Render Timeline"
        message={(error as Error)?.message || 'Error communicating with backend.'}
        onRetry={() => refetch()}
      />
    );
  }

  const { sections, blocks, requests } = data || {
    sections: [],
    blocks: [],
    requests: [],
  };

  return (
    <div>
      <BlockTimeline
        sections={sections}
        blocks={blocks}
        requests={requests}
        onSelectBlock={(blockId) => navigate(`/delay-cost?blockId=${blockId}`)}
      />
    </div>
  );
};
