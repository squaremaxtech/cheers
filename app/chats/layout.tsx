import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";

// Chats sit outside the role route groups (like the live booking room):
// customers and workers share the same URLs, staff open them read-only.
export default function ChatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-5 py-10">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}
