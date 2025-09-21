import { instrumentSans } from "@/helpers/fonts";
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
          <div className="relative rounded-2xl h-full group group-hover:scale-105 flex justify-center items-center overflow-hidden bg-[url('/assets/bg.jpg')] bg-cover bg-center">
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs"></div>

            {/* Noise overlay (optional, keeps your texture effect) */}
            <div className="absolute inset-0 pointer-events-none bg-[url('/assets/noise.png')] opacity-20 mix-blend-overlay"></div>

            {/* Content */}
            <div className="relative flex flex-col gap-6 items-center z-10 p-4">
              <Image
                src="/assets/mainLogo.svg"
                alt="Logo"
                width={300}
                height={300}
              />

              {pathname === "/auth/login" && (
                <div className="flex-col gap-3 items-center">
                  <h1 className={`${instrumentSans.className} text-center text-white text-5xl font-bold`}>
                    Welcome Back!
                  </h1>
                  <p className={`${instrumentSans.className} text-white mt-3 text-sm`}>
                    Login to design smarter events with AI-powered planning tools.
                  </p>
                </div>
              )}

              {pathname !== "/auth/login" && (
                <div className="flex-col gap-3 items-center">
                  <h1 className={`${instrumentSans.className} text-center text-white text-4xl font-bold`}>
                    Get started with us
                  </h1>
                  <p className={`${instrumentSans.className} text-white mt-3 text-sm`}>
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
