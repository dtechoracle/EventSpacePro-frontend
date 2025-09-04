import { instrumentSans, instrumentSerif } from "@/helpers/fonts";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  const router = useRouter()
  const { pathname } = router

  return (
    <>
      <Head>
        <title>Auth | EventSpacePro</title>
      </Head>
      <div className="h-screen w-screen flex">
        <div className="w-1/2 p-4 hidden lg:block">
          <div className="rounded-2xl bg-gradient-to-b from-[#2F2A3D] to-[#421FA0] h-full flex justify-center items-center">
            <div className="flex flex-col gap-6 items-center">
              <Image
                src={"/assets/mainLogoLight.svg"}
                alt="Logo"
                width={200}
                height={200}
              />
              {pathname == "/auth/login" && <div className="flex-col gap-3 items-center">
                <h1 className={`${instrumentSerif.className} text-center text-white text-3xl `}>Welcome Back!</h1>
                <p className={`${instrumentSans.className} text-white mt-3`}>Login to design smarter events with AI-powered planning tools.</p>
              </div>}
              {pathname == "/auth/signup" && <div className="flex-col gap-3 items-center">
                <h1 className={`${instrumentSerif.className} text-center text-white text-3xl `}>Get started with us</h1>
                <p className={`${instrumentSans.className} text-white mt-3`}>
                  Create your account to design smarter events with AI-powered planning tools.
                </p>
              </div>}
            </div>
          </div>
        </div>
        <main className={`w-full lg:w-[50%] pt-4 ${instrumentSans.className}`}>{children}</main>
      </div>
    </>
  );
};

export default AuthLayout;
