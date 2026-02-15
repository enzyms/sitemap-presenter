import { $ as derived, a0 as store_get, _ as head, a1 as ensure_array_like, a2 as attr_class, a3 as attr, a4 as unsubscribe_stores } from "../../../../../chunks/index.js";
import { A as AppHeader, p as page } from "../../../../../chunks/AppHeader.js";
import { b as ssr_context, e as escape_html } from "../../../../../chunks/context.js";
import { createClient } from "@supabase/supabase-js";
function onDestroy(fn) {
  /** @type {SSRContext} */
  ssr_context.r.on_destroy(fn);
}
const PUBLIC_SUPABASE_URL = "https://bgjeaqpvsgfsfacnsilu.supabase.co";
const PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_SDttAKs-cBM9V4uDK9XRuw_2_5-UZoR";
let supabaseClient = null;
function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}
function formatDateTime(dateString) {
  return new Date(dateString).toLocaleDateString(void 0, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}
class FeedbackStore {
  site = null;
  markers = [];
  loading = false;
  error = null;
  currentPagePath = null;
  realtimeChannel = null;
  supabase = getSupabase();
  #markersForCurrentPage = derived(
    // Derived values
    () => {
      if (!this.currentPagePath) return this.markers;
      return this.markers.filter((m) => m.page_path === this.currentPagePath);
    }
  );
  get markersForCurrentPage() {
    return this.#markersForCurrentPage();
  }
  set markersForCurrentPage($$value) {
    return this.#markersForCurrentPage($$value);
  }
  #openCount = derived(() => this.markers.filter((m) => m.status === "open").length);
  get openCount() {
    return this.#openCount();
  }
  set openCount($$value) {
    return this.#openCount($$value);
  }
  #resolvedCount = derived(() => this.markers.filter((m) => m.status === "resolved").length);
  get resolvedCount() {
    return this.#resolvedCount();
  }
  set resolvedCount($$value) {
    return this.#resolvedCount($$value);
  }
  async initializeBySiteId(siteId) {
    this.loading = true;
    this.error = null;
    try {
      const { data: siteData, error: siteError } = await this.supabase.from("sites").select("*").eq("id", siteId).single();
      if (siteError) throw siteError;
      this.site = siteData;
      this.loading = false;
      await this.loadMarkers();
      this.subscribeToRealtime(siteId);
      return true;
    } catch (e) {
      console.error("Failed to initialize site:", e);
      this.loading = false;
      this.error = e instanceof Error ? e.message : "Failed to load site";
      return false;
    }
  }
  async initializeByApiKey(apiKey) {
    this.loading = true;
    this.error = null;
    try {
      const { data: siteData, error: siteError } = await this.supabase.from("sites").select("*").eq("api_key", apiKey).single();
      if (siteError) throw siteError;
      this.site = siteData;
      this.loading = false;
      await this.loadMarkers();
      this.subscribeToRealtime(siteData.id);
      return true;
    } catch (e) {
      console.error("Failed to initialize site:", e);
      this.loading = false;
      this.error = e instanceof Error ? e.message : "Failed to load site";
      return false;
    }
  }
  async loadMarkers(pagePath) {
    if (!this.site) return;
    this.loading = true;
    this.error = null;
    try {
      let query = this.supabase.from("markers").select(`
					*,
					comments (*)
				`).eq("site_id", this.site.id).order("number", { ascending: true });
      if (pagePath) {
        query = query.eq("page_path", pagePath);
      }
      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      this.markers = (data || []).map((m) => ({ ...m, comments: m.comments || [] }));
      this.currentPagePath = pagePath || null;
      this.loading = false;
    } catch (e) {
      console.error("Failed to load markers:", e);
      this.loading = false;
      this.error = e instanceof Error ? e.message : "Failed to load markers";
    }
  }
  setCurrentPage(pagePath) {
    this.currentPagePath = pagePath;
  }
  async createMarker(data) {
    if (!this.site) return null;
    try {
      const { data: numberData } = await this.supabase.rpc("get_next_marker_number", { p_site_id: this.site.id, p_page_path: data.page_path });
      const number = numberData || 1;
      const { data: marker, error: createError } = await this.supabase.from("markers").insert({
        site_id: this.site.id,
        page_url: data.page_url,
        page_path: data.page_path,
        page_title: data.page_title || null,
        number,
        anchor: data.anchor,
        fallback_position: data.fallback_position,
        viewport: data.viewport,
        status: "open"
      }).select("*").single();
      if (createError) throw createError;
      let comments = [];
      if (data.initial_comment) {
        const { data: comment } = await this.supabase.from("comments").insert({ marker_id: marker.id, content: data.initial_comment }).select("*").single();
        if (comment) {
          comments = [comment];
        }
      }
      const newMarker = { ...marker, comments };
      this.markers = [...this.markers, newMarker];
      return newMarker;
    } catch (e) {
      console.error("Failed to create marker:", e);
      return null;
    }
  }
  async updateMarkerStatus(markerId, status) {
    if (!this.site) return false;
    try {
      const { error: updateError } = await this.supabase.from("markers").update({ status }).eq("id", markerId).eq("site_id", this.site.id);
      if (updateError) throw updateError;
      this.markers = this.markers.map((m) => m.id === markerId ? { ...m, status } : m);
      return true;
    } catch (e) {
      console.error("Failed to update marker:", e);
      return false;
    }
  }
  async deleteMarker(markerId) {
    if (!this.site) return false;
    try {
      const { error: deleteError } = await this.supabase.from("markers").delete().eq("id", markerId).eq("site_id", this.site.id);
      if (deleteError) throw deleteError;
      this.markers = this.markers.filter((m) => m.id !== markerId);
      return true;
    } catch (e) {
      console.error("Failed to delete marker:", e);
      return false;
    }
  }
  async addComment(markerId, content, authorName) {
    try {
      const { data: comment, error: createError } = await this.supabase.from("comments").insert({
        marker_id: markerId,
        content,
        author_name: authorName || null
      }).select("*").single();
      if (createError) throw createError;
      this.markers = this.markers.map((m) => {
        if (m.id === markerId) {
          return { ...m, comments: [...m.comments, comment] };
        }
        return m;
      });
      return comment;
    } catch (e) {
      console.error("Failed to add comment:", e);
      return null;
    }
  }
  subscribeToRealtime(siteId) {
    if (this.realtimeChannel) {
      this.supabase.removeChannel(this.realtimeChannel);
    }
    this.realtimeChannel = this.supabase.channel(`feedback-dashboard-${siteId}`).on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "markers",
        filter: `site_id=eq.${siteId}`
      },
      (payload) => {
        const eventType = payload.eventType;
        const marker = payload.new;
        const oldMarker = payload.old;
        if (eventType === "INSERT" && marker) {
          if (!this.markers.find((m) => m.id === marker.id)) {
            this.markers = [...this.markers, { ...marker, comments: [] }];
          }
        } else if (eventType === "UPDATE" && marker) {
          this.markers = this.markers.map((m) => m.id === marker.id ? { ...m, ...marker } : m);
        } else if (eventType === "DELETE" && oldMarker) {
          this.markers = this.markers.filter((m) => m.id !== oldMarker.id);
        }
      }
    ).on("postgres_changes", { event: "INSERT", schema: "public", table: "comments" }, (payload) => {
      const comment = payload.new;
      this.markers = this.markers.map((m) => {
        if (m.id === comment.marker_id) {
          if (m.comments.find((c) => c.id === comment.id)) return m;
          return { ...m, comments: [...m.comments, comment] };
        }
        return m;
      });
    }).subscribe();
  }
  destroy() {
    if (this.realtimeChannel) {
      this.supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
    this.site = null;
    this.markers = [];
    this.loading = false;
    this.error = null;
    this.currentPagePath = null;
  }
  getMarker(markerId) {
    return this.markers.find((m) => m.id === markerId);
  }
}
const feedbackStore = new FeedbackStore();
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let siteId = store_get($$store_subs ??= {}, "$page", page).params.id;
    let statusFilter = "all";
    let pageFilter = null;
    let expandedMarkerId = null;
    let commentText = "";
    let groupedByPage = (() => {
      const filtered = feedbackStore.markers;
      const groups = {};
      for (const marker of filtered) {
        if (!groups[marker.page_path]) {
          groups[marker.page_path] = [];
        }
        groups[marker.page_path].push(marker);
      }
      return groups;
    })();
    let uniquePages = [...new Set(feedbackStore.markers.map((m) => m.page_path))].sort();
    let filteredCount = Object.values(groupedByPage).reduce((sum, arr) => sum + arr.length, 0);
    onDestroy(() => {
      feedbackStore.destroy();
    });
    head("1d8kbs3", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(feedbackStore.site?.name || "Loading...")} - Feedback</title>`);
      });
    });
    $$renderer2.push(`<div class="min-h-screen bg-gray-100 flex flex-col">`);
    AppHeader($$renderer2, {
      siteName: feedbackStore.site?.name,
      siteId,
      showNewSite: false
    });
    $$renderer2.push(`<!----> <div class="bg-white border-b border-gray-200 px-6 py-3"><div class="max-w-6xl mx-auto flex items-center gap-6">`);
    if (feedbackStore.loading) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="h-6 w-32 bg-gray-200 animate-pulse rounded"></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<div class="flex items-center gap-2"><span class="text-xl font-bold text-gray-800">${escape_html(feedbackStore.markers.length)}</span> <span class="text-gray-500">total markers</span></div> `);
      if (feedbackStore.openCount > 0) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<div class="flex items-center gap-2"><span class="w-3 h-3 bg-orange-500 rounded-full"></span> <span class="text-gray-700 font-medium">${escape_html(feedbackStore.openCount)} open</span></div>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (feedbackStore.resolvedCount > 0) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<div class="flex items-center gap-2"><span class="w-3 h-3 bg-green-500 rounded-full"></span> <span class="text-gray-700 font-medium">${escape_html(feedbackStore.resolvedCount)} resolved</span></div>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div></div> <main class="max-w-6xl mx-auto px-6 py-8">`);
    if (feedbackStore.error) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">${escape_html(feedbackStore.error)}</div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (feedbackStore.loading) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="flex items-center justify-center py-20"><svg class="w-8 h-8 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
      if (feedbackStore.markers.length === 0) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<div class="text-center py-20"><svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg> <h2 class="text-xl font-medium text-gray-600 mb-2">No feedback yet</h2> <p class="text-gray-400">Install the widget on your site to start collecting feedback</p></div>`);
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push(`<div class="flex items-center gap-4 mb-6">`);
        $$renderer2.select(
          {
            value: statusFilter,
            class: "px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          },
          ($$renderer3) => {
            $$renderer3.option({ value: "all" }, ($$renderer4) => {
              $$renderer4.push(`All status (${escape_html(feedbackStore.markers.length)})`);
            });
            $$renderer3.option({ value: "open" }, ($$renderer4) => {
              $$renderer4.push(`Open (${escape_html(feedbackStore.openCount)})`);
            });
            $$renderer3.option({ value: "resolved" }, ($$renderer4) => {
              $$renderer4.push(`Resolved (${escape_html(feedbackStore.resolvedCount)})`);
            });
          }
        );
        $$renderer2.push(` `);
        $$renderer2.select(
          {
            value: pageFilter,
            class: "px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          },
          ($$renderer3) => {
            $$renderer3.option({ value: null }, ($$renderer4) => {
              $$renderer4.push(`All pages (${escape_html(uniquePages.length)})`);
            });
            $$renderer3.push(`<!--[-->`);
            const each_array = ensure_array_like(uniquePages);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let pagePath = each_array[$$index];
              $$renderer3.option({ value: pagePath }, ($$renderer4) => {
                $$renderer4.push(`${escape_html(pagePath)}`);
              });
            }
            $$renderer3.push(`<!--]-->`);
          }
        );
        $$renderer2.push(` <span class="text-sm text-gray-500">Showing ${escape_html(filteredCount)} marker${escape_html(filteredCount !== 1 ? "s" : "")}</span></div> <div class="space-y-8"><!--[-->`);
        const each_array_1 = ensure_array_like(Object.entries(groupedByPage));
        for (let $$index_3 = 0, $$length = each_array_1.length; $$index_3 < $$length; $$index_3++) {
          let [pagePath, pageMarkers] = each_array_1[$$index_3];
          $$renderer2.push(`<div><h2 class="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> ${escape_html(pagePath)} <span class="text-gray-400">(${escape_html(pageMarkers.length)})</span></h2> <div class="space-y-3"><!--[-->`);
          const each_array_2 = ensure_array_like(pageMarkers);
          for (let $$index_2 = 0, $$length2 = each_array_2.length; $$index_2 < $$length2; $$index_2++) {
            let marker = each_array_2[$$index_2];
            $$renderer2.push(`<div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"><div class="p-4 cursor-pointer hover:bg-gray-50 transition-colors" role="button" tabindex="0"><div class="flex items-start gap-4"><div${attr_class("w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0", void 0, {
              "bg-orange-500": marker.status === "open",
              "bg-green-500": marker.status === "resolved"
            })}>${escape_html(marker.number)}</div> <div class="flex-1 min-w-0"><div class="flex items-center gap-2 mb-1"><span class="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">${escape_html(marker.anchor.tagName)}</span> <span${attr_class("text-xs px-2 py-0.5 rounded-full", void 0, {
              "bg-orange-100": marker.status === "open",
              "text-orange-700": marker.status === "open",
              "bg-green-100": marker.status === "resolved",
              "text-green-700": marker.status === "resolved"
            })}>${escape_html(marker.status)}</span></div> `);
            if (marker.comments.length > 0) {
              $$renderer2.push("<!--[-->");
              $$renderer2.push(`<p class="text-sm text-gray-700 line-clamp-2">${escape_html(marker.comments[marker.comments.length - 1].content)}</p> `);
              if (marker.comments.length > 1) {
                $$renderer2.push("<!--[-->");
                $$renderer2.push(`<p class="text-xs text-gray-400 mt-1">+${escape_html(marker.comments.length - 1)} more comment${escape_html(marker.comments.length > 2 ? "s" : "")}</p>`);
              } else {
                $$renderer2.push("<!--[!-->");
              }
              $$renderer2.push(`<!--]-->`);
            } else {
              $$renderer2.push("<!--[!-->");
              $$renderer2.push(`<p class="text-sm text-gray-400 italic">No comments</p>`);
            }
            $$renderer2.push(`<!--]--> <p class="text-xs text-gray-400 mt-2">${escape_html(formatDateTime(marker.created_at))}</p></div> <svg${attr_class("w-5 h-5 text-gray-400 transition-transform", void 0, { "rotate-180": expandedMarkerId === marker.id })} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></div></div> `);
            if (expandedMarkerId === marker.id) {
              $$renderer2.push("<!--[-->");
              $$renderer2.push(`<div class="border-t border-gray-200 bg-gray-50"><div class="p-4 border-b border-gray-200"><h4 class="text-xs font-medium text-gray-500 uppercase mb-2">Element</h4> <code class="text-xs text-gray-600 bg-white px-2 py-1 rounded border block overflow-x-auto">${escape_html(marker.anchor.selector)}</code></div> <div class="p-4 border-b border-gray-200"><h4 class="text-xs font-medium text-gray-500 uppercase mb-3">Comments (${escape_html(marker.comments.length)})</h4> `);
              if (marker.comments.length > 0) {
                $$renderer2.push("<!--[-->");
                $$renderer2.push(`<div class="space-y-3 mb-4 max-h-60 overflow-y-auto"><!--[-->`);
                const each_array_3 = ensure_array_like(marker.comments);
                for (let $$index_1 = 0, $$length3 = each_array_3.length; $$index_1 < $$length3; $$index_1++) {
                  let comment = each_array_3[$$index_1];
                  $$renderer2.push(`<div class="bg-white p-3 rounded-lg border border-gray-200"><p class="text-sm text-gray-700">${escape_html(comment.content)}</p> <p class="text-xs text-gray-400 mt-1">${escape_html(comment.author_name || "Anonymous")} • ${escape_html(formatDateTime(comment.created_at))}</p></div>`);
                }
                $$renderer2.push(`<!--]--></div>`);
              } else {
                $$renderer2.push("<!--[!-->");
              }
              $$renderer2.push(`<!--]--> <div class="flex gap-2"><input type="text"${attr("value", commentText)} placeholder="Add a comment..." class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/> <button${attr("disabled", !commentText.trim(), true)} class="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Send</button></div></div> <div class="p-4 flex items-center gap-3">`);
              if (marker.status === "open") {
                $$renderer2.push("<!--[-->");
                $$renderer2.push(`<button class="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Mark Resolved</button>`);
              } else {
                $$renderer2.push("<!--[!-->");
                $$renderer2.push(`<button class="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> Reopen</button>`);
              }
              $$renderer2.push(`<!--]--> <button class="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Delete</button></div></div>`);
            } else {
              $$renderer2.push("<!--[!-->");
            }
            $$renderer2.push(`<!--]--></div>`);
          }
          $$renderer2.push(`<!--]--></div></div>`);
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></main></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
