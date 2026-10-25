import { Suspense } from "react";
import PracticeView from "@/components/practice/PracticeView";

export const metadata = { title: "Practice in AR · BuildSight" };

export default function PracticePage() {
  return (
    <Suspense fallback={null}>
      <PracticeView packId="parrot" />
    </Suspense>
  );
}
