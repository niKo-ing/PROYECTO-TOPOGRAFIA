import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginView } from "@/features/auth/components/LoginView";
import { getSessionFromCookieStore } from "@/shared/lib/auth/session";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const session = getSessionFromCookieStore(cookieStore);
  if (session) redirect("/dashboard");
  return <LoginView />;
}
