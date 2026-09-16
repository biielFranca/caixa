import { redirect } from "next/navigation";
import { todayISO } from "@/lib/calc";

export const dynamic = "force-dynamic";

export default function CaixaIndex() {
  redirect(`/caixa/${todayISO()}`);
}
