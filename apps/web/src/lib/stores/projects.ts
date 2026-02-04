import { writable, get } from 'svelte/store';
import type { Project, ProjectCachedData, PageNode, LinkEdge, FeedbackMarker } from '$lib/types';

const STORAGE_KEY = 'sitemap-presenter-projects';

function generateId(): string {
	return `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
		projects.set(stored);
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
