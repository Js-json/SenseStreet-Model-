import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Home as HomeIcon, Radar, Map, BarChart3, FileWarning } from 'lucide-react';

import Home from './pages/Home';
import Scan from './pages/Scan';
import MapPage from './pages/MapPage';
import Dashboard from './pages/Dashboard';
import Report from './pages/Report';

const navItems = [
  { to: '/', icon: HomeIcon, label: 'Home' },
  { to: '/scan', icon: Radar, label: 'Scan' },
  { to: '/map', icon: Map, label: 'Map' },
  { to: '/dashboard', icon: BarChart3, label: 'Stats' },
  { to: '/report', icon: FileWarning, label: 'Report' },
];

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/report" element={<Report />} />
      </Routes>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </Router>
  );
}
