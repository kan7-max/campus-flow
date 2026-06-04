"use client";

import { useFormStatus } from "react-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions/authActions";

type LogoutButtonProps = {
  isSupabaseEnabled: boolean;
};

function LogoutSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-busy={pending}
      disabled={pending}
      size="sm"
      type="submit"
      variant="outline"
    >
      <LogOut className="h-4 w-4" />
      {pending ? "ログアウト中" : "ログアウト"}
    </Button>
  );
}

export function LogoutButton({ isSupabaseEnabled }: LogoutButtonProps) {
  if (!isSupabaseEnabled) {
    return (
      <form action={signOutAction}>
        <LogoutSubmitButton />
      </form>
    );
  }

  return (
    <form action={signOutAction}>
      <LogoutSubmitButton />
    </form>
  );
}
