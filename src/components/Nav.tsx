import { useLocation } from "@solidjs/router";
import { createSignal, onMount } from "solid-js";

export default function Nav() {
  const location = useLocation();
  const [hydrated, setHydrated] = createSignal(false);

  // Mark as hydrated after mount to prevent hydration mismatches
  onMount(() => {
    setHydrated(true);
  });

  const active = (path: string) => {
    // During SSR/hydration, don't apply active styles to prevent mismatches
    if (!hydrated()) {
      return "border-transparent hover:border-sky-600";
    }
    return location.pathname === path
      ? "border-sky-600"
      : "border-transparent hover:border-sky-600";
  };

  return (
    <nav class="bg-sky-800">
      <ul class="container flex items-center p-3 text-gray-200">
        <li class={`border-b-2 ${active("/")} mx-1.5 sm:mx-6`}>
          <a href="/">Home</a>
        </li>
        <li class={`border-b-2 ${active("/about")} mx-1.5 sm:mx-6`}>
          <a href="/about">About</a>
        </li>
      </ul>
    </nav>
  );
}
