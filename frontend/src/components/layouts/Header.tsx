import React from 'react';
import { Menu, Search, Bell, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

interface HeaderProps {
  onMenuClick?: () => void;
  isMobileMenuOpen?: boolean;
}

/**
 * Application header with branding, search, and notifications
 * Professional monitoring tool aesthetic with threat indicators
 */
export default function Header({ onMenuClick, isMobileMenuOpen }: HeaderProps) {
  const [hasNotifications] = React.useState(true);

  return (
    <header className="border-b border-dark-border bg-dark-surface px-4 py-3 md:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Logo & Brand */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          {/* Mobile Menu Button */}
          <button
            onClick={onMenuClick}
            className="border border-dark-border p-1 transition-colors hover:bg-dark-border md:hidden"
            aria-label="Toggle menu"
          >
            <Menu className={`w-5 h-5 transition-transform ${isMobileMenuOpen ? 'rotate-90' : ''}`} />
          </button>

          {/* Branding */}
          <div className="flex items-center gap-2">
            <div className="hidden h-8 w-8 items-center justify-center border border-dark-border bg-threat-critical font-bold text-white md:flex">
              NW
            </div>
            <div>
              <h1 className="text-lg font-bold text-white hidden md:block">NetWatch</h1>
              <p className="text-xs text-gray-400 hidden md:block">Network Anomaly Detection</p>
            </div>
          </div>
        </motion.div>

        {/* Center: Status Indicators */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="hidden lg:flex items-center gap-6 text-sm"
        >
          <div className="flex items-center gap-2 border border-dark-border bg-dark-surface px-3 py-1">
            <div className="w-2 h-2 bg-green-500 animate-pulse" />
            <span className="text-gray-400">Live Monitoring</span>
          </div>

          <div className="text-center">
            <p className="text-gray-400">Threats Detected</p>
            <p className="text-lg font-bold text-red-500">12</p>
          </div>

          <div className="text-center">
            <p className="text-gray-400">Detection Rate</p>
            <p className="text-lg font-bold text-green-500">94.2%</p>
          </div>
        </motion.div>

        {/* Right: Actions */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 md:gap-3"
        >
          {/* Search */}
          <div className="hidden items-center gap-2 border border-dark-border bg-dark-surface px-3 py-1.5 transition-colors hover:border-accent/50 md:flex">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search alerts..."
              className="bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none w-32"
            />
          </div>

          {/* Notifications */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative border border-dark-border p-2 transition-colors hover:bg-dark-border"
          >
            <Bell className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
            {hasNotifications && (
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute top-1 right-1 w-2 h-2 bg-red-500"
              />
            )}
          </motion.button>

          {/* Settings */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="border border-dark-border p-2 transition-colors hover:bg-dark-border"
          >
            <Settings className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
          </motion.button>

          {/* User Profile */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="ml-2 flex h-8 w-8 items-center justify-center border border-blue-500 bg-blue-600 text-white font-bold cursor-pointer transition-shadow hover:shadow-lg hover:shadow-blue-500/50"
          >
            U
          </motion.div>
        </motion.div>
      </div>
    </header>
  );
}
