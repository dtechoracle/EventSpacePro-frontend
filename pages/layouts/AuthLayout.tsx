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
          <div className="relative rounded-2xl bg-gradient-to-b from-[var(--accent)] via-[#272339] to-[#2F2A3D] h-full flex justify-center items-center overflow-hidden">
            {/* Noise overlay */}
            <div className="absolute inset-0 pointer-events-none bg-[url('/assets/noise.png')] opacity-20 mix-blend-overlay"></div>

            <div className="relative flex flex-col gap-6 items-center">
              <Image
                src="/assets/mainLogoLight.svg"
                alt="Logo"
                width={200}
                height={200}
              />

              {pathname === "/auth/login" && (
                <div className="flex-col gap-3 items-center">
                  <h1 className={`${instrumentSerif.className} text-center text-white text-3xl`}>
                    Welcome Back!
                  </h1>
                  <p className={`${instrumentSans.className} text-white mt-3`}>
                    Login to design smarter events with AI-powered planning tools.
                  </p>
                </div>
              )}

              {pathname !== "/auth/login" && (
                <div className="flex-col gap-3 items-center">
                  <h1 className={`${instrumentSerif.className} text-center text-white text-3xl`}>
                    Get started with us
                  </h1>
                  <p className={`${instrumentSans.className} text-white mt-3`}>
                    Create your account to design smarter events with AI-powered planning tools.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        <main className={`w-full lg:w-[50%] pt-4 ${instrumentSans.className}`}>{children}</main>
      </div>
    </>
  );
};

export default AuthLayout;
