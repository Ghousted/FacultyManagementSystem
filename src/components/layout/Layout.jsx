import Header from './Header';

const Layout = ({ children }) => {
  return (
    <div className="">
      <Header />
      <main className="pt-18">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
