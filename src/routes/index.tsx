import { A } from "@solidjs/router";
import { TreeView } from "~/components/TreeView";

export default function Home() {
  return (
    <main class="text-center mx-auto text-gray-700 p-8">
      <h1 class="text-4xl text-sky-700 font-bold mb-8">TreeView Example</h1>
      <p class="mt-8">
        <A href="/about" class="text-sky-600 hover:underline">
          About Page
        </A>
      </p>
    </main>
  );
}
