import React from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Film,
  Sparkles,
  PlayCircle,
  Gauge,
  Shield,
  Database,
  Link2,
  SearchCheck,
  Sliders,
  Download,
  Cloud,
  ArrowRight,
} from 'lucide-react';
import { MotionReveal, SectionHeading, AccordionItem } from '../ui/Primitives';

const POPULAR_FEATURES = [
  {
    title: '120+ Platforms & Mirrors',
    desc: 'Social, Movies, Courses and TeraBox & Cloud adapters — 120+ supported sites with distinct icons.',
    icon: Layers,
    color: 'text-blue-600 bg-blue-50 border border-blue-200',
  },
  {
    title: 'Blazing Fast Downloads',
    desc: 'Multi-part transfer engine with an optional speed limit, plus one-click hand-off to Internet Download Manager.',
    icon: Gauge,
    color: 'text-emerald-600 bg-emerald-50 border border-emerald-200',
  },
  {
    title: '100% Free TeraBox & iTeraPlay',
    desc: 'Play & download full-length videos from terabox.app, iteraplay.com, teraviralhub.com & 30+ mirrors free.',
    icon: Cloud,
    color: 'text-sky-600 bg-sky-50 border border-sky-200',
  },
  {
    title: 'Choose Your Quality',
    desc: 'Pick Video + Sound (8K/4K/1080p MP4), Video Only (muted), or real MP3 / M4A audio.',
    icon: Film,
    color: 'text-indigo-600 bg-indigo-50 border border-indigo-200',
  },
  {
    title: 'Built-in HLS + MP4 Player',
    desc: 'Adaptive Hls.js + HTML5 cinema player streams full movies inside your browser before saving.',
    icon: PlayCircle,
    color: 'text-violet-600 bg-violet-50 border border-violet-200',
  },
  {
    title: 'Works On Blocked Networks',
    desc: 'Smart secure-DNS and proxy options help you reach links that are restricted by your internet provider.',
    icon: Shield,
    color: 'text-amber-600 bg-amber-50 border border-amber-200',
  },
  {
    title: 'Private Personal History',
    desc: 'Sign in to keep your own downloadable list per account. Logged-out visitors are never tracked.',
    icon: Database,
    color: 'text-teal-600 bg-teal-50 border border-teal-200',
  },
  {
    title: 'Pause, Resume & Rename',
    desc: 'Resumable transfers and full Unicode file names for Urdu, Arabic, Hindi and global titles.',
    icon: Sparkles,
    color: 'text-rose-600 bg-rose-50 border border-rose-200',
  },
];

const HOW_STEPS = [
  {
    step: '01',
    title: 'Paste Any URL or Search',
    desc: 'Paste TeraBox, YouTube, Social Reels, Movies, Course lectures, or direct MP4 links into the bar.',
    icon: Link2,
  },
  {
    step: '02',
    title: 'Watch Live in Browser',
    desc: 'Our extractor unlocks direct CDN & HLS streams instantly inside the built-in cinema player.',
    icon: SearchCheck,
  },
  {
    step: '03',
    title: 'Pick Quality & Speed Mode',
    desc: 'Select any real MP4 quality or MP3 / M4A audio — at full speed or with a speed limit you choose.',
    icon: Sliders,
  },
  {
    step: '04',
    title: 'One-click normal download',
    desc: 'Download directly to your PC Downloads folder or launch straight inside Windows Internet Download Manager.',
    icon: Download,
  },
];

const TERABOX_SUITE = [
  {
    badge: 'TeraBox Native Free',
    domain: 'terabox.app & 1024tera.com',
    borderColor: 'border-blue-200 hover:border-blue-500 bg-blue-50/40',
    points: ['Full-length movie downloads', 'No paid key required', 'Single fast MP4 file output'],
    slug: 'terabox-app-video-downloader',
  },
  {
    badge: 'iTeraPlay Unwrapper',
    domain: 'iteraplay.com Links Free',
    borderColor: 'border-indigo-200 hover:border-indigo-500 bg-indigo-50/40',
    points: ['Unwraps ?url= wrapper links directly', 'Instant browser HLS VOD stream', 'One-click MP4 & IDM.exe export'],
    slug: 'iteraplay-free-video-downloader',
  },
  {
    badge: 'TeraViralHub Core',
    domain: 'teraviralhub.com & Shares',
    borderColor: 'border-emerald-200 hover:border-emerald-500 bg-emerald-50/40',
    points: ['Direct surl & folder extraction', 'Watch full video before saving', 'Zero TeraBox app installation'],
    slug: 'teraviralhub-video-downloader',
  },
  {
    badge: '32+ Cloud Mirrors',
    domain: 'mirrobox · nephobox · momerybox',
    borderColor: 'border-sky-200 hover:border-sky-500 bg-sky-50/40',
    points: ['Auto-heals ww.mirrobox.com typos', '4funbox, freeterabox, tibibox', 'Pixeldrain, GoFile, MediaFire & Drive'],
    slug: 'mirrobox-video-downloader',
  },
];

