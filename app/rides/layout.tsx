import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";

// Shared chrome for the rider-side ride pages (/rides, /rides/new,
// /rides/[id]). Auth/role guards live on each page — the ride room admits
// riders, matched drivers and staff alike.
export default function RidesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
