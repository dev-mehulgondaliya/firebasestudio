import { Suspense } from "react";
import { Playground } from "@/components/editor/Playground";

export const metadata = { title: "Playground · Firebase Studio" };

export default function PlaygroundPage() {
  return (
    <Suspense>
      <Playground />
    </Suspense>
  );
}