const FAQS = [
  {
    q: 'How fast are the downloads?',
    a: 'Downloads run at the maximum speed your internet connection allows. The file is streamed straight to your device, and you can hand it over to Internet Download Manager in one click if you prefer managing it there.',
  },
  {
    q: 'Can I limit the download speed when others are using my Wi-Fi?',
    a: 'Yes. Open Speed Limit from the top bar and switch between Unlimited and a fixed KB/s cap (for example 500 KB/s, 2 MB/s or 10 MB/s) any time you need.',
  },
  {
    q: 'Does TeraBox, iTeraPlay, and TeraViralHub work 100% free without paid keys?',
    a: 'Yes! All 32 TeraBox & cloud mirror domains resolve shorturl tokens, browser HLS playlists, and full-length video streams completely free without any paid API key.',
  },
  {
    q: 'Is my download history private?',
    a: 'Completely. If you are not signed in, no download history is saved at all. When you sign in, your history belongs only to your account — no other user can ever see it, and you can delete any item or clean the whole list anytime.',
  },
];

export function LandingSections() {
  return (
    <div className="w-full px-4 sm:px-8 xl:px-12 py-14 space-y-20 bg-white">
      {/* 1. Full-Width 8-Card Feature Grid */}
      <MotionReveal>
        <SectionHeading
          eyebrow="Everything You Need"
          title="Engineered For Speed —"
          highlight="120+ Sites · Free TeraBox · One-Click Save"
          subtitle="A fast, clean studio to watch videos online first and save them to your device in one click — on any phone, tablet or PC."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {POPULAR_FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="bg-white border border-slate-200 hover:border-blue-400 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all"
              >
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center mb-4 ${feat.color}`}>
                  <Icon size={21} />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">{feat.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">{feat.desc}</p>
              </div>
            );
          })}
        </div>
      </MotionReveal>

      {/* 2. Full-Width TeraBox & Cloud Suite */}
      <MotionReveal>
        <div className="w-full rounded-3xl bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/50 border border-slate-200 p-6 sm:p-9 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-7">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100/80 border border-blue-200 px-3 py-1 text-xs font-bold text-blue-700 mb-2.5">
                <Cloud size={13} /> 100% Free Zero-Key Cloud Engine
              </span>
              <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900">
                TeraBox, iTeraPlay &amp; 32+ Cloud Mirror Suite
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Play full movies inside your browser or save them to your device without installing any app.
              </p>
            </div>
            <Link
              to="/tools/terabox-app-video-downloader"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-3 text-xs font-extrabold text-white shrink-0 shadow-sm"
            >
              <span>Open Free TeraPlayer</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TERABOX_SUITE.map((svc) => (
              <Link
                key={svc.badge}
                to={`/tools/${svc.slug}`}
                className={`rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-md block ${svc.borderColor}`}
              >
                <span className="text-xs font-extrabold uppercase tracking-wider text-blue-700">
                  {svc.badge}
                </span>
                <p className="text-sm font-extrabold text-slate-900 mt-1 mb-3">{svc.domain}</p>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {svc.points.map((pt) => (
                    <li key={pt} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </Link>
            ))}
          </div>
        </div>
      </MotionReveal>

      {/* 3. Full-Width 4-Step Flow */}
      <MotionReveal>
        <SectionHeading
          eyebrow="Simple 4-Step Workflow"
          title="How UltraDownloader"
          highlight="Works"
          align="center"
          subtitle="Paste a link → watch it in the browser → choose quality → save it to your device in one click."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {HOW_STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.step} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="h-10 w-10 rounded-xl bg-blue-600 text-white text-xs font-extrabold flex items-center justify-center shadow-sm">
                    {s.step}
                  </span>
                  <Icon size={20} className="text-blue-600" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">{s.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </MotionReveal>

      {/* 4. FAQ Section */}
      <MotionReveal>
        <SectionHeading
          eyebrow="Transparent Answers"
          title="Frequently Asked"
          highlight="Questions"
          align="center"
        />
        <div className="max-w-4xl mx-auto space-y-3">
          {FAQS.map((item, i) => (
            <AccordionItem key={item.q} question={item.q} answer={item.a} defaultOpen={i === 0} />
          ))}
        </div>
      </MotionReveal>

      {/* 5. Full-Width Pure White + Soft Royal Blue CTA Banner */}
      <MotionReveal>
        <div className="w-full rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 p-8 sm:p-11 text-center text-white shadow-lg">
          <h2 className="font-display font-extrabold text-2xl sm:text-4xl">
            Ready to Watch &amp; Download Anything, Anywhere?
          </h2>
          <p className="text-xs sm:text-base text-blue-100 max-w-2xl mx-auto mt-2">
            Paste any link at the top of the page, or open Settings to choose your default quality and download speed.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="inline-flex items-center gap-2 rounded-xl bg-white text-blue-700 hover:bg-blue-50 px-6 py-3 text-xs sm:text-sm font-extrabold shadow-md transition-colors"
            >
              <span>Paste a Video URL Now</span>
              <ArrowRight size={15} />
            </button>
            <Link
              to="/settings"
              className="inline-flex items-center gap-2 rounded-xl border border-white/35 bg-white/15 hover:bg-white/25 text-white px-5 py-3 text-xs sm:text-sm font-bold transition-colors"
            >
              <Sliders size={15} />
              <span>Open Download Settings</span>
            </Link>
          </div>
        </div>
      </MotionReveal>
    </div>
  );
}
