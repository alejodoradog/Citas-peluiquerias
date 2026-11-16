import { Suspense } from "react";
import { SignOutButton } from "@/ui/sign-out-button";
import { AdminNav, AdminNavShell } from "./admin-nav";

// The platform panel (task 5.4) on a computer (task 7.12): the side menu and
// the screen beside it. Each page checks the super admin itself
// (requireSuperAdmin); the menu only has links. It marks the current screen
// from the URL, so it waits inside Suspense, showing the same menu meanwhile.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  const signOut = <SignOutButton variant="text" />;
  return (
    <div className="lg:bg-paper flex min-h-full flex-1">
      <Suspense fallback={<AdminNavShell current={null} signOut={signOut} />}>
        <AdminNav signOut={signOut} />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
