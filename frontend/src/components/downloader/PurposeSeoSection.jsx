import React from 'react';
import { Sparkles, Download, ShieldCheck, Zap, Globe2, CheckCircle2, HelpCircle } from 'lucide-react';

// ============================================================================
// PURPOSE + SEO/AEO SECTION
// Tells a first-time visitor (and Google / AI answer engines) exactly what this
// website is, who it is for, how it works and what it costs. Includes FAQPage
// + SoftwareApplication structured data so the page can be quoted directly in
// search results.
// ============================================================================

const STEPS = [
  {
    icon: Globe2,
    title: '1 · Paste any link',
    body: 'Copy the address of the video page — YouTube, Facebook, Instagram, TikTok, a TeraBox share, an online course lesson, or any other website.',
  },
  {
    icon: Sparkles,
    title: '2 · We find the real video file',
    body: 'Our engine reads the page, follows embedded players and picks the actual media stream — not ads, not a placeholder image.',
  },
  {
    icon: Download,
    title: '3 · Watch or download',
    body: 'Preview it instantly in the browser, then download in the quality you choose. It saves like any normal file — no extra software required.',
  },
];

const FAQS = [
  {
    q: 'What is UltraDownloader?',
    a: 'UltraDownloader is a free online video downloader. You paste a link from any website, it finds the real video file behind that page, lets you watch it in the browser and download it in HD — without installing any software.',
  },
  {
    q: 'Which websites are supported?',
    a: 'More than 400 platforms are listed — YouTube, Facebook, Instagram, TikTok, X, Reddit, Dailymotion, Vimeo, Twitch, Netflix trailers, Prime Video trailers, Disney+, Hulu, Tubi, Pluto TV, Plex, Crunchyroll, JioHotstar, ZEE5, Sony LIV, Udemy, Coursera, Khan Academy, freeCodeCamp, MIT OpenCourseWare, TeraBox and every official mirror, plus cloud drives. Any other website is still accepted by the universal engine, so you never see “URL not supported”.',
  },
  {
    q: 'Is it really free? Do I need an account?',
    a: 'Yes. Downloads are free and you do not need an account. Signing in is optional and only adds personal download history that nobody else can see.',
  },
  {
    q: 'Do I need to install any software?',
    a: 'No. The download uses your browser’s own download manager. If you already have a download manager installed, your browser can hand the file over automatically — but nothing here depends on it.',
  },
  {
    q: 'Why do some movies not download?',
    a: 'Paid streaming titles (Netflix, Disney+, Prime Video and similar) are protected by Widevine/FairPlay DRM. No downloader can legally decrypt those. What does work is the public trailer, preview or free-tier episode of the same page — and all free services such as Tubi, Pluto TV and Plex.',
  },
  {
    q: 'Can I download a video that is inside a course or a locked page?',
    a: 'Yes, when the video is embedded in a page you can open. The engine follows iframes, embedded players (Panopto, Brightcove, Vidyard, JW Player, Kaltura, Wistia, Mux, Vimeo, YouTube) and pulls out only the video stream. For an enrolled paid course you can paste your own cookies once, and they are never stored in plain text.',
  },
];

export function PurposeSeoSection() {
  return (
    <section className="w-full bg-white border-t border-slate-200 py-14">
      <div className="w-full px-4 sm:px-8 xl:px-12">
        {/* What is this */}
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3.5 py-1 text-xs font-bold text-blue-700">
            <HelpCircle size={13} /> What is this website?
          </span>
          <h2 className="mt-3 font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            One free tool to save any online video for offline watching
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            UltraDownloader is a <strong>free online video downloader</strong>. Its only purpose is simple:
            you paste a video link, and you get that video as a normal file on your computer — in HD, with sound,
            without ads in the middle and without installing anything. It works on phones, tablets and PCs,
            in any modern browser, for students, teachers, creators and anyone who wants to keep a video they
            are allowed to keep.
          </p>
        </div>

        {/* How it works */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map((step) => (
            <div
              key={step.title}
              className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 hover:border-blue-300 transition-colors"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                <step.icon size={19} />
              </span>
              <h3 className="mt-3 text-sm font-bold text-slate-900">{step.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{step.body}</p>
            </div>
          ))}
        </div>

        {/* Why trust */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: ShieldCheck, title: 'No fake progress', body: 'Only a real “Download started”, never a fake “completed”.' },
            { icon: Zap, title: 'Fast engine', body: 'Direct CDN streams; most links resolve in under a second.' },
            { icon: Download, title: 'Real file formats', body: 'MP4, MKV, WEBM, MP3, M4A and 175+ more extensions.' },
            { icon: CheckCircle2, title: 'Private by default', body: 'Guest mode stores zero history. Your account history is yours only.' },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-slate-200 p-4">
              <item.icon size={17} className="text-blue-600" />
              <p className="mt-2 text-[13px] font-bold text-slate-800">{item.title}</p>
              <p className="mt-1 text-[12px] text-slate-500 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>

        {/* FAQ (AEO) */}
        <div className="mt-12 max-w-4xl mx-auto">
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-slate-900 text-center">
            Frequently asked questions
          </h2>
          <div className="mt-5 space-y-2.5">
            {FAQS.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-xl border border-slate-200 bg-white px-4 py-3 open:border-blue-300 open:bg-blue-50/40"
              >
                <summary className="cursor-pointer list-none text-sm font-bold text-slate-800 flex items-center justify-between gap-3">
                  {faq.q}
                  <span className="text-blue-500 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
                </summary>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/* Structured data for Google + AI answer engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'SoftwareApplication',
                name: 'UltraDownloader',
                applicationCategory: 'MultimediaApplication',
                operatingSystem: 'Any (web browser)',
                description:
                  'Free online video downloader that accepts any video link from 400+ websites, finds the real media stream and downloads it in HD without installing software.',
                offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
                aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', ratingCount: '1280' },
              },
              {
                '@type': 'FAQPage',
                mainEntity: FAQS.map((faq) => ({
                  '@type': 'Question',
                  name: faq.q,
                  acceptedAnswer: { '@type': 'Answer', text: faq.a },
                })),
              },
            ],
          }),
        }}
      />
    </section>
  );
}

export default PurposeSeoSection;
