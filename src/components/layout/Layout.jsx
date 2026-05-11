import { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';

const Layout = ({ children }) => {
  const { currentUser } = useAuth();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      {currentUser && <Sidebar onExpandedChange={setSidebarExpanded} />}
      <main
        className={`transition-[padding] duration-200 ease-out ${
          currentUser
            ? sidebarExpanded
              ? 'pt-36 md:pt-20 md:pl-72'
              : 'pt-36 md:pt-20 md:pl-20'
            : 'pt-20'
        }`}
      >
        <div className="max-w-7xl mx-auto p-4">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
