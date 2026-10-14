import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { RoleProvider } from '@/context/RoleContext';
import { AdvisoryBanner } from '@/components/common/AdvisoryBanner';
import { Header } from '@/components/common/Header';
import { Sidebar } from '@/components/common/Sidebar';
import { DashboardPage } from '@/pages/DashboardPage';
import { NewRequestPage } from '@/pages/NewRequestPage';
import { TimelinePage } from '@/pages/TimelinePage';
import { MergeSuggestionsPage } from '@/pages/MergeSuggestionsPage';
import { DelayCostPage } from '@/pages/DelayCostPage';
import { FieldStaffPage } from '@/pages/FieldStaffPage';
import { PredictionsPage } from '@/pages/PredictionsPage';
import { AuditPage } from '@/pages/AuditPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const AppContent: React.FC = () => {
  const qc = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleGlobalRefresh = async () => {
    setIsRefreshing(true);
    await qc.invalidateQueries();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-railway-950 text-slate-100 flex flex-col antialiased">
      {/* 1. Persistent Advisory Banner */}
      <AdvisoryBanner />

      {/* 2. Top Navigation Bar */}
      <Header
        onRefresh={handleGlobalRefresh}
        isRefreshing={isRefreshing}
        lastUpdated={new Date()}
      />

      {/* 3. Main Workspace Shell */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Dynamic Route Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/new-request" element={<NewRequestPage />} />
            <Route path="/timeline" element={<TimelinePage />} />
            <Route path="/merge-suggestions" element={<MergeSuggestionsPage />} />
            <Route path="/delay-cost" element={<DelayCostPage />} />
            <Route path="/field-staff" element={<FieldStaffPage />} />
            <Route path="/predictions" element={<PredictionsPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <RoleProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </RoleProvider>
    </QueryClientProvider>
  );
};

export default App;
