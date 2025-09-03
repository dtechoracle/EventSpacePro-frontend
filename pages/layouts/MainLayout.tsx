import Head from "next/head";
import Sidebar from "../(components)/Sidebar";

interface LayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <>
      <Head>
        <title>EventSpacePro Dashboard</title>
      </Head>
      <div className="h-screen flex">
        <Sidebar />
        <main className="w-full lg:w-4/5 pt-4">{children}</main>
      </div>
    </>
  );
};

export default MainLayout;
