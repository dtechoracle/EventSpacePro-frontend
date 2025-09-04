import { Instrument_Serif, Instrument_Sans } from "next/font/google";

export const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
});

export const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
})

const fonts = { instrumentSerif, instrumentSans };
export default fonts;
