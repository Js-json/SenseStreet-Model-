import React from 'react';
import { Link } from 'react-router-dom';
import { Radar, Map, BarChart3, FileWarning, ChevronRight, Shield, Wifi, Smartphone, Zap } from 'lucide-react';

const features = [
  {
    icon: Smartphone,
    title: 'Sensor Detection',
    desc: 'Uses accelerometer, gyroscope & GPS to auto-detect road hazards.',
    color: '#18181b',
  },
  {
    icon: Map,
    title: 'Live Hazard Map',
    desc: 'Community-driven map showing potholes, crashes & braking events.',
    color: '#18181b',
  },
  {
    icon: Shield,
    title: 'Safety Score',
    desc: 'AI-powered road safety scoring for your routes and areas.',
    color: '#10b981',
  },
  {
    icon: Zap,
    title: 'Real-time Alerts',
    desc: 'Instant notifications when hazards are detected on your route.',
    color: '#f59e0b',
  },
];

const navLinks = [
  { to: '/scan', icon: Radar, label: 'Start Road Scan', desc: 'Activate sensors and begin detection', primary: true },
  { to: '/map', icon: Map, label: 'View Hazard Map', desc: 'See community-reported hazards' },
  { to: '/dashboard', icon: BarChart3, label: 'Dashboard', desc: 'Analytics and safety insights' },
  { to: '/report', icon: FileWarning, label: 'Report Hazard', desc: 'Manually report a road hazard' },
];

export default function Home() {
  return (
    <div className="page-container has-bottom-nav">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      <div className="page-content">
        {/* Hero */}
        <div className="text-center pt-12 pb-10 md:pt-20 md:pb-14">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 flex items-center justify-center shadow-md">
              <Radar size={28} className="text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 text-zinc-900">
            SenseStreet
          </h1>
          <p className="text-lg md:text-xl text-zinc-600 max-w-xl mx-auto font-light leading-relaxed">
            Smart Road Safety Network — Detect hazards, protect communities, and make every road safer.
          </p>

          <div className="flex items-center justify-center gap-2 mt-6">
            <div className="pulse-dot" />
            <span className="text-xs font-medium text-emerald-700 tracking-wide uppercase">System Active</span>
          </div>
        </div>

        {/* Nav Actions */}
        <div className="grid gap-3 max-w-lg mx-auto mb-14">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={link.primary ? 'btn-primary w-full justify-between py-4 px-6 text-base' : 'btn-secondary w-full justify-between py-4 px-6'}
              >
                <div className="flex items-center gap-3">
                  <Icon size={20} />
                  <div className="text-left">
                    <div className="font-semibold">{link.label}</div>
                    <div className="text-xs opacity-60 font-normal">{link.desc}</div>
                  </div>
                </div>
                <ChevronRight size={18} className="opacity-50" />
              </Link>
            );
          })}
        </div>

        {/* Features */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-sm font-bold text-zinc-500 uppercase tracking-widest mb-8">
            How It Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="glass-card p-6">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `${f.color}18` }}
                  >
                    <Icon size={22} color={f.color} />
                  </div>
                  <h3 className="font-bold text-base mb-1">{f.title}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-16 pb-4">
          <p className="text-xs text-zinc-400">
            SenseStreet v1.0 · Powered by smartphone sensors · Built for safer roads
          </p>
        </div>
      </div>
    </div>
  );
}
