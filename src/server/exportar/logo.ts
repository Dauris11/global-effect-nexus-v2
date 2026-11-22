import { LOGO_PNG_BASE64 } from "./logo-base64";

/** El logo de la Fundación en PNG (los generadores de PDF y Word no leen WebP). */
export async function logoPng(): Promise<Buffer | null> {
  return Buffer.from(LOGO_PNG_BASE64, "base64");
}
