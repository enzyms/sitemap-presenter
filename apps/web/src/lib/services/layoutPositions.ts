import { browser } from '$app/environment';
import { getSupabase } from '$lib/services/supabase';
import type { SiteLayout } from '@sitemap-presenter/shared';

const POSITIONS_STORAGE_KEY = 'sitemap-node-positions';
const DEBOUNCE_MS = 500;

type Positions = Record<string, { x: number; y: number }>;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave: { siteId: string; layoutMode: string; positions: Positions; updatedBy: string | null } | null = null;

function getLocalStorageKey(siteId: string, layoutMode: string): string {
	return `${POSITIONS_STORAGE_KEY}-${siteId}-${layoutMode}`;
}

function loadFromLocalStorage(siteId: string, layoutMode: string): Positions | null {
	if (!browser) return null;
	try {
		const key = getLocalStorageKey(siteId, layoutMode);
		const saved = localStorage.getItem(key);
		return saved ? JSON.parse(saved) : null;
	} catch {
		return null;
	}
}

function saveToLocalStorage(siteId: string, layoutMode: string, positions: Positions): void {
	if (!browser) return;
	try {
		const key = getLocalStorageKey(siteId, layoutMode);
		localStorage.setItem(key, JSON.stringify(positions));
	} catch (e) {
		console.error('Failed to save positions to localStorage:', e);
	}
}

async function doSave(siteId: string, layoutMode: string, positions: Positions, updatedBy: string | null): Promise<void> {
	try {
		const supabase = getSupabase();
		const { error } = await supabase
			.from('site_layouts')
			.upsert(
				{
					site_id: siteId,
					layout_mode: layoutMode,
					positions,
					updated_by: updatedBy
				},
				{ onConflict: 'site_id,layout_mode' }
			);

		if (error) {
			console.error('Failed to save positions to Supabase:', error);
		}
	} catch (e) {
		console.error('Failed to save positions to Supabase:', e);
	}
}

export const layoutPositions = {
	async loadPositions(siteId: string, layoutMode: string): Promise<Positions | null> {
		// Try Supabase first
		try {
			const supabase = getSupabase();
			const { data, error } = await supabase
				.from('site_layouts')
				.select('positions')
				.eq('site_id', siteId)
				.eq('layout_mode', layoutMode)
				.maybeSingle();

			if (!error && data?.positions) {
				// Write-through to localStorage for instant loads
				saveToLocalStorage(siteId, layoutMode, data.positions as Positions);
				return data.positions as Positions;
			}
		} catch {
			// Fall through to localStorage
		}

		// Fall back to localStorage (migration path)
		return loadFromLocalStorage(siteId, layoutMode);
	},

	loadPositionsSync(siteId: string, layoutMode: string): Positions | null {
		return loadFromLocalStorage(siteId, layoutMode);
	},

	savePositions(siteId: string, layoutMode: string, positions: Positions, updatedBy: string | null = null): void {
		// Write-through to localStorage immediately
		saveToLocalStorage(siteId, layoutMode, positions);

		// Debounced Supabase save
		pendingSave = { siteId, layoutMode, positions, updatedBy };

		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		debounceTimer = setTimeout(() => {
			if (pendingSave) {
				doSave(pendingSave.siteId, pendingSave.layoutMode, pendingSave.positions, pendingSave.updatedBy);
				pendingSave = null;
			}
			debounceTimer = null;
		}, DEBOUNCE_MS);
	},

	flushPendingSave(): void {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
		if (pendingSave) {
			doSave(pendingSave.siteId, pendingSave.layoutMode, pendingSave.positions, pendingSave.updatedBy);
			pendingSave = null;
		}
	},

	async toggleLock(siteId: string, layoutMode: string): Promise<boolean> {
		const supabase = getSupabase();

		// Fetch current state
		const { data } = await supabase
			.from('site_layouts')
			.select('is_locked')
			.eq('site_id', siteId)
			.eq('layout_mode', layoutMode)
			.maybeSingle();

		const newLocked = !(data?.is_locked ?? false);

		// Upsert with toggled value
		const { error } = await supabase
			.from('site_layouts')
			.upsert(
				{
					site_id: siteId,
					layout_mode: layoutMode,
					is_locked: newLocked
				},
				{ onConflict: 'site_id,layout_mode' }
			);

		if (error) {
			console.error('Failed to toggle lock:', error);
			return !newLocked; // Return original state on error
		}

		return newLocked;
	},

	async getLayoutMeta(siteId: string, layoutMode: string): Promise<{ is_locked: boolean; updated_by: string | null; updated_at: string | null }> {
		try {
			const supabase = getSupabase();
			const { data, error } = await supabase
				.from('site_layouts')
				.select('is_locked, updated_by, updated_at')
				.eq('site_id', siteId)
				.eq('layout_mode', layoutMode)
				.maybeSingle();

			if (!error && data) {
				return {
					is_locked: data.is_locked,
					updated_by: data.updated_by,
					updated_at: data.updated_at
				};
			}
		} catch {
			// No row yet
		}

		return { is_locked: false, updated_by: null, updated_at: null };
	},

	async deleteLayoutsForSite(siteId: string): Promise<void> {
		// Clear localStorage
		if (browser) {
			try {
				localStorage.removeItem(getLocalStorageKey(siteId, 'hierarchical'));
				localStorage.removeItem(getLocalStorageKey(siteId, 'radial'));
			} catch {}
		}

		// Supabase ON DELETE CASCADE handles DB cleanup, but explicit delete for safety
		try {
			const supabase = getSupabase();
			await supabase
				.from('site_layouts')
				.delete()
				.eq('site_id', siteId);
		} catch (e) {
			console.error('Failed to delete layouts from Supabase:', e);
		}
	}
};
