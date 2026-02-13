import { writable, get } from 'svelte/store';
import type { Project, ProjectCachedData, PageNode, LinkEdge, FeedbackMarker } from '$lib/types';
import { getSupabase } from '$lib/services/supabase';

const STORAGE_KEY = 'sitemap-presenter-projects';
const CURRENT_PROJECT_KEY = 'sitemap-presenter-current-project';

function generateId(): string {
	return `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function loadCurrentProjectId(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		return localStorage.getItem(CURRENT_PROJECT_KEY);
	} catch {
		return null;
	}
}

function saveCurrentProjectId(id: string | null): void {
	if (typeof window === 'undefined') return;
	try {
		if (id) {
			localStorage.setItem(CURRENT_PROJECT_KEY, id);
		} else {
			localStorage.removeItem(CURRENT_PROJECT_KEY);
		}
	} catch (e) {
		console.error('Failed to save current project ID:', e);
	}
}

function loadFromStorage(): Project[] {
	if (typeof window === 'undefined') return [];

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored);
		}
	} catch (e) {
		console.error('Failed to load projects from storage:', e);
	}
	return [];
}

function saveToStorage(projects: Project[]): void {
	if (typeof window === 'undefined') return;

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
	} catch (e) {
		console.error('Failed to save projects to storage:', e);
	}
}

function createProjectsStore() {
	const projects = writable<Project[]>([]);
	const currentProjectId = writable<string | null>(null);
	const isLoaded = writable(false);

	// Initialize from storage (only in browser)
	function initialize() {
		const stored = loadFromStorage();

		// Debug: log what we're loading
		console.log('[ProjectsStore] Initializing with', stored.length, 'projects');
		stored.forEach(p => {
			const markerCount = p.cachedData?.feedbackMarkers
				? Object.values(p.cachedData.feedbackMarkers).flat().length
				: 0;
			const markerPages = p.cachedData?.feedbackMarkers
				? Object.keys(p.cachedData.feedbackMarkers)
				: [];
			console.log(`[ProjectsStore] Project "${p.name}": ${markerCount} markers on pages:`, markerPages);
		});

		projects.set(stored);

		// Restore last selected project
		const savedProjectId = loadCurrentProjectId();
		if (savedProjectId && stored.some(p => p.id === savedProjectId)) {
			currentProjectId.set(savedProjectId);
			console.log('[ProjectsStore] Restored project ID:', savedProjectId);
		}

		isLoaded.set(true);
	}

	function createProject(name: string, description: string, baseUrl: string): Project {
		const now = new Date().toISOString();
		const project: Project = {
			id: generateId(),
			name,
			description,
			baseUrl,
			createdAt: now,
			updatedAt: now
		};

		projects.update(current => {
			const updated = [...current, project];
			saveToStorage(updated);
			return updated;
		});

		return project;
	}

	/** Create a project with an associated Supabase site for feedback widget */
	async function createProjectWithSite(name: string, description: string, baseUrl: string): Promise<Project> {
		const now = new Date().toISOString();
		const projectId = generateId();

		// Extract domain from baseUrl
		let domain = '';
		try {
			const url = new URL(baseUrl);
			domain = url.hostname;
		} catch {
			domain = baseUrl.replace(/^https?:\/\//, '').split('/')[0];
		}

		// Create Supabase site first
		let siteId: string | undefined;
		let siteApiKey: string | undefined;
		try {
			const supabase = getSupabase();
			const { data: site, error } = await supabase
				.from('sites')
				.insert({
					name,
					domain,
					settings: {}
				})
				.select('id, api_key')
				.single();

			if (error) {
				console.error('Failed to create Supabase site:', error);
			} else if (site) {
				siteId = site.id;
				siteApiKey = site.api_key;
				console.log(`[ProjectsStore] Created Supabase site: ${siteId}`);
			}
		} catch (e) {
			console.error('Failed to create Supabase site:', e);
		}

		const project: Project = {
			id: projectId,
			name,
			description,
			baseUrl,
			createdAt: now,
			updatedAt: now,
			siteId,
			siteApiKey
		};

		projects.update(current => {
			const updated = [...current, project];
			saveToStorage(updated);
			return updated;
		});

		return project;
	}

	/** Link an existing project to a Supabase site */
	async function linkProjectToSite(projectId: string, siteId: string): Promise<boolean> {
		try {
			const supabase = getSupabase();
			const { data: site, error } = await supabase
				.from('sites')
				.select('id, api_key')
				.eq('id', siteId)
				.single();

			if (error || !site) {
				console.error('Failed to fetch site:', error);
				return false;
			}

			projects.update(current => {
				const updated = current.map(p => {
					if (p.id === projectId) {
						return {
							...p,
							siteId: site.id,
							siteApiKey: site.api_key,
							updatedAt: new Date().toISOString()
						};
					}
					return p;
				});
				saveToStorage(updated);
				return updated;
			});

			return true;
		} catch (e) {
			console.error('Failed to link project to site:', e);
			return false;
		}
	}

	function updateProject(id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'baseUrl'>>): void {
		projects.update(current => {
			const updated = current.map(p => {
				if (p.id === id) {
					return {
						...p,
						...updates,
						updatedAt: new Date().toISOString()
					};
				}
				return p;
			});
			saveToStorage(updated);
			return updated;
		});
	}

	function deleteProject(id: string): void {
		projects.update(current => {
			const updated = current.filter(p => p.id !== id);
			saveToStorage(updated);
			return updated;
		});

		// Clear current project if it was deleted
		const currentId = get(currentProjectId);
		if (currentId === id) {
			currentProjectId.set(null);
		}
	}

	function cacheProjectData(id: string, nodes: PageNode[], edges: LinkEdge[], feedbackMarkers?: Record<string, FeedbackMarker[]>): void {
		projects.update(current => {
			const updated = current.map(p => {
				if (p.id === id) {
					// Extract screenshot URLs from nodes
					const screenshotUrls: Record<string, string> = {};
					for (const node of nodes) {
						if (node.data.thumbnailUrl) {
							screenshotUrls[node.data.url] = node.data.thumbnailUrl;
						}
					}

					// Preserve existing feedback markers if not provided
					const existingMarkers = p.cachedData?.feedbackMarkers;
					const finalMarkers = feedbackMarkers !== undefined ? feedbackMarkers : existingMarkers;

					return {
						...p,
						lastCrawledAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
						cachedData: {
							nodes,
							edges,
							screenshotUrls,
							feedbackMarkers: finalMarkers
						}
					};
				}
				return p;
			});
			saveToStorage(updated);
			return updated;
		});
	}

	function saveFeedbackMarkers(id: string, feedbackMarkers: Record<string, FeedbackMarker[]>): void {
		projects.update(current => {
			const updated = current.map(p => {
				if (p.id === id && p.cachedData) {
					return {
						...p,
						updatedAt: new Date().toISOString(),
						cachedData: {
							...p.cachedData,
							feedbackMarkers
						}
					};
				}
				return p;
			});
			saveToStorage(updated);
			return updated;
		});
	}

	function getCachedData(id: string): ProjectCachedData | null {
		const currentProjects = get(projects);
		const project = currentProjects.find(p => p.id === id);
		return project?.cachedData || null;
	}

	function getProject(id: string): Project | undefined {
		const currentProjects = get(projects);
		return currentProjects.find(p => p.id === id);
	}

	function selectProject(id: string | null): void {
		currentProjectId.set(id);
		saveCurrentProjectId(id);
	}

	function clearCache(id: string): void {
		projects.update(current => {
			const updated = current.map(p => {
				if (p.id === id) {
					const { cachedData, ...rest } = p;
					return {
						...rest,
						updatedAt: new Date().toISOString()
					};
				}
				return p;
			});
			saveToStorage(updated);
			return updated;
		});
	}

	return {
		projects,
		currentProjectId,
		isLoaded,
		initialize,
		createProject,
		createProjectWithSite,
		linkProjectToSite,
		updateProject,
		deleteProject,
		cacheProjectData,
		getCachedData,
		getProject,
		selectProject,
		clearCache,
		saveFeedbackMarkers
	};
}

export const projectsStore = createProjectsStore();
