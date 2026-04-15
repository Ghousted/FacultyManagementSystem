import Header from './Header';

const Layout = ({ children }) => {
  return (
    <div className="">
      <Header />
      <main className="pt-20">
        <div className="max-w-7xl mx-auto p-4">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
