import { useEffect, useState } from "react";
import type { Article } from "../types";

interface Props {
  articles: Article[];
}

export function NewsTicker({ articles }: Props) {
  const breaking = articles
    .filter(a => a.isBreaking || a.category === "رسمي")
    .slice(0, 10);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!breaking.length) return;

    const timer = setInterval(() => {
      setIndex(i => (i + 1) % breaking.length);
    }, 7000); // ⏱️ 7 ثواني
<style>
{`
@keyframes fade {
  0% { opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { opacity: 0; }
}

.animate-fade {
  animation: fade 7s ease-in-out;
}
`}
</style>

    return () => clearInterval(timer);
  }, [breaking.length]);

  if (!breaking.length) return null;

  return (
    <div className="w-full bg-red-700 text-white py-2 px-4 overflow-hidden">
      <div
        key={breaking[index].id}
        className="text-right font-bold text-sm animate-fade"
      >
        عاجل: {breaking[index].title}
      </div>
    </div>
  );
}
