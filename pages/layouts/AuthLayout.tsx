import Head from "next/head";
import Image from "next/image";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <>
      <Head>
        <title>Auth | EventSpacePro</title>
      </Head>
      <div className="h-screen w-screen flex">
        <div className="w-1/2 p-4">
          <div className="rounded-2xl bg-gradient-to-b from-[#2F2A3D] to-[#421FA0] h-full flex justify-center items-center">
            <div className="">
              <Image
                src={"/assets/mainLogoLight.svg"}
                alt="Logo"
                width={200}
                height={200}
              />
            </div>
          </div>
        </div>
        <main className="w-full lg:w-[50%] pt-4">{children}</main>
      </div>
    </>
  );
};

export default AuthLayout;
