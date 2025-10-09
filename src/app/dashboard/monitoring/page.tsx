import { Metadata } from 'next';
import MonitoringDashboard from '@/components/monitoring/MonitoringDashboard';

export const metadata: Metadata = {
  title: 'System Monitoring | Intelligent Bid System',
  description: 'Monitor system health, metrics, and alerts for the intelligent bid system',
};

export default function MonitoringPage() {
  return (
    <div className="container mx-auto py-6">
      <MonitoringDashboard />
    </div>
  );
}