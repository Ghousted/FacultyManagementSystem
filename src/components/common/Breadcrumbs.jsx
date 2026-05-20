import { ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const getRoleDashboardHash = () => '#/dashboard';

export const goToRoleDashboard = (role) => {
  window.location.hash = getRoleDashboardHash(role);
  window.dispatchEvent(new CustomEvent('go-dashboard', { detail: { role } }));
};

const Breadcrumbs = ({ items = [], className = 'mb-3' }) => {
  const { role } = useAuth();
  const crumbs = [
    { label: 'Dashboard', onClick: () => goToRoleDashboard(role) },
    ...items
  ];

  return (
    <nav className={`${className} flex flex-wrap items-center gap-1.5 text-sm`}>
      {crumbs.map((crumb, index) => {
        const isActive = index === crumbs.length - 1;
        const contentClass = isActive
          ? 'font-medium text-blue-500'
          : 'text-slate-500 hover:underline';

        return (
          <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1.5">
            {crumb.onClick && !isActive ? (
              <button type="button" onClick={crumb.onClick} className={`${contentClass} cursor-pointer`}>
                {crumb.label}
              </button>
            ) : (
              <span className={contentClass}>{crumb.label}</span>
            )}
            {index < crumbs.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" />}
          </span>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
