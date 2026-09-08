import React from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import AdminScreen from './components/AdminScreen';
import BombScreen from './components/BombScreen';
import { Bomb, Tv, Smartphone } from 'lucide-react';
import './App.css';

function HomeSelector() {
  return (
    <div className="home-selector-container">
      <div className="home-card glass-card text-center">
        <Bomb size={64} className="text-red margin-bottom-sm" />
        <h1 className="home-title">OVERCLOCKED</h1>
        <p className="home-subtitle">COLLEGE TECH FEST COMPETITION APP</p>

        <div className="routes-grid margin-top-lg">
          <Link to="/admin" className="route-select-card admin-mode">
            <Tv size={36} className="text-cyan" />
            <div className="mode-title">ADMIN / PROJECTOR VIEW</div>
            <div className="mode-desc">Host controls, question builder, live countdown projector display & leaderboard.</div>
            <span className="btn btn-cyan btn-sm margin-top-sm">Open /admin</span>
          </Link>

          <Link to="/bomb" className="route-select-card bomb-mode">
            <Smartphone size={36} className="text-red-light" />
            <div className="mode-title">MOBILE BOMB VIEW</div>
            <div className="mode-desc">Shown on the physical phone prop inside the bomb box. Enter join code to play.</div>
            <span className="btn btn-danger btn-sm margin-top-sm">Open /bomb</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeSelector />} />
      <Route path="/admin" element={<AdminScreen />} />
      <Route path="/bomb" element={<BombScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
