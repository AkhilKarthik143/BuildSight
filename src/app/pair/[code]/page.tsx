import { Suspense } from "react";
import PhoneJoin from "@/components/pair/PhoneJoin";

export default function PairPage() {
  return (
    <Suspense fallback={null}>
      <PhoneJoin />
    </Suspense>
  );
}
