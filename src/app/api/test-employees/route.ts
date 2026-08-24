import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, branch_id, branch:branches!profiles_branch_id_fkey(name, code), branches:branches(name)")
    .neq("role", "admin")
    .limit(5);

  return NextResponse.json({ data, error });
}
