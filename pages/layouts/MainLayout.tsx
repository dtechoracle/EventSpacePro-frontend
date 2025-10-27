import Head from "next/head";
import Sidebar from "../(components)/Sidebar";
import { instrumentSans } from "@/helpers/fonts";
import AiTrigger from "../(components)/AiTrigger";

interface LayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <>
      <Head>
        <title>EventSpacePro Dashboard</title>
      </Head>

      <div className="h-screen flex overflow-hidden">
        <Sidebar />

        <main
          className={`flex-1 overflow-hidden pt-4 ${instrumentSans.className}`}
        >
          {children}
        <AiTrigger />
        </main>
      </div>
    </>
  );
};

export default MainLayout;

