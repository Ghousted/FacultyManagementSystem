import { useEffect, useState } from 'react';
import {
  Archive,
  Building2,
  BookCheck,
  GraduationCap,
  HandCoins,
  Laptop,
  LayoutDashboard,
  LogOut,
  Medal,
  NotebookPen,
  PhilippinePeso,
  ScrollText,
  Settings,
  UserCheck,
  Users,
  Wallet
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const navItemsByRole = {
  admin: [
    { label: 'Dashboard', hash: '#/dashboard', icon: LayoutDashboard },

    { label: 'Student Management', hash: '#/student-management', icon: Users },
    { label: 'Faculty Management', hash: '#/faculty', icon: GraduationCap },
    { label: 'Curriculum Checker', hash: '#/curriculum-checker', icon: BookCheck },
    { label: 'Curriculum Maker', hash: '#/curriculum-maker', icon: NotebookPen },

    { label: 'Payables System', hash: '#/payables', icon: PhilippinePeso },
    { label: 'Module Payments', hash: '#/module-payments', icon: Wallet },
    { label: 'Professor Cutbacks', hash: '#/professor-cutbacks', icon: HandCoins },

    { label: 'Archived Classes', hash: '#/archived-classes', icon: Archive },

    { label: 'System Acitlvity Logs', hash: '#/logs', icon: ScrollText },
    { label: 'Settings', hash: '#/settings', icon: Settings }
  ],

  curriculum: [
    { label: 'Dashboard', hash: '#/dashboard', icon: LayoutDashboard },

    { label: 'Curriculum Maker', hash: '#/curriculum-maker', icon: NotebookPen },

    { label: 'Student Management', hash: '#/student-management', icon: Users },

    { label: 'Reports', hash: '#/deans-list-report', icon: Medal },
    { label: 'Archive Classes', hash: '#/archived-classes', icon: Archive }
  ],

  payables: [
    { label: 'Dashboard', hash: '#/dashboard', icon: LayoutDashboard },

    { label: 'Modules Payment', hash: '#/module-payments', icon: Wallet },
    { label: 'Professor Cutbacks', hash: '#/professor-cutbacks', icon: HandCoins },

  ]
};

const normalizeHash = (hash) => hash || '#/dashboard';
const isItemActive = (activeHash, itemHash) => {
  if (itemHash === '#/dashboard') return activeHash === '#/dashboard' || activeHash === '';
  return activeHash === itemHash || activeHash.startsWith(`${itemHash}/`);
};

const Sidebar = ({ onExpandedChange }) => {
  const { role, signout } = useAuth();
  const [activeHash, setActiveHash] = useState(normalizeHash(window.location.hash));
  const [isDesktopExpanded, setIsDesktopExpanded] = useState(false);
  const navItems = navItemsByRole[role] || [];

  const setDesktopExpanded = (expanded) => {
    setIsDesktopExpanded(expanded);
    onExpandedChange?.(expanded);
  };

  useEffect(() => {
    const handleHashChange = () => setActiveHash(normalizeHash(window.location.hash));
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    return () => onExpandedChange?.(false);
  }, [onExpandedChange]);

  const handleNavigate = (hash) => {
    window.location.hash = hash;
    if (hash === '#/dashboard') {
      window.dispatchEvent(new CustomEvent('go-dashboard'));
    }
  };

  const handleSignOut = async () => {
    try {
      await signout();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const renderNavButton = (item) => {
    const Icon = item.icon;
    const isActive = isItemActive(activeHash, item.hash);

    return (
      <button
        key={item.hash}
        type="button"
        onClick={() => handleNavigate(item.hash)}
        title={item.label}
        className={`flex h-11 w-auto shrink-0 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition md:w-full ${
          isActive
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className={`whitespace-nowrap transition-opacity duration-200 md:opacity-0 ${isDesktopExpanded ? 'md:opacity-100' : ''}`}>
          {item.label}
        </span>
      </button>
    );
  };

  if (!navItems.length) return null;

  return (
    <>
      <aside
        className={`fixed bottom-0 left-0 top-16 z-30 hidden border-r border-gray-200 bg-white shadow-sm transition-all duration-200 ease-out md:flex md:flex-col ${
          isDesktopExpanded ? 'w-72' : 'w-20'
        }`}
        onMouseEnter={() => setDesktopExpanded(true)}
        onMouseLeave={() => setDesktopExpanded(false)}
        onFocus={() => setDesktopExpanded(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setDesktopExpanded(false);
          }
        }}
      >
        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-3">
          {navItems.map(renderNavButton)}
        </nav>

        <div className="border-t border-gray-200 p-3">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
            title="Log out"
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className={`whitespace-nowrap opacity-0 transition-opacity duration-200 ${isDesktopExpanded ? 'opacity-100' : ''}`}>
              Log out
            </span>
          </button>
        </div>
      </aside>

      <aside className="fixed left-0 right-0 top-16 z-30 border-b border-gray-200 bg-white md:hidden">
        <nav className="flex gap-2 overflow-x-auto px-4 py-3">
          {navItems.map(renderNavButton)}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="whitespace-nowrap">Log out</span>
          </button>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
