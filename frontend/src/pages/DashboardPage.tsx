import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { MetricsGrid } from '@/components/dashboard/MetricsGrid';
import { MergeSavingsChart } from '@/components/dashboard/MergeSavingsChart';
import { RecentBlocksTable } from '@/components/dashboard/RecentBlocksTable';
import { OpenRequestsTable } from '@/components/dashboard/OpenRequestsTable';
import { TrainsTable } from '@/components/dashboard/TrainsTable';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { useNavigate } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard-data'],
    queryFn: async () => {
      const [trains, requests, blocks, proposals] = await Promise.all([
        api.getTrains(),
        api.getRequests(),
        api.getBlocksDetailed(),
        api.getMergeProposals().catch(() => []),
      ]);
      return { trains, requests, blocks, proposals };
    },
    refetchInterval: 30000, // 30s auto-refresh
  });

  if (isLoading) {
    return <LoadingState message="Connecting to Indian Railways Operating System..." subMessage="Syncing active section blocks, trains timetable, and pending requisitions." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to Sync Corridor State"
        message={(error as Error)?.message || 'Could not connect to FastAPI server at http://127.0.0.1:8000.'}
        onRetry={() => refetch()}
      />
    );
  }

  const { trains, requests, blocks, proposals } = data || {
    trains: [],
    requests: [],
    blocks: [],
    proposals: [],
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <MetricsGrid blocks={blocks} requests={requests} proposals={proposals} />

      {/* Delay Impact Visual Chart */}
      <MergeSavingsChart proposals={proposals} />

      {/* Main Blocks Table */}
      <RecentBlocksTable
        blocks={blocks}
        onActionSuccess={() => refetch()}
        onViewOptions={(blockId) => navigate(`/delay-cost?blockId=${blockId}`)}
      />

      {/* Open Requisitions and Section Trains */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <OpenRequestsTable requests={requests} />
        <TrainsTable trains={trains} />
      </div>
    </div>
  );
};
