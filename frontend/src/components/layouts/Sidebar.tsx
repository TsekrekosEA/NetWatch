import React from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Globe,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  badge?: number;
  color?: string;
}

interface SidebarProps {
  isCollapsed?: boolean;
  onNavigate?: (path: string) => void;
  activePath?: string;
  alertCount?: number;
}

/**
 * Navigation sidebar with threat-aware indicators
 * Shows real-time alert counts and system status
 */
export default function Sidebar({ isCollapsed = false, onNavigate, activePath = '/dashboard', alertCount = 0 }: SidebarProps) {

  const navItems: NavItem[] = [
    {
      icon: <Activity className="w-5 h-5" />,
      label: 'Overview',
      path: '/dashboard',
      color: 'text-blue-400',
    },
    {
      icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
      label: 'Alerts',
      path: '/alerts',
      badge: alertCount,
      color: 'text-red-400',
    },
    {
      icon: <Globe className="w-5 h-5" />,
      label: 'Threat Map',
      path: '/threats',
      color: 'text-orange-400',
    },
    {
      icon: <BarChart3 className="w-5 h-5" />,
      label: 'Analytics',
      path: '/analytics',
      color: 'text-green-400',
    },
  ];

  const isActive = (path: string) => activePath === path;

  return (
    <div className="flex h-full flex-col bg-dark-surface border-r border-dark-border">
      {/* Logo */}
      <div className="border-b border-dark-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center border border-dark-border bg-threat-critical font-bold text-white">
            NW
          </div>
          {!isCollapsed && (
            <div className="flex-1">
              <h1 className="text-sm font-bold text-white">NetWatch</h1>
              <p className="text-xs text-gray-400">IDS Dashboard</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 space-y-2 overflow-y-auto p-4">
        {navItems.map((item, index) => {
          const active = isActive(item.path);
          return (
            <motion.button
              key={item.path}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => {
                onNavigate?.(item.path);
              }}
              className={`group flex w-full items-center gap-3 border px-3 py-2 transition-all duration-200 ${
                active
                  ? 'border-accent bg-accent text-white'
                  : 'border-dark-border text-gray-300 hover:bg-dark-border hover:text-white'
              }`}
            >
              <div className={`${item.color || 'text-gray-400'} group-hover:scale-110 transition-transform`}>
                {item.icon}
              </div>
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left text-sm font-medium">
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className="border border-red-500 bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-300">
                      {item.badge}
                    </span>
                  )}
                  {active && (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="space-y-2 border-t border-dark-border p-4">
        <button
          className="flex w-full items-center gap-3 border border-dark-border px-3 py-2 text-gray-300 transition-all duration-200 hover:bg-dark-border hover:text-white"
          onClick={() => onNavigate?.('/settings')}
        >
          <Settings className="w-5 h-5" />
          {!isCollapsed && <span className="text-sm">Settings</span>}
        </button>



        {/* System Status */}
        {!isCollapsed && (
          <div className="mt-4 border border-dark-border bg-dark-bg p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 animate-pulse bg-green-500" />
              <span className="text-xs font-semibold text-gray-300">System Status</span>
            </div>
            <p className="text-xs text-gray-400">All systems operational</p>
          </div>
        )}
      </div>
    </div>
  );
}
