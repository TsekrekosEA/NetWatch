import { useState, useEffect, useRef } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import { Dashboard } from '../../pages/Dashboard';
import Alerts from '../../pages/Alerts';
import Threats from '../../pages/Threats';
import Analytics from '../../pages/Analytics';
import SettingsPage from '../../pages/Settings';
import { useAlertStream } from '../../hooks/useAlertStream';
import { useStats } from '../../hooks/useStats';
import { API_URL } from '../../api/client';

/**
 * Main dashboard layout with sidebar navigation and header
 * Provides responsive design with collapsible sidebar on mobile
 */
export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activePath, setActivePath] = useState('/dashboard');
  const { alerts, liveStats, connected } = useAlertStream();
  const { summary, health, loading } = useStats(30_000, 10);
  const exitArtifactsSavedRef = useRef(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  const handleNavigate = (path: string) => {
    setActivePath(path);
  };

  const saveSessionArtifacts = () => {
    if (exitArtifactsSavedRef.current) return;
    exitArtifactsSavedRef.current = true;
    const url = `${API_URL}/session/export`;
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(url, '');
      return;
    }

    void fetch(url, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: '',
    }).catch(() => {});
  };

  useEffect(() => {
    function onNav(e: Event) {
      const detail = (e as CustomEvent).detail as { path?: string } | undefined;
      if (detail?.path) setActivePath(detail.path);
    }
    window.addEventListener('navigate-to', onNav as EventListener);
    return () => window.removeEventListener('navigate-to', onNav as EventListener);
  }, []);

  useEffect(() => {
    const handlePageHide = () => saveSessionArtifacts();
    const handleBeforeUnload = () => saveSessionArtifacts();

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const renderContent = () => {
    switch (activePath) {
      case '/alerts':
        return <Alerts />;
      case '/threats':
        return <Threats />;
      case '/analytics':
        return <Analytics />;
      case '/settings':
        return <SettingsPage />;
      case '/dashboard':
      default:
        return <Dashboard alerts={alerts} liveStats={liveStats} connected={connected} summary={summary} health={health} loading={loading} />;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-dark-text flex flex-col">
      {/* Compact live strip */}
      <div className="border-b border-dark-border bg-dark-surface px-4 py-2 md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse bg-threat-low" />
            <span>{connected ? 'Live traffic connected' : 'Live traffic reconnecting'}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Alerts: <span className="text-white">{alerts.length}</span></span>
            <span>Flow/min: <span className="text-white">{liveStats.flows_last_minute}</span></span>
            <button
              onClick={toggleMobileMenu}
              className="md:hidden border border-dark-border bg-dark-surface_2 px-3 py-1 text-slate-200"
              aria-label="Open navigation"
            >
              Menu
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Desktop */}
        <div className="relative hidden md:block">
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: 240 }}
                exit={{ width: 0 }}
                transition={{ duration: 0.3 }}
                className="border-r border-dark-border bg-dark-surface overflow-hidden"
              >
                <Sidebar 
                  isCollapsed={false}
                  onNavigate={handleNavigate}
                  activePath={activePath}
                  alertCount={alerts.length}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapse/Expand Button */}
          <button
            onClick={toggleSidebar}
            className="absolute top-0 right-0 z-20 border border-dark-border bg-dark-surface p-2 transition-colors hover:bg-dark-surface_2"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto flex flex-col">
          {/* Mobile Sidebar */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, x: -240 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -240 }}
                transition={{ duration: 0.3 }}
                className="md:hidden fixed inset-0 top-16 z-40 bg-dark-surface border-r border-dark-border w-64 overflow-y-auto"
              >
                <Sidebar 
                  isCollapsed={false}
                  onNavigate={(p) => { setMobileMenuOpen(false); handleNavigate(p); }}
                  activePath={activePath}
                  alertCount={alerts.length}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile Overlay */}
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden fixed inset-0 top-12 bg-[rgba(34,34,34,0.5)] z-30"
            />
          )}

          {/* Page Content */}
          <div className="flex-1 overflow-auto p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="max-w-7xl mx-auto h-full"
            >
              {renderContent()}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
