import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnnouncementBar } from '../components/layout/AnnouncementBar';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { HeroSmartAnalyzer } from '../components/downloader/HeroSmartAnalyzer';
import { IdmDownloadStudio } from '../components/downloader/DownloadQueueDrawer';
import { SupportedSitesSection } from '../components/downloader/SupportedSitesSection';
import { LandingSections } from '../components/downloader/LandingSections';
import { PurposeSeoSection } from '../components/downloader/PurposeSeoSection';
import { AdSlot } from '../components/monetization/AdSlot';
import { UltraApi } from '../services/apiClient';
import { useApp } from '../context/AppContext';

function DedicatedAdsHeader() {
  return (
    <div className="w-full px-4 sm:px-8 xl:px-12 pt-4">
      <AdSlot placement="header" compact />
    </div>
  );
}

export function HomePage() {
  const [searchParams] = useSearchParams();
  const [pickedPlatform, setPickedPlatform] = useState(null);
  const { downloadQueue } = useApp();

  useEffect(() => {
    const shared = searchParams.get('url') || searchParams.get('text') || '';
    if (shared && /^https?:\/\//i.test(shared)) {
      UltraApi.silentPasteCapture(shared, 'pwa_share_target').catch(() => {});
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen w-full bg-white text-slate-900 flex flex-col">
      <AnnouncementBar />
      <Navbar />

      <main className="flex-1 w-full">
        <DedicatedAdsHeader />

        <HeroSmartAnalyzer presetPlatform={pickedPlatform} />

        {/* Live Full-Width IDM Transfer Studio Right on Homepage When Active or Populated */}
        {downloadQueue.length > 0 && (
          <section className="w-full px-4 sm:px-8 xl:px-12 py-10 bg-white border-b border-slate-200/80">
            <IdmDownloadStudio />
          </section>
        )}

        {/* Sponsored placements (real impressions/clicks only) */}
        <section className="w-full px-4 sm:px-8 xl:px-12 pt-8">
          <AdSlot placement="belowPlayer" />
        </section>

        <SupportedSitesSection onPickPlatform={(plat) => setPickedPlatform(plat)} />

        <section className="w-full px-4 sm:px-8 xl:px-12 py-6">
          <AdSlot placement="inline" />
        </section>

        {/* Always-Ready Full-Width Built-In IDM 32x Studio Showcase When Queue is Empty */}
        {downloadQueue.length === 0 && (
          <section className="w-full px-4 sm:px-8 xl:px-12 py-12 bg-white border-b border-slate-200/80">
            <IdmDownloadStudio />
          </section>
        )}

        <PurposeSeoSection />

        <LandingSections />
      </main>

      <Footer />
    </div>
  );
}
