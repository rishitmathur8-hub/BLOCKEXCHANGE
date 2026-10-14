import React from 'react';
import { useNavigate } from 'react-router-dom';
import { NewRequestForm } from '@/components/request/NewRequestForm';

export const NewRequestPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div>
      <NewRequestForm onSuccess={() => navigate('/timeline')} />
    </div>
  );
};
