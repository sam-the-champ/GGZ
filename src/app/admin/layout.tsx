import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · GGZ Camp admin" },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <div className="min-h-dvh bg-[#f6f3ee]">{children}</div>;
}
