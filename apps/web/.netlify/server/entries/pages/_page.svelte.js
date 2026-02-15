import { _ as head } from "../../chunks/index.js";
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../chunks/state.svelte.js";
import { A as AppHeader } from "../../chunks/AppHeader.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    head("1uha8ag", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Sitemap Presenter - Dashboard</title>`);
      });
      $$renderer3.push(`<meta name="description" content="Interactive sitemap visualization and feedback tool"/>`);
    });
    $$renderer2.push(`<div class="h-screen w-screen bg-gray-50 flex flex-col">`);
    AppHeader($$renderer2, {});
    $$renderer2.push(`<!----> <main class="flex-1 overflow-auto p-6"><div class="max-w-6xl mx-auto"><div class="mb-8"><h1 class="text-2xl font-bold text-gray-900">Your Sites</h1> <p class="text-gray-500 mt-1">Manage your websites and collect feedback</p></div> `);
    {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="flex items-center justify-center py-12"><svg class="w-8 h-8 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>`);
    }
    $$renderer2.push(`<!--]--></div></main></div>`);
  });
}
export {
  _page as default
};
