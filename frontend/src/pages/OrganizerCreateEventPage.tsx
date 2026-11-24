import React from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Wand2 } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { PageShell } from '../components/layout/PageShell';
import { Footer } from '../components/Footer';
import { EventCreatorStudio } from '../components/organizer/EventCreatorStudio';
import { useFeatures } from '../context/FeatureContext';
import { useEvents } from '../context/EventContext';
import { CreatedOrganizerEvent } from '../services/organizerService';
import { invalidateAssistantCache } from '../services/assistantService';

export const OrganizerCreateEventPage: React.FC = () => {
  const navigate = useNavigate();
  const { isEnabled, isLoading: featuresLoading } = useFeatures();
  const { refreshEvents } = useEvents();

  const consoleEnabled = isEnabled('organizer_console');

  if (featuresLoading) {
    return (
      <PageShell className="items-center justify-center">
        <div className="size-8 rounded-full border-2 border-kumo-interact border-t-violet-ink animate-spin" />
      </PageShell>
    );
  }
  if (!consoleEnabled) return <Navigate to="/" replace />;

  const handleCreated = async (created: CreatedOrganizerEvent) => {
    invalidateAssistantCache();
    await refreshEvents().catch(() => {});
    navigate('/organizer', {
      replace: true,
      state: { createdEvent: created }
    });
  };

  return (
    <PageShell>
      <Navbar />
      <main className="page-enter flex-1 max-w-page w-full mx-auto px-4 sm:px-6 lg:px-10 pt-8 pb-20">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <Link
              to="/organizer"
              className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-kumo-subtle transition-colors hover:text-kumo-strong"
            >
              <ArrowLeft className="size-4" />
              <span>Quay lại bảng điều khiển</span>
            </Link>
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet/20 text-violet-ink">
                <Wand2 className="size-5" />
              </span>
              <div>
                <h1 className="type-display text-display-md sm:text-display-lg">
                  Tạo sự kiện mới &amp; Thiết kế sân khấu
                </h1>
                <p className="mt-1 text-sm text-kumo-subtle">
                  Cấu hình thông tin đêm diễn, hình dáng sân khấu, bố cục khán đài và tự động sinh sơ đồ ghế 2D/3D.
                </p>
              </div>
            </div>
          </div>
        </div>

        <EventCreatorStudio
          standalone
          onClose={() => navigate('/organizer')}
          onCreated={handleCreated}
        />
      </main>
      <Footer />
    </PageShell>
  );
};
