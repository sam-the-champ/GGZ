import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register",
  robots: { index: false, follow: false },
};

export default function RegisterLayout({ children }: LayoutProps<"/register">) {
  return children;
}
