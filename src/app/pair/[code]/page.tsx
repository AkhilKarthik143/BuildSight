"use client";

import { useParams } from "next/navigation";
import PhoneJoin from "@/components/pair/PhoneJoin";

export default function PairPage() {
  const { code } = useParams<{ code: string }>();
  return <PhoneJoin code={code.toUpperCase()} />;
}
